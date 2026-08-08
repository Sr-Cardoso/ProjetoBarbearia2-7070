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

/** true para sábado/domingo (a barbearia atende seg–sex). */
export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 || day === 6;
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
