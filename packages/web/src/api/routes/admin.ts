import { z } from "zod";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import {
  adminBase,
  adminSections,
  tenantBase,
  passwordToken,
  safeTokenEqual,
  PASSWORD_LOGIN_ENABLED,
  VALID_PASSWORD_TOKEN,
} from "../middleware/auth";
import { checkLock, clientKey, lockMessage, registerFailure, registerSuccess } from "../lib/login-guard";
import { auth } from "../auth";
import { tenantAdminAccess } from "../lib/tenant";
import {
  BUSY_STATUSES,
  SLOTS,
  isPast,
  isValidDate,
  serializeWorkDays,
  todayISO,
  weekdayIndex,
  weekdayName,
  workDaysLabel,
} from "../lib/schedule";
import { loadScheduleRules } from "../lib/agenda-rules";
import { APP_BOOKING_MODES, type AppBookingMode, isValidAppUrl } from "../lib/app-redirect";
import { cancelAppointmentMessages } from "../lib/messenger";
import { syncAppointmentToBlip } from "../lib/blip-sync";
import { BLIP_SETTINGS_PREFIX } from "../lib/blip";
import { allSections } from "../lib/permissions";

/** Bases por área do painel — ver `lib/permissions.ts`. */
const authed = adminBase;
const agendaOnly = adminSections("agenda");
const servicesOnly = adminSections("servicos");
const barbersOnly = adminSections("barbeiros");
const blocksOnly = adminSections("bloqueios");
const agendaOrBlocks = adminSections("agenda", "bloqueios");
const configOnly = adminSections("config");
/** Leitura de serviços/barbeiros: qualquer aba operacional precisa da lista. */
const catalogRead = adminSections("agenda", "servicos", "barbeiros", "bloqueios", "produtos");

const statusEnum = z.enum(["pending", "confirmed", "done", "cancelled"]);

const serviceInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2),
  description: z.string().trim().max(300).default(""),
  durationMin: z.number().int().positive().default(90),
  priceCents: z.number().int().nonnegative(),
  imageUrl: z.string().trim().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const barberInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2),
  role: z.string().trim().default("Barbeiro"),
  bio: z.string().trim().max(300).default(""),
  photoUrl: z.string().trim().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const admin = {
  /**
   * Login alternativo por senha mestra — devolve um token guardado no navegador.
   * O caminho principal é o login Google (managed auth) validado em `session`.
   */
  login: tenantBase
    .input(z.object({ password: z.string().min(1).max(200) }))
    .handler(({ input, context }) => {
      if (!PASSWORD_LOGIN_ENABLED) {
        throw new ORPCError("FORBIDDEN", {
          message: "Login por senha desativado. Entre com o Google.",
        });
      }

      // Freio de força bruta: bloqueia a origem depois de 5 senhas erradas.
      const key = clientKey(context.headers);
      const lock = checkLock(key);
      if (lock.locked) {
        throw new ORPCError("TOO_MANY_REQUESTS", { message: lockMessage(lock.retryAfterSec) });
      }

      if (!safeTokenEqual(passwordToken(input.password))) {
        const state = registerFailure(key);
        if (state.locked) {
          throw new ORPCError("TOO_MANY_REQUESTS", { message: lockMessage(state.retryAfterSec) });
        }
        throw new ORPCError("UNAUTHORIZED", {
          message:
            state.remaining <= 2
              ? `Senha incorreta. ${state.remaining} tentativa(s) antes do bloqueio.`
              : "Senha incorreta.",
        });
      }

      registerSuccess(key);
      return { token: VALID_PASSWORD_TOKEN };
    }),

  /**
   * Estado do acesso: quem está logado (Google ou senha), se é autorizado
   * nesta unidade e qual unidade o domínio resolveu.
   */
  session: tenantBase.handler(async ({ context }) => {
    const tenant = {
      id: context.tenant.id,
      name: context.tenant.name,
      domain: context.tenant.domain,
    };

    const masterToken = context.headers.get("x-admin-token");
    if (safeTokenEqual(masterToken)) {
      return {
        ok: true,
        via: "password" as const,
        email: null as string | null,
        superAdmin: true,
        sections: allSections(),
        canIntegrations: true,
        tenant,
      };
    }

    const session = await auth.api.getSession({ headers: context.headers });
    const email = session?.user.email?.toLowerCase() ?? null;
    if (!email) {
      return {
        ok: false,
        via: null,
        email: null as string | null,
        superAdmin: false,
        sections: [] as ReturnType<typeof allSections>,
        canIntegrations: false,
        tenant,
      };
    }

    // Áreas liberadas para esse e-mail nesta unidade (super admin recebe todas).
    const access = await tenantAdminAccess(context.tenant.id, email);
    return {
      ok: access !== null,
      via: "google" as const,
      email,
      superAdmin: access?.superAdmin ?? false,
      sections: access?.sections ?? [],
      canIntegrations: access?.canIntegrations ?? false,
      tenant,
    };
  }),

  /** Agenda de um dia, com serviço e barbeiro resolvidos. */
  agenda: agendaOnly
    .input(z.object({ date: z.string().refine(isValidDate, "Data inválida") }))
    .handler(async ({ input, context }) => {
      const rows = await db
        .select({
          appointment: schema.appointments,
          service: schema.services,
          barber: schema.barbers,
          account: {
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image,
            phone: schema.user.contactPhone,
          },
        })
        .from(schema.appointments)
        .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
        .innerJoin(schema.barbers, eq(schema.appointments.barberId, schema.barbers.id))
        .leftJoin(schema.user, eq(schema.appointments.userId, schema.user.id))
        .where(
          and(
            eq(schema.appointments.tenantId, context.tenant.id),
            eq(schema.appointments.date, input.date),
          ),
        )
        .orderBy(asc(schema.appointments.slot));

      return rows;
    }),

  /** Próximos agendamentos (a partir de hoje) para o painel. */
  upcoming: agendaOnly.handler(async ({ context }) => {
    const rows = await db
      .select({
        appointment: schema.appointments,
        service: schema.services,
        barber: schema.barbers,
        account: {
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          image: schema.user.image,
          phone: schema.user.contactPhone,
        },
      })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
      .innerJoin(schema.barbers, eq(schema.appointments.barberId, schema.barbers.id))
      .leftJoin(schema.user, eq(schema.appointments.userId, schema.user.id))
      .where(
        and(
          eq(schema.appointments.tenantId, context.tenant.id),
          gte(schema.appointments.date, todayISO()),
          inArray(schema.appointments.status, [...BUSY_STATUSES]),
        ),
      )
      .orderBy(asc(schema.appointments.date), asc(schema.appointments.slot))
      .limit(50);

    const today = rows.filter((r) => r.appointment.date === todayISO());
    const revenueTodayCents = today
      .filter((r) => r.appointment.status !== "cancelled")
      .reduce((sum, r) => sum + r.service.priceCents, 0);

    return {
      rows,
      stats: {
        today: today.length,
        pending: rows.filter((r) => r.appointment.status === "pending").length,
        upcoming: rows.length,
        revenueTodayCents,
      },
    };
  }),

  /** Histórico completo, mais recentes primeiro. */
  history: agendaOnly
    .input(z.object({ status: statusEnum.optional() }).optional())
    .handler(async ({ input, context }) => {
      const rows = await db
        .select({
          appointment: schema.appointments,
          service: schema.services,
          barber: schema.barbers,
          account: {
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image,
            phone: schema.user.contactPhone,
          },
        })
        .from(schema.appointments)
        .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
        .innerJoin(schema.barbers, eq(schema.appointments.barberId, schema.barbers.id))
        .leftJoin(schema.user, eq(schema.appointments.userId, schema.user.id))
        .where(
          and(
            eq(schema.appointments.tenantId, context.tenant.id),
            input?.status ? eq(schema.appointments.status, input.status) : undefined,
          ),
        )
        .orderBy(desc(schema.appointments.date), asc(schema.appointments.slot))
        .limit(200);
      return rows;
    }),

  setStatus: agendaOnly
    .input(z.object({ id: z.number().int().positive(), status: statusEnum }))
    .handler(async ({ input, context }) => {
      const [updated] = await db
        .update(schema.appointments)
        .set({ status: input.status })
        .where(
          and(
            eq(schema.appointments.id, input.id),
            eq(schema.appointments.tenantId, context.tenant.id),
          ),
        )
        .returning();
      if (!updated)
        throw new ORPCError("NOT_FOUND", {
          message: "Agendamento não encontrado.",
        });
      if (input.status === "cancelled") await cancelAppointmentMessages(input.id);
      // Avisa o BlipBeauty da mudança de status (confirmado, concluído, cancelado).
      void syncAppointmentToBlip(context.tenant.id, input.id);
      return updated;
    }),

  removeAppointment: agendaOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .delete(schema.appointments)
        .where(
          and(
            eq(schema.appointments.id, input.id),
            eq(schema.appointments.tenantId, context.tenant.id),
          ),
        );
      return { ok: true };
    }),

  /** Todos os serviços, inclusive inativos. */
  allServices: catalogRead.handler(({ context }) =>
    db
      .select()
      .from(schema.services)
      .where(eq(schema.services.tenantId, context.tenant.id))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.id)),
  ),

  saveService: servicesOnly.input(serviceInput).handler(async ({ input, context }) => {
    const { id, ...values } = input;
    if (id) {
      const [updated] = await db
        .update(schema.services)
        .set(values)
        .where(and(eq(schema.services.id, id), eq(schema.services.tenantId, context.tenant.id)))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(schema.services)
      .values({ ...values, tenantId: context.tenant.id })
      .returning();
    return created;
  }),

  removeService: servicesOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      const used = await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.serviceId, input.id),
            eq(schema.appointments.tenantId, context.tenant.id),
          ),
        )
        .limit(1);
      if (used.length > 0) {
        await db
          .update(schema.services)
          .set({ active: false })
          .where(
            and(eq(schema.services.id, input.id), eq(schema.services.tenantId, context.tenant.id)),
          );
        return { ok: true, deactivated: true };
      }
      await db
        .delete(schema.services)
        .where(
          and(eq(schema.services.id, input.id), eq(schema.services.tenantId, context.tenant.id)),
        );
      return { ok: true, deactivated: false };
    }),

  /** Todos os barbeiros, inclusive inativos. */
  allBarbers: catalogRead.handler(({ context }) =>
    db
      .select()
      .from(schema.barbers)
      .where(eq(schema.barbers.tenantId, context.tenant.id))
      .orderBy(asc(schema.barbers.sortOrder), asc(schema.barbers.id)),
  ),

  saveBarber: barbersOnly.input(barberInput).handler(async ({ input, context }) => {
    const { id, ...values } = input;
    if (id) {
      const [updated] = await db
        .update(schema.barbers)
        .set(values)
        .where(and(eq(schema.barbers.id, id), eq(schema.barbers.tenantId, context.tenant.id)))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(schema.barbers)
      .values({ ...values, tenantId: context.tenant.id })
      .returning();
    return created;
  }),

  removeBarber: barbersOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      const used = await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.barberId, input.id),
            eq(schema.appointments.tenantId, context.tenant.id),
          ),
        )
        .limit(1);
      if (used.length > 0) {
        await db
          .update(schema.barbers)
          .set({ active: false })
          .where(
            and(eq(schema.barbers.id, input.id), eq(schema.barbers.tenantId, context.tenant.id)),
          );
        return { ok: true, deactivated: true };
      }
      await db
        .delete(schema.barbers)
        .where(
          and(eq(schema.barbers.id, input.id), eq(schema.barbers.tenantId, context.tenant.id)),
        );
      return { ok: true, deactivated: false };
    }),

  /** Bloqueios a partir de hoje. */
  blocks: blocksOnly.handler(({ context }) =>
    db
      .select({ block: schema.blocks, barber: schema.barbers })
      .from(schema.blocks)
      .leftJoin(schema.barbers, eq(schema.blocks.barberId, schema.barbers.id))
      .where(
        and(eq(schema.blocks.tenantId, context.tenant.id), gte(schema.blocks.date, todayISO())),
      )
      .orderBy(asc(schema.blocks.date)),
  ),

  createBlock: blocksOnly
    .input(
      z.object({
        date: z.string().refine(isValidDate, "Data inválida"),
        slot: z.enum(SLOTS).nullable().default(null),
        barberId: z.number().int().positive().nullable().default(null),
        reason: z.string().trim().max(200).default(""),
      }),
    )
    .handler(async ({ input, context }) => {
      const [created] = await db
        .insert(schema.blocks)
        .values({ ...input, tenantId: context.tenant.id })
        .returning();
      return created;
    }),

  removeBlock: blocksOnly
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .delete(schema.blocks)
        .where(and(eq(schema.blocks.id, input.id), eq(schema.blocks.tenantId, context.tenant.id)));
      return { ok: true };
    }),

  /**
   * Situação do dia na agenda: se está aberto, por que está fechado e o que
   * o painel pode fazer (liberar ou fechar).
   */
  dayStatus: agendaOrBlocks
    .input(z.object({ date: z.string().refine(isValidDate, "Data inválida") }))
    .handler(async ({ input, context }) => {
      const tenantId = context.tenant.id;
      const [rules, dayBlocks] = await Promise.all([
        loadScheduleRules(tenantId),
        db
          .select()
          .from(schema.blocks)
          .where(and(eq(schema.blocks.tenantId, tenantId), eq(schema.blocks.date, input.date))),
      ]);

      const fullDayBlocks = dayBlocks.filter((b) => b.slot === null && b.barberId === null);
      const workDay = rules.workDays.includes(weekdayIndex(input.date));
      const released = rules.openDates.includes(input.date);

      return {
        date: input.date,
        weekday: weekdayName(input.date),
        past: isPast(input.date),
        workDay,
        released,
        blockedFullDay: fullDayBlocks.length > 0,
        blockedSlots: dayBlocks.filter((b) => b.slot !== null).length,
        open: (workDay || released) && fullDayBlocks.length === 0,
        workDays: rules.workDays,
        workDaysLabel: workDaysLabel(rules.workDays),
      };
    }),

  /** Dias liberados manualmente, de hoje em diante. */
  releasedDays: blocksOnly.handler(({ context }) =>
    db
      .select()
      .from(schema.openDays)
      .where(
        and(eq(schema.openDays.tenantId, context.tenant.id), gte(schema.openDays.date, todayISO())),
      )
      .orderBy(asc(schema.openDays.date)),
  ),

  /**
   * Libera o dia para os clientes: remove o bloqueio de dia inteiro e, quando
   * a data cai fora dos dias de atendimento, registra a abertura pontual.
   */
  openDay: agendaOrBlocks
    .input(
      z.object({
        date: z.string().refine(isValidDate, "Data inválida"),
        reason: z.string().trim().max(200).default(""),
      }),
    )
    .handler(async ({ input, context }) => {
      const tenantId = context.tenant.id;
      if (isPast(input.date)) {
        throw new ORPCError("BAD_REQUEST", { message: "Essa data já passou." });
      }

      await db
        .delete(schema.blocks)
        .where(
          and(
            eq(schema.blocks.tenantId, tenantId),
            eq(schema.blocks.date, input.date),
            isNull(schema.blocks.slot),
          ),
        );

      const rules = await loadScheduleRules(tenantId);
      const workDay = rules.workDays.includes(weekdayIndex(input.date));
      if (!workDay) {
        await db
          .insert(schema.openDays)
          .values({ tenantId, date: input.date, reason: input.reason })
          .onConflictDoUpdate({
            target: [schema.openDays.tenantId, schema.openDays.date],
            set: { reason: input.reason },
          });
      }

      const remainingSlotBlocks = await db
        .select({ id: schema.blocks.id })
        .from(schema.blocks)
        .where(and(eq(schema.blocks.tenantId, tenantId), eq(schema.blocks.date, input.date)));

      return { ok: true, released: !workDay, remainingSlotBlocks: remainingSlotBlocks.length };
    }),

  /** Fecha o dia: tira a liberação pontual e bloqueia o dia inteiro. */
  closeDay: agendaOrBlocks
    .input(
      z.object({
        date: z.string().refine(isValidDate, "Data inválida"),
        reason: z.string().trim().max(200).default(""),
      }),
    )
    .handler(async ({ input, context }) => {
      const tenantId = context.tenant.id;
      await db
        .delete(schema.openDays)
        .where(and(eq(schema.openDays.tenantId, tenantId), eq(schema.openDays.date, input.date)));

      const rules = await loadScheduleRules(tenantId);
      if (rules.workDays.includes(weekdayIndex(input.date))) {
        const existing = await db
          .select({ id: schema.blocks.id })
          .from(schema.blocks)
          .where(
            and(
              eq(schema.blocks.tenantId, tenantId),
              eq(schema.blocks.date, input.date),
              isNull(schema.blocks.slot),
              isNull(schema.blocks.barberId),
            ),
          );
        if (existing.length === 0) {
          await db.insert(schema.blocks).values({
            tenantId,
            date: input.date,
            slot: null,
            barberId: null,
            reason: input.reason || "Fechado pelo painel",
          });
        }
      }
      return { ok: true };
    }),

  /** Define os dias da semana em que a barbearia atende (0 = domingo). */
  setWorkDays: blocksOnly
    .input(z.object({ days: z.array(z.number().int().min(0).max(6)).min(1, "Escolha pelo menos um dia") }))
    .handler(async ({ input, context }) => {
      const value = serializeWorkDays(input.days);
      await db
        .insert(schema.settings)
        .values({ tenantId: context.tenant.id, key: "workDays", value })
        .onConflictDoUpdate({
          target: [schema.settings.tenantId, schema.settings.key],
          set: { value },
        });
      return { ok: true, workDays: value };
    }),

  settings: authed.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.tenantId, context.tenant.id));
    // Chaves de integração (`blip*`) só saem para quem pode configurá-las.
    const visible = context.admin.canIntegrations
      ? rows
      : rows.filter((r) => !r.key.startsWith(BLIP_SETTINGS_PREFIX));
    return Object.fromEntries(visible.map((r) => [r.key, r.value])) as Record<string, string>;
  }),

  saveSettings: configOnly
    .input(z.object({ entries: z.record(z.string(), z.string()) }))
    .handler(async ({ input, context }) => {
      const appUrl = input.entries.appBookingUrl?.trim();
      if (appUrl && !isValidAppUrl(appUrl)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Link do aplicativo inválido. Use um endereço completo, ex.: https://…",
        });
      }
      // Convidado sem direito de integração não grava credencial por aqui.
      if (
        !context.admin.canIntegrations &&
        Object.keys(input.entries).some((key) => key.startsWith(BLIP_SETTINGS_PREFIX))
      ) {
        throw new ORPCError("FORBIDDEN", {
          message: "Só o dono da conta configura a integração de plataformas de mensagem.",
        });
      }
      const appMode = input.entries.appBookingMode;
      if (appMode !== undefined && !APP_BOOKING_MODES.includes(appMode as AppBookingMode)) {
        throw new ORPCError("BAD_REQUEST", { message: "Modo de redirecionamento inválido." });
      }
      // O painel pode salvar só o modo: nesse caso vale o link já guardado.
      let effectiveUrl = appUrl;
      if (appMode && appMode !== "off" && appUrl === undefined) {
        const saved = await db
          .select()
          .from(schema.settings)
          .where(
            and(
              eq(schema.settings.tenantId, context.tenant.id),
              eq(schema.settings.key, "appBookingUrl"),
            ),
          )
          .limit(1);
        effectiveUrl = saved[0]?.value?.trim();
      }
      if (appMode && appMode !== "off" && !effectiveUrl) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Salve o link do aplicativo antes de ativar o redirecionamento.",
        });
      }
      for (const [key, value] of Object.entries(input.entries)) {
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
};
