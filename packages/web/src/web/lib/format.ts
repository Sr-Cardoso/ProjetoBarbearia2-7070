/** Helpers de data/preço no formato brasileiro, usados pelas páginas web. */

export const SLOT_LABELS: Record<string, string> = {
  "08:00": "08:00 - 09:30",
  "09:30": "09:30 - 11:00",
  "11:00": "11:00 - 12:30",
  "13:30": "13:30 - 15:00",
  "15:00": "15:00 - 16:30",
  "16:30": "16:30 - 18:00",
};

export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Date -> "YYYY-MM-DD" no fuso local. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** "2026-08-04" -> "04/08/2026" */
export function formatDateBr(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/** "2026-08-04" -> "terça-feira, 4 de agosto" */
export function formatDateLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function isWeekendISO(iso: string): boolean {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

export interface CalendarCell {
  iso: string;
  day: number;
  currentMonth: boolean;
  disabled: boolean;
}

export const WEEKDAY_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Grade de 6 semanas para o mês, desabilitando passado e fins de semana. */
export function buildCalendar(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  const today = todayISO();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const iso = toISODate(date);
    cells.push({
      iso,
      day: date.getDate(),
      currentMonth: date.getMonth() === month,
      disabled: iso < today || isWeekendISO(iso),
    });
  }
  return cells;
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Só dígitos com DDI, para montar links do WhatsApp. */
export function waNumber(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length <= 11 ? `55${digits}` : digits;
}

/** Máscara progressiva (00) 00000-0000 */
export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  done: "Concluído",
  cancelled: "Cancelado",
};
