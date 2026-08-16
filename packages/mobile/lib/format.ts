import Constants from "expo-constants";

/** Origem da API/web, usada para montar URLs absolutas de imagens. */
export const WEB_ORIGIN = String(
  Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? "",
).replace(/\/$/, "");

export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${WEB_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SLOT_LABELS: Record<string, string> = {
  "08:00": "08:00 - 09:30",
  "09:30": "09:30 - 11:00",
  "11:00": "11:00 - 12:30",
  "13:30": "13:30 - 15:00",
  "15:00": "15:00 - 16:30",
  "16:30": "16:30 - 18:00",
};

export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function weekdayShort(iso: string): string {
  return WEEKDAYS[new Date(`${iso}T12:00:00`).getDay()] ?? "";
}

export function dayMonth(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateLong(iso: string): string {
  return `${weekdayShort(iso)}, ${dayMonth(iso)}`;
}

/** Dias de atendimento vindos da API (booking.schedule). */
export interface ScheduleRules {
  workDays: number[];
  openDates: string[];
  closedDates: string[];
}

/**
 * Próximos dias em que a agenda abre: dias fixos de atendimento mais as
 * liberações feitas no painel, tirando os dias fechados.
 */
export function nextOpenDays(count: number, rules?: ScheduleRules): string[] {
  if (!rules) return [];
  const workDays = rules.workDays;
  const openDates = new Set(rules.openDates);
  const closedDates = new Set(rules.closedDates);

  const out: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < 120 && out.length < count; i++) {
    const iso = toISODate(cursor);
    const open = openDates.has(iso) || workDays.includes(cursor.getDay());
    if (open && !closedDates.has(iso)) out.push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
