/**
 * Integração com o serviço externo **BlipBeauty**.
 *
 * O dono cadastra no painel a URL da API e a API key; a chave fica guardada em
 * `settings` (por unidade) e **nunca** volta inteira para o navegador — o painel
 * recebe apenas uma versão mascarada (`••••••••3f9a`).
 *
 * Quando o canal escolhido nas mensagens automáticas é `blip`, cada mensagem da
 * fila é entregue com um POST para a URL cadastrada. Sem URL ou sem chave o
 * canal cai para `manual` e a mensagem continua na fila do painel.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { normalizePhone } from "./schedule";

/** Chaves de `settings` usadas pela integração. */
export const BLIP_KEYS = {
  apiUrl: "blipApiUrl",
  apiKey: "blipApiKey",
  /**
   * Token de **entrada**: é o que o BlipBeauty manda para nós ao ler a agenda.
   * Não reaproveita `apiKey` (essa é a chave de saída, nossa chamada para eles)
   * — assim revogar um lado não derruba o outro.
   */
  inboundToken: "blipInboundToken",
} as const;

/** Prefixo das chaves secretas — nunca sai pelas rotas públicas. */
export const BLIP_SETTINGS_PREFIX = "blip";

export type BlipConfig = {
  apiUrl: string;
  apiKey: string;
};

/** URL válida para a API do BlipBeauty (só http/https com host). */
export function isValidBlipUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 2;
  } catch {
    return false;
  }
}

/** A chave tem cara de chave? (evita salvar espaço em branco ou lixo curto) */
export function isValidBlipKey(value: string): boolean {
  return value.trim().length >= 12 && !/\s/.test(value.trim());
}

/** URL + chave cadastradas e válidas? */
export function isBlipReady(config: BlipConfig): boolean {
  return isValidBlipUrl(config.apiUrl) && isValidBlipKey(config.apiKey);
}

/** Versão segura para exibir no painel: só os 4 últimos caracteres. */
export function maskBlipKey(value: string): string {
  const key = value.trim();
  if (!key) return "";
  if (key.length <= 4) return "••••";
  return `${"•".repeat(Math.min(12, key.length - 4))}${key.slice(-4)}`;
}

/** Monta a configuração a partir do mapa de `settings` da unidade. */
export function readBlipConfig(map: Record<string, string | undefined>): BlipConfig {
  return {
    apiUrl: map[BLIP_KEYS.apiUrl]?.trim() ?? "",
    apiKey: map[BLIP_KEYS.apiKey]?.trim() ?? "",
  };
}

/** Gera um token de entrada novo (48 caracteres hex, sem ambiguidade). */
export function generateInboundToken(): string {
  return randomBytes(24).toString("hex");
}

/** Compara tokens em tempo constante (evita descobrir o token aos poucos). */
export function safeInboundTokenEqual(
  candidate: string | null | undefined,
  expected: string,
): boolean {
  if (!candidate || expected.length < 16) return false;
  const a = Buffer.from(candidate.trim());
  const b = Buffer.from(expected.trim());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Mostra só o começo e o fim do token no painel. */
export function maskInboundToken(value: string): string {
  const token = value.trim();
  if (!token) return "";
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 6)}${"•".repeat(10)}${token.slice(-4)}`;
}

/* --------------------------------------------------------------- chamadas */

/** Junta a URL base salva no painel (`https://.../api/v1`) com o caminho. */
function blipEndpoint(apiUrl: string, path: string): string {
  return `${apiUrl.trim().replace(/\/+$/, "")}${path}`;
}

/**
 * Chamada crua à API do BlipBeauty.
 * A chave vai em `Authorization: Bearer` e também em `x-api-key`.
 * O BlipBeauty responde `{ ok: false, error }` com status 200 em alguns casos,
 * então o erro é lido dos dois lugares.
 */
async function blipRequest<T>(
  config: BlipConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs = 15_000,
): Promise<T> {
  if (!isBlipReady(config)) {
    throw new Error("BlipBeauty sem URL ou sem API key cadastradas no painel.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(blipEndpoint(config.apiUrl, path), {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "x-api-key": config.apiKey,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const payload = (json ?? {}) as { ok?: boolean; error?: string };

    if (!res.ok || payload.ok === false) {
      throw new Error(
        payload.error?.slice(0, 300) ?? `BlipBeauty ${res.status}: ${text.slice(0, 200)}`,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("BlipBeauty não respondeu em 15s.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export type BlipPing = {
  ok: true;
  businessName?: string;
  timezone?: string;
  provider?: string;
  providerLabel?: string;
  providerReady?: boolean;
  sendMode?: string;
  autoActive?: boolean;
  inQuietHours?: boolean;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  reactivationEnabled?: boolean;
  inactiveDays?: number;
  aiEnabled?: boolean;
};

/** `GET /ping` — confirma a chave e devolve o estado do BlipBeauty. */
export async function blipPing(config: BlipConfig): Promise<BlipPing> {
  return await blipRequest<BlipPing>(config, "GET", "/ping");
}

/**
 * Teste de conexão do painel. Nunca lança: devolve pronto para exibir.
 */
export async function testBlipConnection(
  config: BlipConfig,
): Promise<{ ok: boolean; error?: string; info?: BlipPing }> {
  try {
    const info = await blipPing(config);
    return { ok: true, info };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "falha na conexão" };
  }
}

/** Status do agendamento no vocabulário do BlipBeauty. */
export function toBlipStatus(status: string): "scheduled" | "done" | "canceled" | "noshow" {
  if (status === "done") return "done";
  if (status === "cancelled" || status === "canceled") return "canceled";
  if (status === "noshow" || status === "no_show") return "noshow";
  return "scheduled";
}

export type BlipClientInput = {
  name: string;
  phone: string;
  notes?: string;
  externalId?: string;
};

/** `POST /clients` — cadastra ou atualiza o cliente lá (upsert por telefone). */
export async function pushBlipClient(config: BlipConfig, client: BlipClientInput): Promise<void> {
  await blipRequest(config, "POST", "/clients", {
    name: client.name,
    phone: normalizePhone(client.phone),
    notes: client.notes || undefined,
    externalId: client.externalId,
  });
}

export type BlipAppointmentInput = {
  /** Início do horário em ISO (UTC). */
  startsAt: string;
  clientName: string;
  clientPhone: string;
  serviceName?: string;
  staffName?: string;
  durationMin?: number;
  /** Preço em centavos. */
  price?: number;
  status: string;
  notes?: string;
  externalId: string;
};

/** `POST /appointments` — cadastra ou atualiza o horário lá (upsert por externalId). */
export async function pushBlipAppointment(
  config: BlipConfig,
  appointment: BlipAppointmentInput,
): Promise<void> {
  await blipRequest(config, "POST", "/appointments", {
    startsAt: appointment.startsAt,
    clientName: appointment.clientName,
    clientPhone: normalizePhone(appointment.clientPhone),
    serviceName: appointment.serviceName || undefined,
    staffName: appointment.staffName || undefined,
    durationMin: appointment.durationMin,
    price: appointment.price,
    status: toBlipStatus(appointment.status),
    notes: appointment.notes || undefined,
    externalId: appointment.externalId,
  });
}
