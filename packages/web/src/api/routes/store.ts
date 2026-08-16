/**
 * Painel da loja e das mensagens automáticas (área administrativa).
 *
 * Reúne: cadastro de produtos, acompanhamento dos pedidos, a comanda de cada
 * agendamento (corte + produtos) e a fila das mensagens automáticas
 * (lembrete de 1h antes e reativação de clientes inativos).
 */
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import { adminBase, adminSections, integrationsBase } from "../middleware/auth";
import { isValidDate } from "../lib/schedule";
import {
  DEFAULT_REACTIVATION_TEMPLATE,
  DEFAULT_REMINDER_TEMPLATE,
  MESSAGING_KEYS,
  SMS_READY,
  WHATSAPP_READY,
  manualWhatsappUrl,
  messagingConfig,
  resolveChannel,
} from "../lib/messaging";
import { runMessenger } from "../lib/messenger";
import {
  BLIP_KEYS,
  generateInboundToken,
  isBlipReady,
  isValidBlipKey,
  isValidBlipUrl,
  maskBlipKey,
  maskInboundToken,
  testBlipConnection,
} from "../lib/blip";
import { syncTenantToBlip } from "../lib/blip-sync";
import {
  INTEGRATION_PLATFORMS,
  INTEGRATION_REQUEST_KEY,
  parseIntegrationRequest,
} from "../lib/permissions";

/**
 * Bases por área do painel (ver `lib/permissions.ts`): o convidado que só
 * recebeu "Agenda" não consegue chamar Produtos, Pedidos nem Mensagens direto
 * pela API. `integrationsBase` protege tudo que envolve credencial de
 * plataforma — nem a URL nem a máscara da chave saem para quem não pode.
 */
const authed = adminBase;
const productsOnly = adminSections("produtos");
const ordersOnly = adminSections("pedidos");
const agendaOrOrders = adminSections("agenda", "pedidos");
const messagesOnly = adminSections("mensagens");

const productInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2, "Informe o nome"),
  description: z.string().trim().max(600).default(""),
  category: z.string().trim().max(60).default("Geral"),
  priceCents: z.number().int().nonnegative(),
  salePriceCents: z.number().int().nonnegative().nullable().default(null),
  stock: z.number().int().nonnegative().default(0),
  imageUrl: z.string().trim().optional(),
  images: z.array(z.string().trim()).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const orderStatus = z.enum(["pending", "confirmed", "paid", "cancelled"]);

export const store = {
  /** Todos os produtos da unidade (inclui inativos). */
  products: productsOnly.handler(({ context }) =>
    db
      .select()
      .from(schema.products)
      .where(eq(schema.products.tenantId, context.tenant.id))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.id)),
  ),

  /** Cria ou atualiza um produto. */
  saveProduct: productsOnly.input(productInput).handler(async ({ input, context }) => {
    const { id, images, salePriceCents, ...rest } = input;
    const values = {
      ...rest,
      salePriceCents: salePriceCents && salePriceCents > 0 ? salePriceCents : null,
      images: JSON.stringify(images.filter(Boolean)),
      imageUrl: rest.imageUrl ?? null,
    };

    if (id) {
      const [updated] = await db
        .update(schema.products)
        .set(values)
        .where(and(eq(schema.products.id, id), eq(schema.products.tenantId, context.tenant.id)))
        .returning();
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Produto não encontrado." });
      return updated;
    }

    const [created] = await db
      .insert(schema.products)
      .values({ ...values, tenantId: context.tenant.id })
      .returning();
    return created!;
  }),

  /** Remove um produto do catálogo. */
  deleteProduct: productsOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .delete(schema.products)
        .where(
          and(eq(schema.products.id, input.id), eq(schema.products.tenantId, context.tenant.id)),
        );
      return { ok: true };
    }),

  /** Pedidos da loja, mais recentes primeiro, com itens e agendamento. */
  orders: ordersOnly
    .input(z.object({ status: orderStatus.optional() }).optional())
    .handler(async ({ input, context }) => {
      const rows = await db
        .select({
          order: schema.orders,
          appointmentDate: schema.appointments.date,
          appointmentSlot: schema.appointments.slot,
        })
        .from(schema.orders)
        .leftJoin(schema.appointments, eq(schema.appointments.id, schema.orders.appointmentId))
        .where(
          and(
            eq(schema.orders.tenantId, context.tenant.id),
            input?.status ? eq(schema.orders.status, input.status) : undefined,
          ),
        )
        .orderBy(desc(schema.orders.id))
        .limit(200);

      if (rows.length === 0) return [];

      const items = await db
        .select()
        .from(schema.orderItems)
        .where(
          inArray(
            schema.orderItems.orderId,
            rows.map((row) => row.order.id),
          ),
        );

      return rows.map((row) => ({
        ...row.order,
        appointmentDate: row.appointmentDate,
        appointmentSlot: row.appointmentSlot,
        items: items.filter((item) => item.orderId === row.order.id),
      }));
    }),

  /** Atualiza o status de um pedido (confirmado, pago, cancelado). */
  setOrderStatus: ordersOnly
    .input(z.object({ id: z.number().int().positive(), status: orderStatus }))
    .handler(async ({ input, context }) => {
      const [updated] = await db
        .update(schema.orders)
        .set({ status: input.status })
        .where(and(eq(schema.orders.id, input.id), eq(schema.orders.tenantId, context.tenant.id)))
        .returning();
      if (!updated) throw new ORPCError("NOT_FOUND", { message: "Pedido não encontrado." });
      return updated;
    }),

  /**
   * Comanda dos agendamentos de um dia: produtos vinculados e total dos
   * pedidos, para somar com o serviço na tela da agenda.
   */
  agendaTotals: agendaOrOrders
    .input(z.object({ date: z.string().refine(isValidDate, "Data inválida") }))
    .handler(async ({ input, context }) => {
      const rows = await db
        .select({
          appointmentId: schema.orders.appointmentId,
          orderId: schema.orders.id,
          status: schema.orders.status,
          name: schema.orderItems.name,
          quantity: schema.orderItems.quantity,
          unitPriceCents: schema.orderItems.unitPriceCents,
        })
        .from(schema.orders)
        .innerJoin(schema.appointments, eq(schema.appointments.id, schema.orders.appointmentId))
        .innerJoin(schema.orderItems, eq(schema.orderItems.orderId, schema.orders.id))
        .where(
          and(
            eq(schema.orders.tenantId, context.tenant.id),
            eq(schema.appointments.date, input.date),
            isNotNull(schema.orders.appointmentId),
          ),
        );

      const map: Record<
        number,
        {
          productsCents: number;
          orderIds: number[];
          items: { name: string; quantity: number; totalCents: number }[];
        }
      > = {};

      for (const row of rows) {
        if (row.appointmentId === null || row.status === "cancelled") continue;
        const entry = (map[row.appointmentId] ??= { productsCents: 0, orderIds: [], items: [] });
        const totalCents = row.unitPriceCents * row.quantity;
        entry.productsCents += totalCents;
        if (!entry.orderIds.includes(row.orderId)) entry.orderIds.push(row.orderId);
        entry.items.push({ name: row.name, quantity: row.quantity, totalCents });
      }

      return map;
    }),

  /** Resumo da loja para os cartões do painel. */
  stats: authed.handler(async ({ context }) => {
    const tenantId = context.tenant.id;
    const [products] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`sum(case when ${schema.products.active} then 1 else 0 end)`,
        outOfStock: sql<number>`sum(case when ${schema.products.stock} = 0 then 1 else 0 end)`,
      })
      .from(schema.products)
      .where(eq(schema.products.tenantId, tenantId));

    const [orders] = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`sum(case when ${schema.orders.status} = 'pending' then 1 else 0 end)`,
        revenue: sql<number>`sum(case when ${schema.orders.status} = 'paid' then ${schema.orders.totalCents} else 0 end)`,
      })
      .from(schema.orders)
      .where(eq(schema.orders.tenantId, tenantId));

    const [queued] = await db
      .select({ total: sql<number>`count(*)` })
      .from(schema.messages)
      .where(and(eq(schema.messages.tenantId, tenantId), eq(schema.messages.status, "queued")));

    return {
      products: Number(products?.total ?? 0),
      activeProducts: Number(products?.active ?? 0),
      outOfStock: Number(products?.outOfStock ?? 0),
      orders: Number(orders?.total ?? 0),
      pendingOrders: Number(orders?.pending ?? 0),
      paidRevenueCents: Number(orders?.revenue ?? 0),
      queuedMessages: Number(queued?.total ?? 0),
    };
  }),

  /** Configuração das mensagens automáticas + o que está disponível no servidor. */
  messagingConfig: messagesOnly.handler(async ({ context }) => {
    const config = await messagingConfig(context.tenant.id);
    // A API key nunca volta inteira para o navegador: `blip` sai do objeto e no
    // lugar vão a URL, a máscara e os avisos de estado.
    const { blip, ...safe } = config;
    // Convidado sem direito de integração não vê nem a URL da plataforma.
    const canSeeBlip = context.admin.canIntegrations;
    return {
      ...safe,
      canIntegrations: canSeeBlip,
      blipApiUrl: canSeeBlip ? blip.apiUrl : "",
      blipApiKeyMasked: canSeeBlip ? maskBlipKey(blip.apiKey) : "",
      blipApiKeySet: canSeeBlip && blip.apiKey.length > 0,
      blipReady: isBlipReady(blip),
      effectiveChannel: resolveChannel(config),
      whatsappReady: WHATSAPP_READY,
      smsReady: SMS_READY,
      defaults: {
        reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
        reactivationTemplate: DEFAULT_REACTIVATION_TEMPLATE,
      },
    };
  }),

  /**
   * Salva a integração BlipBeauty (URL da API + API key).
   *
   * A chave só é gravada quando vem preenchida — deixar o campo em branco
   * mantém a chave atual, e `clearKey` apaga de propósito.
   */
  saveBlipIntegration: integrationsBase
    .input(
      z.object({
        apiUrl: z.string().trim().max(400),
        apiKey: z.string().trim().max(400).default(""),
        clearKey: z.boolean().default(false),
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.apiUrl && !isValidBlipUrl(input.apiUrl)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "URL da API do BlipBeauty inválida. Use o endereço completo, ex.: https://…",
        });
      }
      if (input.apiKey && !isValidBlipKey(input.apiKey)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "API key inválida: precisa ter ao menos 12 caracteres e nenhum espaço.",
        });
      }

      const entries: Record<string, string> = { [BLIP_KEYS.apiUrl]: input.apiUrl };
      if (input.clearKey) entries[BLIP_KEYS.apiKey] = "";
      else if (input.apiKey) entries[BLIP_KEYS.apiKey] = input.apiKey;

      for (const [key, value] of Object.entries(entries)) {
        await db
          .insert(schema.settings)
          .values({ key, value, tenantId: context.tenant.id })
          .onConflictDoUpdate({
            target: [schema.settings.tenantId, schema.settings.key],
            set: { value },
          });
      }

      const saved = await messagingConfig(context.tenant.id);
      // Sem credencial válida o canal não pode continuar apontado para o Blip.
      if (saved.provider === "blip" && !isBlipReady(saved.blip)) {
        await db
          .insert(schema.settings)
          .values({ key: MESSAGING_KEYS.provider, value: "manual", tenantId: context.tenant.id })
          .onConflictDoUpdate({
            target: [schema.settings.tenantId, schema.settings.key],
            set: { value: "manual" },
          });
      }

      return {
        ok: true,
        ready: isBlipReady(saved.blip),
        apiKeyMasked: maskBlipKey(saved.blip.apiKey),
      };
    }),

  /**
   * Testa a integração: confere a chave em `GET /ping` e devolve o estado do
   * BlipBeauty (provedor de WhatsApp, modo de envio, horário de silêncio…).
   */
  testBlipIntegration: integrationsBase.handler(async ({ context }) => {
    const config = await messagingConfig(context.tenant.id);
    if (!isBlipReady(config.blip)) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Cadastre a URL da API e a API key do BlipBeauty antes de testar.",
      });
    }
    return await testBlipConnection(config.blip);
  }),

  /**
   * Manda a agenda (clientes + horários) para o BlipBeauty agora.
   * Reenviar é seguro: cada horário vai com o mesmo `externalId`, então lá é
   * atualizado em vez de duplicado.
   */
  syncBlipAgenda: integrationsBase.handler(async ({ context }) => {
    const result = await syncTenantToBlip(context.tenant.id);
    if (!result.ok && result.reason) {
      throw new ORPCError("BAD_REQUEST", { message: result.reason });
    }
    return result;
  }),

  /**
   * Estado do acesso do BlipBeauty à agenda (token de entrada).
   * O token inteiro só aparece no momento em que é gerado.
   */
  blipAccess: integrationsBase.handler(async ({ context }) => {
    const [row] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(
        and(
          eq(schema.settings.tenantId, context.tenant.id),
          eq(schema.settings.key, BLIP_KEYS.inboundToken),
        ),
      );
    const token = row?.value?.trim() ?? "";
    return {
      tokenSet: token.length > 0,
      tokenMasked: maskInboundToken(token),
      baseUrl: `https://${context.tenant.domain}/api/blip`,
      endpoints: [
        { path: "/ping", desc: "Confere o token e devolve o nome da unidade" },
        { path: "/agenda?from=AAAA-MM-DD&to=AAAA-MM-DD", desc: "Agendamentos com telefone" },
        { path: "/clientes?inativosDias=30", desc: "Clientes parados há X dias" },
        { path: "/fila?status=queued", desc: "Mensagens pendentes no painel" },
        { path: "/fila/{id} (POST)", desc: "Marca a mensagem como sent ou failed" },
      ],
    };
  }),

  /** Gera (ou troca) o token que o BlipBeauty usa para ler a agenda. */
  generateBlipToken: integrationsBase.handler(async ({ context }) => {
    const token = generateInboundToken();
    await db
      .insert(schema.settings)
      .values({ key: BLIP_KEYS.inboundToken, value: token, tenantId: context.tenant.id })
      .onConflictDoUpdate({
        target: [schema.settings.tenantId, schema.settings.key],
        set: { value: token },
      });
    // Única vez que o token completo sai do servidor.
    return { ok: true, token, baseUrl: `https://${context.tenant.domain}/api/blip` };
  }),

  /** Revoga o token: o BlipBeauty perde o acesso à agenda na hora. */
  revokeBlipToken: integrationsBase.handler(async ({ context }) => {
    await db
      .insert(schema.settings)
      .values({ key: BLIP_KEYS.inboundToken, value: "", tenantId: context.tenant.id })
      .onConflictDoUpdate({
        target: [schema.settings.tenantId, schema.settings.key],
        set: { value: "" },
      });
    return { ok: true };
  }),

  /**
   * Pedido de integração feito por quem **não** pode configurar credencial.
   * Guarda a plataforma escolhida (BlipBeauty, Evolution própria ou outra) para
   * o dono ver na aba Unidades e liberar depois. Não grava nenhuma chave.
   */
  requestIntegration: messagesOnly
    .input(
      z.object({
        platform: z.enum(INTEGRATION_PLATFORMS),
        note: z.string().trim().max(400).default(""),
      }),
    )
    .handler(async ({ input, context }) => {
      const request = {
        platform: input.platform,
        note: input.note,
        email: context.admin.email,
        at: new Date().toISOString(),
      };
      const value = JSON.stringify(request);
      await db
        .insert(schema.settings)
        .values({ key: INTEGRATION_REQUEST_KEY, value, tenantId: context.tenant.id })
        .onConflictDoUpdate({
          target: [schema.settings.tenantId, schema.settings.key],
          set: { value },
        });
      return { ok: true, request };
    }),

  /** Pedido de integração pendente desta unidade (null quando não há). */
  integrationRequest: messagesOnly.handler(async ({ context }) => {
    const [row] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(
        and(
          eq(schema.settings.tenantId, context.tenant.id),
          eq(schema.settings.key, INTEGRATION_REQUEST_KEY),
        ),
      );
    return { request: parseIntegrationRequest(row?.value) };
  }),

  /** Descarta o pedido (dono já resolveu ou o convidado desistiu). */
  clearIntegrationRequest: messagesOnly.handler(async ({ context }) => {
    await db
      .insert(schema.settings)
      .values({ key: INTEGRATION_REQUEST_KEY, value: "", tenantId: context.tenant.id })
      .onConflictDoUpdate({
        target: [schema.settings.tenantId, schema.settings.key],
        set: { value: "" },
      });
    return { ok: true };
  }),

  /** Salva a configuração das mensagens automáticas. */
  saveMessagingConfig: messagesOnly
    .input(
      z.object({
        provider: z.enum(["manual", "whatsapp", "sms", "blip"]),
        reminderEnabled: z.boolean(),
        reminderLeadMinutes: z.number().int().min(10).max(1440),
        reactivationEnabled: z.boolean(),
        reactivationDays: z.number().int().min(7).max(365),
        reminderTemplate: z.string().trim().max(900),
        reactivationTemplate: z.string().trim().max(900),
      }),
    )
    .handler(async ({ input, context }) => {
      if (input.provider === "blip") {
        const current = await messagingConfig(context.tenant.id);
        if (!isBlipReady(current.blip)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Cadastre a URL da API e a API key do BlipBeauty antes de usar esse canal.",
          });
        }
      }
      const entries: Record<string, string> = {
        [MESSAGING_KEYS.provider]: input.provider,
        [MESSAGING_KEYS.reminderEnabled]: String(input.reminderEnabled),
        [MESSAGING_KEYS.reminderLeadMinutes]: String(input.reminderLeadMinutes),
        [MESSAGING_KEYS.reactivationEnabled]: String(input.reactivationEnabled),
        [MESSAGING_KEYS.reactivationDays]: String(input.reactivationDays),
        [MESSAGING_KEYS.reminderTemplate]: input.reminderTemplate,
        [MESSAGING_KEYS.reactivationTemplate]: input.reactivationTemplate,
      };

      for (const [key, value] of Object.entries(entries)) {
        await db
          .insert(schema.settings)
          .values({ key, value, tenantId: context.tenant.id })
          .onConflictDoUpdate({
            target: [schema.settings.tenantId, schema.settings.key],
            set: { value },
          });
      }

      return { ok: true };
    }),

  /** Fila de mensagens (últimas 100), com link pronto para envio manual. */
  messages: messagesOnly
    .input(z.object({ status: z.enum(["queued", "sent", "failed", "cancelled"]).optional() }).optional())
    .handler(async ({ input, context }) => {
      const rows = await db
        .select()
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.tenantId, context.tenant.id),
            input?.status ? eq(schema.messages.status, input.status) : undefined,
          ),
        )
        .orderBy(desc(schema.messages.scheduledFor))
        .limit(100);

      return rows.map((row) => ({
        ...row,
        whatsappUrl: manualWhatsappUrl(row.toPhone, row.body),
      }));
    }),

  /** Marca a mensagem como enviada (usado depois do envio manual). */
  markMessageSent: messagesOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .update(schema.messages)
        .set({ status: "sent", sentAt: new Date(), error: null })
        .where(
          and(eq(schema.messages.id, input.id), eq(schema.messages.tenantId, context.tenant.id)),
        );
      return { ok: true };
    }),

  /** Tira a mensagem da fila sem enviar. */
  cancelMessage: messagesOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .update(schema.messages)
        .set({ status: "cancelled" })
        .where(
          and(eq(schema.messages.id, input.id), eq(schema.messages.tenantId, context.tenant.id)),
        );
      return { ok: true };
    }),

  /** Recoloca na fila uma mensagem que falhou. */
  retryMessage: messagesOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .update(schema.messages)
        .set({ status: "queued", error: null, scheduledFor: new Date() })
        .where(
          and(eq(schema.messages.id, input.id), eq(schema.messages.tenantId, context.tenant.id)),
        );
      return { ok: true };
    }),

  /** Roda o ciclo de mensagens agora (sem esperar o worker). */
  runMessages: messagesOnly.handler(({ context }) => runMessenger(context.tenant.id)),
};
