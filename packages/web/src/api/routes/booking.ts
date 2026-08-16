import { z } from "zod";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import { tenantBase, withUser } from "../middleware/auth";
import {
  BUSY_STATUSES,
  SLOTS,
  isPast,
  isValidDate,
  normalizePhone,
  slotRange,
  weekdayName,
  workDaysLabel,
} from "../lib/schedule";
import { readAppBooking } from "../lib/app-redirect";
import { BLIP_SETTINGS_PREFIX } from "../lib/blip";
import { syncAppointmentToBlip } from "../lib/blip-sync";
import {
  closedReason,
  fullDayClosedDates,
  isOpenDate,
  loadScheduleRules,
} from "../lib/agenda-rules";

const dateInput = z.object({
  date: z.string().refine(isValidDate, "Data inválida"),
  barberId: z.number().int().positive().optional(),
});

/** Configurações da unidade (chave/valor). */
async function loadSettings(tenantId: number) {
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.tenantId, tenantId));
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
}

export const booking = {
  /** Serviços ativos, ordenados. */
  services: tenantBase.handler(({ context }) =>
    db
      .select()
      .from(schema.services)
      .where(and(eq(schema.services.tenantId, context.tenant.id), eq(schema.services.active, true)))
      .orderBy(asc(schema.services.sortOrder), asc(schema.services.id)),
  ),

  /** Barbeiros ativos, ordenados. */
  barbers: tenantBase.handler(({ context }) =>
    db
      .select()
      .from(schema.barbers)
      .where(and(eq(schema.barbers.tenantId, context.tenant.id), eq(schema.barbers.active, true)))
      .orderBy(asc(schema.barbers.sortOrder), asc(schema.barbers.id)),
  ),

  /**
   * Dados públicos da barbearia (whatsapp, endereço, horários).
   *
   * Ficam de fora, por segurança: as chaves do redirecionamento para o app
   * (`appBooking*`, que saem em `appBooking`) e as credenciais da integração
   * BlipBeauty (`blip*`, incluindo a API key) — nada disso pode chegar ao
   * navegador de um visitante.
   */
  settings: tenantBase.handler(async ({ context }): Promise<Record<string, string>> => {
    const all = await loadSettings(context.tenant.id);
    const entries = Object.entries(all).filter(
      ([key]) => !key.startsWith("appBooking") && !key.startsWith(BLIP_SETTINGS_PREFIX),
    );
    return {
      ...Object.fromEntries(entries),
      tenantName: context.tenant.name,
      tenantDomain: context.tenant.domain,
    };
  }),

  /**
   * Redirecionamento do agendamento para o aplicativo, configurado no painel.
   * Só a página de agendamento usa isso — a home não mostra link nem QR Code.
   */
  appBooking: tenantBase.handler(async ({ context }) =>
    readAppBooking(await loadSettings(context.tenant.id)),
  ),

  /**
   * Dias em que a agenda abre: regra semanal, liberações pontuais feitas no
   * painel e dias fechados por bloqueio. O calendário do site e do app usam
   * isso para saber quais datas aceitar.
   */
  schedule: tenantBase.handler(async ({ context }) => {
    const [rules, closedDates] = await Promise.all([
      loadScheduleRules(context.tenant.id),
      fullDayClosedDates(context.tenant.id),
    ]);
    return {
      workDays: rules.workDays,
      openDates: rules.openDates,
      closedDates,
      label: workDaysLabel(rules.workDays),
    };
  }),

  /** Blocos de 1h30 do dia, marcando quais estão ocupados/bloqueados. */
  availability: tenantBase.input(dateInput).handler(async ({ input, context }) => {
    const { date, barberId } = input;
    const tenantId = context.tenant.id;
    const rules = await loadScheduleRules(tenantId);
    const reason = closedReason(date, rules);

    if (reason) {
      return {
        date,
        closed: true,
        reason,
        slots: SLOTS.map((slot) => ({
          slot,
          range: slotRange(slot),
          available: false,
          reason: "Fechado",
        })),
      };
    }

    const [taken, dayBlocks] = await Promise.all([
      db
        .select({ slot: schema.appointments.slot, barberId: schema.appointments.barberId })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.tenantId, tenantId),
            eq(schema.appointments.date, date),
            inArray(schema.appointments.status, [...BUSY_STATUSES]),
            barberId ? eq(schema.appointments.barberId, barberId) : undefined,
          ),
        ),
      db
        .select()
        .from(schema.blocks)
        .where(
          and(
            eq(schema.blocks.tenantId, tenantId),
            eq(schema.blocks.date, date),
            barberId
              ? or(eq(schema.blocks.barberId, barberId), isNull(schema.blocks.barberId))
              : undefined,
          ),
        ),
    ]);

    const activeBarbers = await db
      .select({ id: schema.barbers.id })
      .from(schema.barbers)
      .where(and(eq(schema.barbers.tenantId, tenantId), eq(schema.barbers.active, true)));

    const capacity = barberId ? 1 : Math.max(activeBarbers.length, 1);
    const fullDayBlock = dayBlocks.find((b) => b.slot === null && (barberId ? true : b.barberId === null));

    const slots = SLOTS.map((slot) => {
      const usedBy = taken.filter((t) => t.slot === slot);
      const slotBlocked = dayBlocks.some(
        (b) => b.slot === slot && (barberId ? true : b.barberId === null),
      );

      if (fullDayBlock) {
        return { slot, range: slotRange(slot), available: false, reason: "Bloqueado" };
      }
      if (slotBlocked) {
        return { slot, range: slotRange(slot), available: false, reason: "Bloqueado" };
      }
      if (usedBy.length >= capacity) {
        return { slot, range: slotRange(slot), available: false, reason: "Ocupado" };
      }
      return { slot, range: slotRange(slot), available: true, reason: null as string | null };
    });

    return { date, closed: false, reason: null as string | null, slots };
  }),

  /** Cria o agendamento validando dia, horário e conflito no banco. */
  create: withUser
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        barberId: z.number().int().positive(),
        date: z.string().refine(isValidDate, "Data inválida"),
        slot: z.enum(SLOTS),
        customerName: z.string().trim().min(2, "Informe seu nome"),
        customerPhone: z.string().trim().min(8, "Informe um WhatsApp válido"),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const tenantId = context.tenant.id;
      if (isPast(input.date)) {
        throw new ORPCError("BAD_REQUEST", { message: "Escolha uma data futura." });
      }
      const rules = await loadScheduleRules(tenantId);
      if (!isOpenDate(input.date, rules)) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Não atendemos ${weekdayName(input.date)}. Atendemos ${workDaysLabel(rules.workDays)}.`,
        });
      }

      const [service] = await db
        .select()
        .from(schema.services)
        .where(
          and(
            eq(schema.services.tenantId, tenantId),
            eq(schema.services.id, input.serviceId),
            eq(schema.services.active, true),
          ),
        );
      if (!service) throw new ORPCError("NOT_FOUND", { message: "Serviço indisponível." });

      const [barber] = await db
        .select()
        .from(schema.barbers)
        .where(
          and(
            eq(schema.barbers.tenantId, tenantId),
            eq(schema.barbers.id, input.barberId),
            eq(schema.barbers.active, true),
          ),
        );
      if (!barber) throw new ORPCError("NOT_FOUND", { message: "Barbeiro indisponível." });

      const blocked = await db
        .select()
        .from(schema.blocks)
        .where(
          and(
            eq(schema.blocks.tenantId, tenantId),
            eq(schema.blocks.date, input.date),
            or(eq(schema.blocks.barberId, input.barberId), isNull(schema.blocks.barberId)),
          ),
        );
      if (blocked.some((b) => b.slot === null || b.slot === input.slot)) {
        throw new ORPCError("CONFLICT", { message: "Esse horário está bloqueado." });
      }

      const conflict = await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.tenantId, tenantId),
            eq(schema.appointments.date, input.date),
            eq(schema.appointments.slot, input.slot),
            eq(schema.appointments.barberId, input.barberId),
            inArray(schema.appointments.status, [...BUSY_STATUSES]),
          ),
        );
      if (conflict.length > 0) {
        throw new ORPCError("CONFLICT", {
          message: "Esse horário acabou de ser reservado. Escolha outro.",
        });
      }

      const [created] = await db
        .insert(schema.appointments)
        .values({
          tenantId,
          userId: context.user?.id ?? null,
          serviceId: input.serviceId,
          barberId: input.barberId,
          date: input.date,
          slot: input.slot,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          notes: input.notes ?? "",
          status: "pending",
        })
        .returning();

      // Espelha o horário no BlipBeauty (ele cuida do lembrete e da reativação).
      // Fire and forget: uma falha lá nunca derruba o agendamento aqui.
      if (created) void syncAppointmentToBlip(tenantId, created.id);

      const config = await loadSettings(tenantId);
      const whatsapp = normalizePhone(config.whatsapp ?? "");
      const dateBr = input.date.split("-").reverse().join("/");
      const message =
        `Olá! Acabei de agendar na ${context.tenant.name}.%0A%0A` +
        `*Cliente:* ${input.customerName}%0A` +
        `*Serviço:* ${service.name}%0A` +
        `*Barbeiro:* ${barber.name}%0A` +
        `*Data:* ${dateBr}%0A` +
        `*Horário:* ${slotRange(input.slot)}`;

      return {
        appointment: created,
        service,
        barber,
        range: slotRange(input.slot),
        whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}?text=${message}` : null,
      };
    }),
};
