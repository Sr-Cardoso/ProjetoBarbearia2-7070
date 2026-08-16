/**
 * Envio da agenda para o app **BlipBeauty**.
 *
 * A API do BlipBeauty (`/api/v1`) não recebe "mande esta mensagem": ela recebe
 * **clientes** (`POST /clients`) e **horários** (`POST /appointments`) e cuida
 * sozinha do lembrete, da reativação, do horário de silêncio e do disparo no
 * WhatsApp. Então o papel do site é manter a agenda espelhada lá.
 *
 * - Cada horário vai com `externalId` = `bc-<id do agendamento>`, então reenviar
 *   atualiza em vez de duplicar (o BlipBeauty responde `created: false`).
 * - `syncAppointmentToBlip` é chamado quando um horário é criado ou muda de
 *   status; falha nunca quebra o agendamento (só registra no log).
 * - `syncTenantToBlip` reenvia o período todo — é o botão "Sincronizar agora"
 *   do painel e também roda no ciclo do worker quando o canal é BlipBeauty.
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { isBlipReady, pushBlipAppointment, pushBlipClient, type BlipConfig } from "./blip";
import { messagingConfig } from "./messaging";
import { addDaysISO, slotStartMs, todayISO } from "./schedule";

/** Quantos dias para trás e para frente são espelhados no BlipBeauty. */
const PAST_DAYS = 180;
const FUTURE_DAYS = 90;
/** Teto de horários por sincronização (evita rodada infinita). */
const MAX_ROWS = 300;

export type BlipSyncResult = {
  ok: boolean;
  /** Motivo quando `ok` é falso (ex.: sem credencial). */
  reason?: string;
  clientes: number;
  agendamentos: number;
  falhas: number;
  /** Primeiro erro encontrado, para exibir no painel. */
  erro?: string;
};

const externalId = (appointmentId: number) => `bc-${appointmentId}`;

type Row = {
  id: number;
  date: string;
  slot: string;
  status: string;
  customerName: string;
  customerPhone: string;
  notes: string | null;
  serviceName: string;
  durationMin: number;
  priceCents: number;
  barberName: string;
};

/** Manda um horário (e o cliente dele) para o BlipBeauty. */
async function pushRow(config: BlipConfig, row: Row): Promise<void> {
  await pushBlipClient(config, {
    name: row.customerName,
    phone: row.customerPhone,
    externalId: `bc-cli-${row.customerPhone.replace(/\D/g, "")}`,
  });
  await pushBlipAppointment(config, {
    startsAt: new Date(slotStartMs(row.date, row.slot)).toISOString(),
    clientName: row.customerName,
    clientPhone: row.customerPhone,
    serviceName: row.serviceName,
    staffName: row.barberName,
    durationMin: row.durationMin,
    price: row.priceCents,
    status: row.status,
    notes: row.notes ?? undefined,
    externalId: externalId(row.id),
  });
}

/** Busca os horários da unidade em um período, já com serviço e barbeiro. */
async function loadRows(tenantId: number, from: string, to: string, onlyId?: number) {
  return await db
    .select({
      id: schema.appointments.id,
      date: schema.appointments.date,
      slot: schema.appointments.slot,
      status: schema.appointments.status,
      customerName: schema.appointments.customerName,
      customerPhone: schema.appointments.customerPhone,
      notes: schema.appointments.notes,
      serviceName: schema.services.name,
      durationMin: schema.services.durationMin,
      priceCents: schema.services.priceCents,
      barberName: schema.barbers.name,
    })
    .from(schema.appointments)
    .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
    .innerJoin(schema.barbers, eq(schema.barbers.id, schema.appointments.barberId))
    .where(
      and(
        eq(schema.appointments.tenantId, tenantId),
        onlyId ? eq(schema.appointments.id, onlyId) : gte(schema.appointments.date, from),
        onlyId ? undefined : lte(schema.appointments.date, to),
      ),
    )
    .limit(onlyId ? 1 : MAX_ROWS);
}

/**
 * Espelha um agendamento no BlipBeauty. Silencioso de propósito: usado em
 * "fire and forget" depois de criar ou mudar o status de um horário.
 */
export async function syncAppointmentToBlip(tenantId: number, appointmentId: number) {
  try {
    const config = await messagingConfig(tenantId);
    if (config.provider !== "blip" || !isBlipReady(config.blip)) return;
    const [row] = await loadRows(tenantId, "", "", appointmentId);
    if (!row) return;
    await pushRow(config.blip, row);
  } catch (error) {
    console.error(
      `[blip] falha ao espelhar o agendamento ${appointmentId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Reenvia a agenda inteira do período para o BlipBeauty. */
export async function syncTenantToBlip(tenantId: number): Promise<BlipSyncResult> {
  const config = await messagingConfig(tenantId);
  if (!isBlipReady(config.blip)) {
    return {
      ok: false,
      reason: "Cadastre a URL da API e a API key do BlipBeauty antes de sincronizar.",
      clientes: 0,
      agendamentos: 0,
      falhas: 0,
    };
  }

  const today = todayISO();
  const rows = await loadRows(tenantId, addDaysISO(today, -PAST_DAYS), addDaysISO(today, FUTURE_DAYS));

  const phones = new Set<string>();
  let agendamentos = 0;
  let falhas = 0;
  let erro: string | undefined;

  for (const row of rows) {
    if (!row.customerPhone?.trim()) continue;
    try {
      await pushRow(config.blip, row);
      phones.add(row.customerPhone.replace(/\D/g, ""));
      agendamentos++;
    } catch (error) {
      falhas++;
      erro ??= error instanceof Error ? error.message : "falha no envio";
    }
  }

  return { ok: falhas === 0, clientes: phones.size, agendamentos, falhas, erro };
}

/** Status dos agendamentos que valem espelhar quando o horário muda. */
export const SYNCABLE_STATUSES = ["pending", "confirmed", "done", "cancelled"] as const;

/** Existe algum agendamento na unidade? (usado só em diagnóstico) */
export async function hasAppointments(tenantId: number): Promise<boolean> {
  const rows = await db
    .select({ id: schema.appointments.id })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.tenantId, tenantId),
        inArray(schema.appointments.status, [...SYNCABLE_STATUSES]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
