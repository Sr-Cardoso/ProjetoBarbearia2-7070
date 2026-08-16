/**
 * Regras de agenda da Barbearia Cardoso.
 * Atendimento de segunda a sexta, em blocos fixos de 1h30, das 08:00 às 18:00.
 */

export const SLOTS = [
  "08:00",
  "09:30",
  "11:00",
  "13:30",
  "15:00",
  "16:30",
] as const;

export const SLOT_MINUTES = 90;

/** Status que ocupam a agenda (cancelado libera o horário). */
export const BUSY_STATUSES = ["pending", "confirmed", "done"] as const;

/** "08:00" -> "08:00 - 09:30" */
export function slotRange(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const end = h * 60 + m + SLOT_MINUTES;
  const eh = String(Math.floor(end / 60)).padStart(2, "0");
  const em = String(end % 60).padStart(2, "0");
  return `${slot} - ${eh}:${em}`;
}

/** Aceita apenas datas YYYY-MM-DD. */
export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00`));
}

/** Dias de atendimento padrão quando a unidade não configurou nada (0 = domingo). */
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

/** Dia da semana da data (0 = domingo ... 6 = sábado). */
export function weekdayIndex(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

/** "1,2,3,4,5" -> [1,2,3,4,5]. Valor inválido/vazio cai no padrão seg–sex. */
export function parseWorkDays(raw: string | null | undefined): number[] {
  const days = (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_WORK_DAYS];
}

/** [1,2,3,4,5] -> "1,2,3,4,5" */
export function serializeWorkDays(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

const WEEKDAYS_SHORT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** [1,2,3,4,5] -> "de segunda a sexta"; [1,3,6] -> "segunda, quarta e sábado". */
export function workDaysLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "sob agendamento liberado";
  if (sorted.length === 7) return "todos os dias";
  const sequential = sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1);
  if (sequential && sorted.length >= 3) {
    return `de ${WEEKDAYS_SHORT[sorted[0]]} a ${WEEKDAYS_SHORT[sorted[sorted.length - 1]]}`;
  }
  const names = sorted.map((day) => WEEKDAYS_SHORT[day]);
  if (names.length === 1) return `só ${names[0]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function weekdayName(date: string): string {
  return WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
}

/** Data local de hoje em YYYY-MM-DD (fuso de São Paulo). */
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Já passou (data anterior a hoje)? */
export function isPast(date: string): boolean {
  return date < todayISO();
}

/** Fuso fixo do Brasil (São Paulo, sem horário de verão desde 2019). */
export const TZ_OFFSET = "-03:00";

/** Instante (ms) em que o bloco começa — usado pelos lembretes automáticos. */
export function slotStartMs(date: string, slot: string): number {
  return new Date(`${date}T${slot}:00${TZ_OFFSET}`).getTime();
}

/** Soma (ou subtrai) dias de uma data YYYY-MM-DD. */
export function addDaysISO(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00${TZ_OFFSET}`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Diferença em dias entre duas datas YYYY-MM-DD (a - b). */
export function daysBetweenISO(a: string, b: string): number {
  const diff = new Date(`${a}T12:00:00${TZ_OFFSET}`).getTime() - new Date(`${b}T12:00:00${TZ_OFFSET}`).getTime();
  return Math.round(diff / 86_400_000);
}

/** Formata centavos como R$ 45,00 */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Só dígitos, com DDI 55 quando o número vem no formato nacional. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}
