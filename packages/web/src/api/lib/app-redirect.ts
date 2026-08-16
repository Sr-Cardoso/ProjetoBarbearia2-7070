/**
 * Redirecionamento do agendamento para o aplicativo próprio da barbearia.
 *
 * Guardado em `settings` (por unidade), com três chaves:
 *  - `appBookingUrl`: link do app (loja, link universal, deep link…);
 *  - `appBookingMode`: `off` (site agenda normalmente), `invite` (a página de
 *    agendamento convida a usar o app, mas deixa continuar no site) ou
 *    `redirect` (a página de agendamento manda direto para o app);
 *  - `appBookingTitle` / `appBookingText`: textos do convite.
 *
 * O link e o QR Code nunca são renderizados na home: só existem no painel, e no
 * site apenas como destino dos botões de agendar.
 */

export const APP_BOOKING_MODES = ["off", "invite", "redirect"] as const;
export type AppBookingMode = (typeof APP_BOOKING_MODES)[number];

export interface AppBookingConfig {
  /** Modo efetivo: cai em `off` quando não há link válido salvo. */
  mode: AppBookingMode;
  url: string;
  title: string;
  text: string;
}

export const APP_BOOKING_DEFAULT_TITLE = "Agende pelo nosso aplicativo";
export const APP_BOOKING_DEFAULT_TEXT =
  "É mais rápido: seus dados ficam salvos e você acompanha seus horários pelo celular.";

/** Só aceita links http(s) ou um esquema de app (ex.: `barbearia://agenda`). */
export function isValidAppUrl(raw: string): boolean {
  const value = raw.trim();
  if (value.length === 0) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return Boolean(url.hostname);
    return /^[a-z][a-z0-9+.-]*:$/i.test(url.protocol);
  } catch {
    return false;
  }
}

function parseMode(raw: string | undefined): AppBookingMode {
  return APP_BOOKING_MODES.includes(raw as AppBookingMode) ? (raw as AppBookingMode) : "off";
}

/** Lê a configuração a partir do mapa de settings da unidade. */
export function readAppBooking(settings: Record<string, string>): AppBookingConfig {
  const url = (settings.appBookingUrl ?? "").trim();
  const valid = isValidAppUrl(url);
  return {
    mode: valid ? parseMode(settings.appBookingMode) : "off",
    url: valid ? url : "",
    title: (settings.appBookingTitle ?? "").trim() || APP_BOOKING_DEFAULT_TITLE,
    text: (settings.appBookingText ?? "").trim() || APP_BOOKING_DEFAULT_TEXT,
  };
}
