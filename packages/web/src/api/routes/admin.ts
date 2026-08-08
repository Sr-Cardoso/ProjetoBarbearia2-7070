import { z } from "zod";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import {
  adminBase,
  tenantBase,
  passwordToken,
  safeTokenEqual,
  PASSWORD_LOGIN_ENABLED,
  VALID_PASSWORD_TOKEN,
} from "../middleware/auth";
import { checkLock, clientKey, lockMessage, registerFailure, registerSuccess } from "../lib/login-guard";
import { auth } from "../auth";
import { isSuperAdmin, tenantAdminEmails } from "../lib/tenant";
import { BUSY_STATUSES, SLOTS, isValidDate, todayISO } from "../lib/schedule";
import { cancelAppointmentMessages } from "../lib/messenger";

const authed = adminBase;

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
        tenant,
      };
    }

    const allowed = await tenantAdminEmails(context.tenant.id);
    return {
      ok: allowed.includes(email),
      via: "google" as const,
      email,
      superAdmin: await isSuperAdmin(email),
      tenant,
    };
  }),

  /** Agenda de um dia, com serviço e barbeiro resolvidos. */
  agenda: authed
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
  upcoming: authed.handler(async ({ context }) => {
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
  history: authed
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

  setStatus: authed
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
      return updated;
    }),

  removeAppointment: authed
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
  allServices: authed.handler(({ context }) =>
    db
      .select()
      .from(schema.services)
      .where(eq(schema.services.tenantId, context.tenant.id))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.id)),
  ),

  saveService: authed.input(serviceInput).handler(async ({ input, context }) => {
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

  removeService: authed
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
  allBarbers: authed.handler(({ context }) =>
    db
      .select()
      .from(schema.barbers)
      .where(eq(schema.barbers.tenantId, context.tenant.id))
      .orderBy(asc(schema.barbers.sortOrder), asc(schema.barbers.id)),
  ),

  saveBarber: authed.input(barberInput).handler(async ({ input, context }) => {
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

  removeBarber: authed
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
  blocks: authed.handler(({ context }) =>
    db
      .select({ block: schema.blocks, barber: schema.barbers })
      .from(schema.blocks)
      .leftJoin(schema.barbers, eq(schema.blocks.barberId, schema.barbers.id))
      .where(
        and(eq(schema.blocks.tenantId, context.tenant.id), gte(schema.blocks.date, todayISO())),
      )
      .orderBy(asc(schema.blocks.date)),
  ),

  createBlock: authed
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

  removeBlock: authed
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      await db
        .delete(schema.blocks)
        .where(and(eq(schema.blocks.id, input.id), eq(schema.blocks.tenantId, context.tenant.id)));
      return { ok: true };
    }),

  settings: authed.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.tenantId, context.tenant.id));
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  }),

  saveSettings: authed
    .input(z.object({ entries: z.record(z.string(), z.string()) }))
    .handler(async ({ input, context }) => {
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
