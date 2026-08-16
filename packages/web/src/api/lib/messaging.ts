/**
 * Configuração e envio das mensagens automáticas da barbearia.
 *
 * Dois canais são suportados e a escolha fica no painel (aba Mensagens):
 * - `whatsapp`: WhatsApp Cloud API da Meta (token + id do número).
 * - `sms`: Twilio (mesmas credenciais usadas no login por telefone).
 *
 * Sem credencial no `.env`, o canal cai para `manual`: a mensagem continua
 * sendo gerada e fica na fila do painel com um link `wa.me` para o dono
 * enviar com um clique.
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { sendSms, SMS_DEV_MODE } from "./sms";
import { normalizePhone } from "./schedule";
import { BLIP_KEYS, isBlipReady, readBlipConfig, type BlipConfig } from "./blip";

export type MessageChannel = "whatsapp" | "sms" | "blip" | "manual";
export type MessageKind = "reminder" | "reactivation";

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN ?? "";
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";

/** WhatsApp Cloud API configurada? */
export const WHATSAPP_READY = Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID);
/** Twilio configurada? (SMS_DEV_MODE é true quando falta credencial) */
export const SMS_READY = !SMS_DEV_MODE;

/** Chaves de configuração usadas pelas mensagens automáticas. */
export const MESSAGING_KEYS = {
  provider: "messagingProvider",
  reminderEnabled: "reminderEnabled",
  reminderLeadMinutes: "reminderLeadMinutes",
  reactivationEnabled: "reactivationEnabled",
  reactivationDays: "reactivationDays",
  reminderTemplate: "reminderTemplate",
  reactivationTemplate: "reactivationTemplate",
  blipApiUrl: BLIP_KEYS.apiUrl,
  blipApiKey: BLIP_KEYS.apiKey,
} as const;

export const DEFAULT_REMINDER_TEMPLATE =
  "Olá {{cliente}}! Passando para lembrar do seu horário na {{barbearia}} hoje às {{horario}} " +
  "({{servico}} com {{barbeiro}}). Se precisar remarcar, é só responder esta mensagem. Até já!";

export const DEFAULT_REACTIVATION_TEMPLATE =
  "Oi {{cliente}}! Faz {{dias}} dias desde seu último corte na {{barbearia}} e a cadeira está te esperando. " +
  "Quer agendar? Temos estes horários livres: {{horarios}}. Agende em {{link}}";

export type MessagingConfig = {
  provider: MessageChannel;
  reminderEnabled: boolean;
  reminderLeadMinutes: number;
  reactivationEnabled: boolean;
  reactivationDays: number;
  reminderTemplate: string;
  reactivationTemplate: string;
  /** Integração BlipBeauty (URL + API key salvas no painel). */
  blip: BlipConfig;
};

const num = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined || value === "" ? fallback : value === "true" || value === "1";

/** Lê as configurações da unidade (chave/valor) já com os padrões aplicados. */
export async function messagingConfig(tenantId: number): Promise<MessagingConfig> {
  const rows = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.tenantId, tenantId));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;

  const provider = map[MESSAGING_KEYS.provider];
  return {
    provider:
      provider === "whatsapp" || provider === "sms" || provider === "blip" ? provider : "manual",
    reminderEnabled: bool(map[MESSAGING_KEYS.reminderEnabled], true),
    reminderLeadMinutes: num(map[MESSAGING_KEYS.reminderLeadMinutes], 60),
    reactivationEnabled: bool(map[MESSAGING_KEYS.reactivationEnabled], true),
    reactivationDays: num(map[MESSAGING_KEYS.reactivationDays], 30),
    reminderTemplate: map[MESSAGING_KEYS.reminderTemplate]?.trim() || DEFAULT_REMINDER_TEMPLATE,
    reactivationTemplate:
      map[MESSAGING_KEYS.reactivationTemplate]?.trim() || DEFAULT_REACTIVATION_TEMPLATE,
    blip: readBlipConfig(map),
  };
}

/**
 * Canal realmente usável: cai para `manual` quando falta credencial.
 * O BlipBeauty depende da URL + API key salvas no painel da unidade.
 */
export function resolveChannel(config: Pick<MessagingConfig, "provider" | "blip">): MessageChannel {
  if (config.provider === "whatsapp") return WHATSAPP_READY ? "whatsapp" : "manual";
  if (config.provider === "sms") return SMS_READY ? "sms" : "manual";
  if (config.provider === "blip") return isBlipReady(config.blip) ? "blip" : "manual";
  return "manual";
}

/** Troca os marcadores `{{campo}}` pelos valores do agendamento/cliente. */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_match, key: string) => vars[key] ?? "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Link para o dono enviar a mensagem manualmente pelo WhatsApp. */
export function manualWhatsappUrl(phone: string, body: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(body)}`;
}

/** Envia pelo WhatsApp Cloud API (texto livre — exige janela de 24h ou opt-in). */
async function sendWhatsapp(to: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/**
 * Entrega a mensagem no canal escolhido.
 * Retorna `false` quando o canal é manual (nada foi enviado automaticamente).
 */
export async function deliverMessage(
  channel: MessageChannel,
  to: string,
  body: string,
  options: { blip?: BlipConfig; toName?: string; kind?: MessageKind } = {},
): Promise<boolean> {
  // BlipBeauty não recebe "mande esta mensagem": ele recebe a agenda e dispara
  // sozinho (ver lib/blip-sync.ts). Nada é enviado por aqui.
  if (channel === "blip") return false;
  if (channel === "whatsapp") {
    await sendWhatsapp(to, body);
    return true;
  }
  if (channel === "sms") {
    await sendSms(`+${normalizePhone(to)}`, body);
    return true;
  }
  return false;
}
