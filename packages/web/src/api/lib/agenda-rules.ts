/**
 * Regras de quais dias a agenda está aberta.
 *
 * São dois níveis, os dois editáveis no painel:
 *  - `workDays` (setting da unidade): dias da semana de atendimento;
 *  - `open_days`: liberações pontuais, que abrem uma data específica mesmo
 *    quando ela cai fora dos dias de atendimento (ex.: um sábado de movimento).
 *
 * Fechar um dia continua sendo feito com bloqueio de dia inteiro (`blocks`).
 */

import { and, eq, gte, isNull } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { isPast, parseWorkDays, todayISO, weekdayIndex, weekdayName, workDaysLabel } from "./schedule";

export interface ScheduleRules {
  /** Dias da semana atendidos (0 = domingo). */
  workDays: number[];
  /** Datas liberadas manualmente (YYYY-MM-DD), de hoje em diante. */
  openDates: string[];
}

/** Lê os dias de atendimento e as liberações pontuais da unidade. */
export async function loadScheduleRules(tenantId: number): Promise<ScheduleRules> {
  const [settingRows, openRows] = await Promise.all([
    db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(and(eq(schema.settings.tenantId, tenantId), eq(schema.settings.key, "workDays"))),
    db
      .select({ date: schema.openDays.date })
      .from(schema.openDays)
      .where(and(eq(schema.openDays.tenantId, tenantId), gte(schema.openDays.date, todayISO()))),
  ]);

  return {
    workDays: parseWorkDays(settingRows[0]?.value),
    openDates: openRows.map((row) => row.date),
  };
}

/** A data está dentro dos dias de atendimento ou foi liberada no painel? */
export function isOpenDate(date: string, rules: ScheduleRules): boolean {
  return rules.openDates.includes(date) || rules.workDays.includes(weekdayIndex(date));
}

/** Motivo de a data estar fechada, ou null quando a agenda está aberta. */
export function closedReason(date: string, rules: ScheduleRules): string | null {
  if (isPast(date)) return "Essa data já passou.";
  if (isOpenDate(date, rules)) return null;
  return `Não atendemos ${weekdayName(date)}. Atendemos ${workDaysLabel(rules.workDays)}.`;
}

/** Datas com bloqueio de dia inteiro para todos os barbeiros, de hoje em diante. */
export async function fullDayClosedDates(tenantId: number): Promise<string[]> {
  const rows = await db
    .select({ date: schema.blocks.date })
    .from(schema.blocks)
    .where(
      and(
        eq(schema.blocks.tenantId, tenantId),
        gte(schema.blocks.date, todayISO()),
        isNull(schema.blocks.slot),
        isNull(schema.blocks.barberId),
      ),
    );
  return [...new Set(rows.map((row) => row.date))];
}
