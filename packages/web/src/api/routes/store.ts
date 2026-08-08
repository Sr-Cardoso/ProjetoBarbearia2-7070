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
import { adminBase } from "../middleware/auth";
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

const authed = adminBase;

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
  products: authed.handler(({ context }) =>
    db
      .select()
      .from(schema.products)
      .where(eq(schema.products.tenantId, context.tenant.id))
      .orderBy(asc(schema.products.sortOrder), asc(schema.products.id)),
  ),

  /** Cria ou atualiza um produto. */
  saveProduct: authed.input(productInput).handler(async ({ input, context }) => {
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
  deleteProduct: authed
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
  orders: authed
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
  setOrderStatus: authed
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
  agendaTotals: authed
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
  messagingConfig: authed.handler(async ({ context }) => {
    const config = await messagingConfig(context.tenant.id);
    return {
      ...config,
      effectiveChannel: resolveChannel(config.provider),
      whatsappReady: WHATSAPP_READY,
      smsReady: SMS_READY,
      defaults: {
        reminderTemplate: DEFAULT_REMINDER_TEMPLATE,
        reactivationTemplate: DEFAULT_REACTIVATION_TEMPLATE,
      },
    };
  }),

  /** Salva a configuração das mensagens automáticas. */
  saveMessagingConfig: authed
    .input(
      z.object({
        provider: z.enum(["manual", "whatsapp", "sms"]),
        reminderEnabled: z.boolean(),
        reminderLeadMinutes: z.number().int().min(10).max(1440),
        reactivationEnabled: z.boolean(),
        reactivationDays: z.number().int().min(7).max(365),
        reminderTemplate: z.string().trim().max(900),
        reactivationTemplate: z.string().trim().max(900),
      }),
    )
    .handler(async ({ input, context }) => {
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
  messages: authed
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
  markMessageSent: authed
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
  cancelMessage: authed
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
  retryMessage: authed
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
  runMessages: authed.handler(({ context }) => runMessenger(context.tenant.id)),
};
