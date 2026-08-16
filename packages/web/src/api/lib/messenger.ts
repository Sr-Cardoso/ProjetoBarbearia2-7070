/**
 * Worker das mensagens automáticas.
 *
 * A cada ciclo (5 min) ele:
 * 1. enfileira o **lembrete** dos agendamentos que começam dentro da janela
 *    configurada (padrão: 1 hora antes);
 * 2. enfileira a **reativação** dos clientes que não agendam há X dias
 *    (padrão: 30), já com horários livres para escolher;
 * 3. despacha tudo que está vencido pelo canal escolhido no painel.
 *
 * Nada é enviado duas vezes: cada mensagem tem uma `dedupeKey` única por
 * unidade (ex.: `reminder:123` ou `react:5511...:2026-08`).
 */
import { and, asc, eq, gte, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import {
  deliverMessage,
  messagingConfig,
  renderTemplate,
  resolveChannel,
  type MessageKind,
  type MessagingConfig,
} from "./messaging";
import {
  BUSY_STATUSES,
  SLOTS,
  addDaysISO,
  daysBetweenISO,
  normalizePhone,
  slotRange,
  slotStartMs,
  todayISO,
} from "./schedule";
import { isOpenDate, loadScheduleRules } from "./agenda-rules";
import { syncTenantToBlip } from "./blip-sync";

/** Status de agendamento que ainda merecem lembrete. */
const REMINDABLE = ["pending", "confirmed"];

type Enqueue = {
  tenantId: number;
  kind: MessageKind;
  channel: string;
  toPhone: string;
  toName: string;
  body: string;
  dedupeKey: string;
  appointmentId?: number | null;
  userId?: string | null;
  scheduledFor: Date;
};

/** Insere na fila ignorando duplicatas (mesma dedupeKey na unidade). */
async function enqueue(row: Enqueue): Promise<boolean> {
  const inserted = await db
    .insert(schema.messages)
    .values({
      tenantId: row.tenantId,
      kind: row.kind,
      channel: row.channel,
      toPhone: row.toPhone,
      toName: row.toName,
      body: row.body,
      dedupeKey: row.dedupeKey,
      appointmentId: row.appointmentId ?? null,
      userId: row.userId ?? null,
      scheduledFor: row.scheduledFor,
      status: "queued",
    })
    .onConflictDoNothing({
      target: [schema.messages.tenantId, schema.messages.dedupeKey],
    })
    .returning({ id: schema.messages.id });
  return inserted.length > 0;
}

/** Nome curto ("João Pedro" -> "João") para deixar a mensagem natural. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name.trim();
}

const dateBr = (iso: string) => iso.split("-").reverse().join("/");

/** Endereço público do site — usado nos links das mensagens. */
function siteUrl(domain: string): string {
  const base = process.env.WEBSITE_URL?.replace(/\/$/, "");
  if (base && !base.includes("localhost")) return `${base}/agendar`;
  return `https://${domain}/agendar`;
}

/* ------------------------------------------------------------ lembretes */

/** Enfileira o lembrete dos agendamentos que começam dentro da janela. */
async function queueReminders(
  tenant: { id: number; name: string; domain: string },
  config: MessagingConfig,
  channel: string,
): Promise<number> {
  if (!config.reminderEnabled) return 0;

  const today = todayISO();
  const rows = await db
    .select({
      appointment: schema.appointments,
      service: schema.services,
      barber: schema.barbers,
    })
    .from(schema.appointments)
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .innerJoin(schema.barbers, eq(schema.appointments.barberId, schema.barbers.id))
    .where(
      and(
        eq(schema.appointments.tenantId, tenant.id),
        gte(schema.appointments.date, today),
        lte(schema.appointments.date, addDaysISO(today, 1)),
        inArray(schema.appointments.status, REMINDABLE),
      ),
    );

  const now = Date.now();
  const windowMs = config.reminderLeadMinutes * 60_000;
  let queued = 0;

  for (const row of rows) {
    const startMs = slotStartMs(row.appointment.date, row.appointment.slot);
    // Só quando falta menos que a antecedência configurada e o horário não passou.
    if (startMs - now > windowMs || startMs <= now) continue;

    const body = renderTemplate(config.reminderTemplate, {
      cliente: firstName(row.appointment.customerName),
      nome: row.appointment.customerName,
      barbearia: tenant.name,
      servico: row.service.name,
      barbeiro: row.barber.name,
      data: dateBr(row.appointment.date),
      horario: row.appointment.slot,
      intervalo: slotRange(row.appointment.slot),
      link: siteUrl(tenant.domain),
    });

    const created = await enqueue({
      tenantId: tenant.id,
      kind: "reminder",
      channel,
      toPhone: row.appointment.customerPhone,
      toName: row.appointment.customerName,
      body,
      dedupeKey: `reminder:${row.appointment.id}`,
      appointmentId: row.appointment.id,
      userId: row.appointment.userId,
      scheduledFor: new Date(startMs - windowMs),
    });
    if (created) queued++;
  }

  return queued;
}

/* ---------------------------------------------------------- reativação */

/** Até 4 horários livres nos próximos dias úteis, para sugerir na mensagem. */
async function nextFreeSlots(tenantId: number, limit = 4): Promise<string[]> {
  const activeBarbers = await db
    .select({ id: schema.barbers.id })
    .from(schema.barbers)
    .where(and(eq(schema.barbers.tenantId, tenantId), eq(schema.barbers.active, true)));
  const capacity = Math.max(activeBarbers.length, 1);

  const rules = await loadScheduleRules(tenantId);
  const out: string[] = [];
  let date = todayISO();

  for (let i = 0; i < 10 && out.length < limit; i++) {
    date = addDaysISO(date, 1);
    if (!isOpenDate(date, rules)) continue;

    const [taken, dayBlocks] = await Promise.all([
      db
        .select({ slot: schema.appointments.slot })
        .from(schema.appointments)
        .where(
          and(
            eq(schema.appointments.tenantId, tenantId),
            eq(schema.appointments.date, date),
            inArray(schema.appointments.status, [...BUSY_STATUSES]),
          ),
        ),
      db
        .select({ slot: schema.blocks.slot })
        .from(schema.blocks)
        .where(and(eq(schema.blocks.tenantId, tenantId), eq(schema.blocks.date, date))),
    ]);

    if (dayBlocks.some((b) => b.slot === null)) continue;

    for (const slot of SLOTS) {
      if (out.length >= limit) break;
      const used = taken.filter((t) => t.slot === slot).length;
      if (used >= capacity) continue;
      if (dayBlocks.some((b) => b.slot === slot)) continue;
      out.push(`${dateBr(date)} às ${slot}`);
    }
  }

  return out;
}

/**
 * Enfileira a mensagem de reativação para quem não agenda há X dias e não
 * tem nenhum horário futuro marcado. Uma vez por cliente a cada X dias.
 */
async function queueReactivations(
  tenant: { id: number; name: string; domain: string },
  config: MessagingConfig,
  channel: string,
): Promise<number> {
  if (!config.reactivationEnabled) return 0;

  const today = todayISO();
  const cutoff = addDaysISO(today, -config.reactivationDays);

  // Último agendamento de cada telefone (não cancelado) na unidade.
  const rows = await db
    .select({
      phone: schema.appointments.customerPhone,
      name: sql<string>`max(${schema.appointments.customerName})`.as("name"),
      userId: sql<string | null>`max(${schema.appointments.userId})`.as("user_id"),
      lastDate: sql<string>`max(${schema.appointments.date})`.as("last_date"),
    })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.tenantId, tenant.id),
        ne(schema.appointments.status, "cancelled"),
      ),
    )
    .groupBy(schema.appointments.customerPhone);

  const inactive = rows.filter((r) => r.lastDate <= cutoff && r.phone);
  if (inactive.length === 0) return 0;

  const slots = await nextFreeSlots(tenant.id);
  let queued = 0;

  for (const row of inactive) {
    const days = daysBetweenISO(today, row.lastDate);
    const body = renderTemplate(config.reactivationTemplate, {
      cliente: firstName(row.name ?? ""),
      nome: row.name ?? "",
      barbearia: tenant.name,
      dias: String(days),
      ultimaData: dateBr(row.lastDate),
      horarios: slots.length ? slots.join(", ") : "vários horários",
      link: siteUrl(tenant.domain),
    });

    // Uma reativação por cliente por período configurado.
    const bucket = Math.floor(Date.now() / (config.reactivationDays * 86_400_000));
    const created = await enqueue({
      tenantId: tenant.id,
      kind: "reactivation",
      channel,
      toPhone: row.phone,
      toName: row.name ?? "",
      body,
      dedupeKey: `react:${normalizePhone(row.phone)}:${bucket}`,
      userId: row.userId,
      scheduledFor: new Date(),
    });
    if (created) queued++;
  }

  return queued;
}

/* -------------------------------------------------------------- despacho */

/** Envia as mensagens vencidas da unidade pelo canal configurado. */
async function dispatchQueue(
  tenantId: number,
  channel: string,
  config: MessagingConfig,
): Promise<{ sent: number; failed: number }> {
  const pending = await db
    .select()
    .from(schema.messages)
    .where(
      and(
        eq(schema.messages.tenantId, tenantId),
        eq(schema.messages.status, "queued"),
        lte(schema.messages.scheduledFor, new Date()),
      ),
    )
    .orderBy(asc(schema.messages.scheduledFor))
    .limit(50);

  let sent = 0;
  let failed = 0;

  for (const message of pending) {
    if (channel === "manual") continue; // fica na fila para envio pelo painel
    try {
      const delivered = await deliverMessage(
        channel as "whatsapp" | "sms" | "blip",
        message.toPhone,
        message.body,
        { blip: config.blip, toName: message.toName, kind: message.kind as MessageKind },
      );
      if (!delivered) continue;
      await db
        .update(schema.messages)
        .set({ status: "sent", channel, sentAt: new Date(), error: null })
        .where(eq(schema.messages.id, message.id));
      sent++;
    } catch (error) {
      failed++;
      await db
        .update(schema.messages)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message.slice(0, 300) : "falha no envio",
        })
        .where(eq(schema.messages.id, message.id));
    }
  }

  return { sent, failed };
}

export type MessengerRun = {
  tenants: number;
  reminders: number;
  reactivations: number;
  sent: number;
  failed: number;
  /** Horários espelhados no BlipBeauty (quando o canal é BlipBeauty). */
  synced: number;
};

/** Roda um ciclo completo (todas as unidades ativas, ou apenas uma). */
export async function runMessenger(onlyTenantId?: number): Promise<MessengerRun> {
  const list = await db
    .select()
    .from(schema.tenants)
    .where(
      onlyTenantId
        ? and(eq(schema.tenants.active, true), eq(schema.tenants.id, onlyTenantId))
        : eq(schema.tenants.active, true),
    );

  const result: MessengerRun = {
    tenants: list.length,
    reminders: 0,
    reactivations: 0,
    sent: 0,
    failed: 0,
    synced: 0,
  };

  for (const tenant of list) {
    const config = await messagingConfig(tenant.id);
    const channel = resolveChannel(config);

    // Canal BlipBeauty: quem lembra e reativa é o BlipBeauty. O site só mantém
    // a agenda espelhada lá — nada entra na fila local para não duplicar.
    if (channel === "blip") {
      const sync = await syncTenantToBlip(tenant.id);
      result.synced += sync.agendamentos;
      result.failed += sync.falhas;
      continue;
    }

    result.reminders += await queueReminders(tenant, config, channel);
    result.reactivations += await queueReactivations(tenant, config, channel);
    const dispatched = await dispatchQueue(tenant.id, channel, config);
    result.sent += dispatched.sent;
    result.failed += dispatched.failed;
  }

  return result;
}

const CYCLE_MS = 5 * 60_000;
const FLAG = "__barbearia_messenger_started";

/**
 * Liga o loop do worker uma única vez por processo (sobrevive ao HMR do Vite).
 * Chamado em `api/index.ts`.
 */
export function startMessenger() {
  const globalRef = globalThis as unknown as Record<string, boolean>;
  if (globalRef[FLAG]) return;
  globalRef[FLAG] = true;

  const tick = async () => {
    try {
      const run = await runMessenger();
      if (run.reminders || run.reactivations || run.sent || run.failed || run.synced) {
        console.info(
          `[mensagens] lembretes:${run.reminders} reativações:${run.reactivations} enviadas:${run.sent} falhas:${run.failed} blip:${run.synced}`,
        );
      }
    } catch (error) {
      console.error("[mensagens] ciclo falhou:", error);
    }
  };

  setTimeout(() => void tick(), 15_000).unref?.();
  setInterval(() => void tick(), CYCLE_MS).unref?.();
}

/** Cancela mensagens ainda na fila de um agendamento (ex.: cliente cancelou). */
export async function cancelAppointmentMessages(appointmentId: number) {
  await db
    .update(schema.messages)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(schema.messages.appointmentId, appointmentId),
        eq(schema.messages.status, "queued"),
        isNotNull(schema.messages.appointmentId),
      ),
    );
}
