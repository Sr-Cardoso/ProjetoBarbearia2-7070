import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import { customerBase, tenantBase } from "../middleware/auth";
import { toE164 } from "../lib/phone";
import { readDevCode, SMS_DEV_MODE } from "../lib/sms";
import { slotRange } from "../lib/schedule";
import { cancelAppointmentMessages } from "../lib/messenger";

/** Status que o cliente ainda pode cancelar. */
const CANCELABLE = ["pending", "confirmed"];

export const account = {
  /** Dados da conta logada (ou null quando visitante). */
  me: customerBase.handler(async ({ context }) => {
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, context.user.id));

    return {
      id: context.user.id,
      name: row?.name ?? context.user.name,
      email: row?.email ?? context.user.email,
      image: row?.image ?? null,
      phone: row?.contactPhone ?? row?.phoneNumber ?? null,
      phoneVerified: Boolean(row?.phoneNumberVerified),
    };
  }),

  /** Atualiza nome, telefone e foto do cliente. */
  updateProfile: customerBase
    .input(
      z.object({
        name: z.string().trim().min(2, "Informe seu nome").max(80),
        phone: z.string().trim().max(30).optional(),
        image: z.string().trim().max(2000).nullable().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const phone = input.phone ? toE164(input.phone) : null;
      if (input.phone && !phone) {
        throw new ORPCError("BAD_REQUEST", { message: "Telefone inválido." });
      }

      await db
        .update(schema.user)
        .set({
          name: input.name,
          contactPhone: phone,
          image: input.image === undefined ? undefined : input.image,
          updatedAt: new Date(),
        })
        .where(eq(schema.user.id, context.user.id));

      return { ok: true };
    }),

  /** Histórico de agendamentos da conta (mais recentes primeiro). */
  appointments: customerBase.handler(async ({ context }) => {
    const rows = await db
      .select({
        id: schema.appointments.id,
        date: schema.appointments.date,
        slot: schema.appointments.slot,
        status: schema.appointments.status,
        notes: schema.appointments.notes,
        customerName: schema.appointments.customerName,
        customerPhone: schema.appointments.customerPhone,
        createdAt: schema.appointments.createdAt,
        serviceName: schema.services.name,
        servicePrice: schema.services.priceCents,
        barberName: schema.barbers.name,
      })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
      .innerJoin(schema.barbers, eq(schema.barbers.id, schema.appointments.barberId))
      .where(
        and(
          eq(schema.appointments.tenantId, context.tenant.id),
          eq(schema.appointments.userId, context.user.id),
        ),
      )
      .orderBy(desc(schema.appointments.date), desc(schema.appointments.slot));

    return rows.map((row) => ({ ...row, range: slotRange(row.slot) }));
  }),

  /** Cliente cancela o próprio agendamento. */
  cancel: customerBase
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      const [row] = await db
        .select()
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.id, input.id),
            eq(schema.appointments.tenantId, context.tenant.id),
            eq(schema.appointments.userId, context.user.id),
          ),
        );

      if (!row) throw new ORPCError("NOT_FOUND", { message: "Agendamento não encontrado." });
      if (!CANCELABLE.includes(row.status)) {
        throw new ORPCError("BAD_REQUEST", { message: "Esse agendamento não pode ser cancelado." });
      }

      await db
        .update(schema.appointments)
        .set({ status: "cancelled" })
        .where(eq(schema.appointments.id, input.id));

      await cancelAppointmentMessages(input.id);

      return { ok: true };
    }),

  /**
   * Ajuda no login por telefone quando não há provedor de SMS configurado:
   * devolve o último código gerado para o número (apenas em modo dev).
   */
  devOtp: tenantBase.input(z.object({ phone: z.string().trim().min(8) })).handler(({ input }) => {
    const e164 = toE164(input.phone);
    return {
      devMode: SMS_DEV_MODE,
      code: e164 ? readDevCode(e164) : null,
    };
  }),
};
