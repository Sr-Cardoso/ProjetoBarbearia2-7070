/**
 * API de **leitura** para o app BlipBeauty.
 *
 * O BlipBeauty precisa ver a agenda e os telefones dos clientes para disparar
 * as mensagens. Em vez de abrir esses dados no site, expomos rotas HTTP
 * dedicadas em `/api/blip/*`, protegidas por um token gerado no painel
 * (`settings.blipInboundToken`, um por unidade).
 *
 * Regras:
 * - Sem token cadastrado, nenhuma rota responde (401) — o padrão é fechado.
 * - O token identifica a unidade: não existe parâmetro de tenant na URL, então
 *   um token nunca alcança a agenda de outra unidade.
 * - Toda consulta filtra `tenantId`.
 * - Nada de credencial nossa (API key de saída, senha do painel) sai por aqui.
 */
import type { Hono } from "hono";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { BLIP_KEYS, safeInboundTokenEqual } from "./blip";
import { BUSY_STATUSES, addDaysISO, daysBetweenISO, isValidDate, todayISO } from "./schedule";

type BlipTenant = { id: number; name: string; domain: string };

/** Lê o token enviado pelo BlipBeauty (Bearer, x-api-key ou ?token=). */
function readToken(authorization: string | undefined, apiKey: string | undefined, url: string) {
  const bearer = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  if (apiKey?.trim()) return apiKey.trim();
  try {
    return new URL(url).searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}

/**
 * Resolve a unidade pelo token. Compara em tempo constante contra cada token
 * cadastrado (são poucas unidades) e devolve `null` quando nada bate.
 */
async function tenantFromToken(token: string): Promise<BlipTenant | null> {
  if (token.length < 16) return null;
  const rows = await db
    .select({ tenantId: schema.settings.tenantId, value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, BLIP_KEYS.inboundToken));

  const match = rows.find((row) => safeInboundTokenEqual(token, row.value));
  if (!match) return null;

  const [tenant] = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name, domain: schema.tenants.domain })
    .from(schema.tenants)
    .where(and(eq(schema.tenants.id, match.tenantId), eq(schema.tenants.active, true)));
  return tenant ?? null;
}

const clampInt = (raw: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

/** Registra as rotas de leitura do BlipBeauty no app Hono. */
export function registerBlipApi(app: Hono) {
  /**
   * Autentica a requisição e devolve a unidade dona do token.
   * Devolve `null` quando o token é inválido — o handler responde 401.
   */
  async function authorize(c: {
    req: { header: (name: string) => string | undefined; url: string };
  }): Promise<BlipTenant | null> {
    const token = readToken(c.req.header("authorization"), c.req.header("x-api-key"), c.req.url);
    return await tenantFromToken(token);
  }

  const denied = { error: "unauthorized", message: "Token inválido ou acesso não liberado no painel." } as const;

  /** Confirma o token e diz de qual unidade ele é. */
  app.get("/api/blip/ping", async (c) => {
    const tenant = await authorize(c);
    if (!tenant) return c.json(denied, 401);
    return c.json(
      {
        ok: true,
        unidade: { id: tenant.id, nome: tenant.name, dominio: tenant.domain },
        hoje: todayISO(),
      },
      200,
    );
  });

  /**
   * Agenda de um período (padrão: hoje até 7 dias à frente).
   * `GET /api/blip/agenda?from=2026-08-09&to=2026-08-16&status=pending,confirmed`
   */
  app.get("/api/blip/agenda", async (c) => {
    const tenant = await authorize(c);
    if (!tenant) return c.json(denied, 401);
    const from = c.req.query("from");
    const to = c.req.query("to");
    const start = from && isValidDate(from) ? from : todayISO();
    const end = to && isValidDate(to) ? to : addDaysISO(start, 7);
    if (end < start) {
      return c.json({ error: "bad_request", message: "`to` é anterior a `from`." }, 400);
    }

    const statusParam = (c.req.query("status") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => ["pending", "confirmed", "done", "cancelled"].includes(s));

    const rows = await db
      .select({
        id: schema.appointments.id,
        data: schema.appointments.date,
        horario: schema.appointments.slot,
        status: schema.appointments.status,
        cliente: schema.appointments.customerName,
        telefone: schema.appointments.customerPhone,
        observacao: schema.appointments.notes,
        servico: schema.services.name,
        duracaoMin: schema.services.durationMin,
        precoCentavos: schema.services.priceCents,
        barbeiro: schema.barbers.name,
        criadoEm: schema.appointments.createdAt,
      })
      .from(schema.appointments)
      .innerJoin(schema.services, eq(schema.services.id, schema.appointments.serviceId))
      .innerJoin(schema.barbers, eq(schema.barbers.id, schema.appointments.barberId))
      .where(
        and(
          eq(schema.appointments.tenantId, tenant.id),
          gte(schema.appointments.date, start),
          lte(schema.appointments.date, end),
          statusParam.length > 0
            ? inArray(schema.appointments.status, statusParam)
            : undefined,
        ),
      )
      .orderBy(asc(schema.appointments.date), asc(schema.appointments.slot))
      .limit(500);

    return c.json(
      {
        unidade: tenant.name,
        periodo: { de: start, ate: end },
        total: rows.length,
        agendamentos: rows.map((row) => ({
          ...row,
          criadoEm: row.criadoEm instanceof Date ? row.criadoEm.toISOString() : row.criadoEm,
        })),
      },
      200,
    );
  });

  /**
   * Clientes parados há X dias (padrão 30) — base da reativação.
   * `GET /api/blip/clientes?inativosDias=30`
   */
  app.get("/api/blip/clientes", async (c) => {
    const tenant = await authorize(c);
    if (!tenant) return c.json(denied, 401);
    const dias = clampInt(c.req.query("inativosDias"), 30, 1, 720);
    const hoje = todayISO();
    const corte = addDaysISO(hoje, -dias);

    const rows = await db
      .select({
        telefone: schema.appointments.customerPhone,
        cliente: sql<string>`max(${schema.appointments.customerName})`,
        ultimaVisita: sql<string>`max(${schema.appointments.date})`,
        visitas: sql<number>`count(*)`,
      })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.tenantId, tenant.id),
          inArray(schema.appointments.status, [...BUSY_STATUSES]),
        ),
      )
      .groupBy(schema.appointments.customerPhone);

    const inativos = rows
      .filter((row) => row.telefone && row.ultimaVisita <= corte)
      .map((row) => ({
        cliente: row.cliente,
        telefone: row.telefone,
        ultimaVisita: row.ultimaVisita,
        diasParado: daysBetweenISO(hoje, row.ultimaVisita),
        visitas: Number(row.visitas),
      }))
      .sort((a, b) => b.diasParado - a.diasParado)
      .slice(0, 500);

    return c.json(
      { unidade: tenant.name, inativosDias: dias, total: inativos.length, clientes: inativos },
      200,
    );
  });

  /**
   * Fila de mensagens que o painel gerou e ainda não foram enviadas.
   * `GET /api/blip/fila?status=queued&limit=50`
   */
  app.get("/api/blip/fila", async (c) => {
    const tenant = await authorize(c);
    if (!tenant) return c.json(denied, 401);
    const status = c.req.query("status");
    const limit = clampInt(c.req.query("limit"), 50, 1, 200);
    const wanted = ["queued", "sent", "failed", "cancelled"].includes(status ?? "")
      ? status!
      : "queued";

    const rows = await db
      .select({
        id: schema.messages.id,
        tipo: schema.messages.kind,
        telefone: schema.messages.toPhone,
        cliente: schema.messages.toName,
        mensagem: schema.messages.body,
        status: schema.messages.status,
        agendarPara: schema.messages.scheduledFor,
        agendamentoId: schema.messages.appointmentId,
      })
      .from(schema.messages)
      .where(
        and(eq(schema.messages.tenantId, tenant.id), eq(schema.messages.status, wanted)),
      )
      .orderBy(asc(schema.messages.scheduledFor), desc(schema.messages.id))
      .limit(limit);

    return c.json(
      {
        unidade: tenant.name,
        status: wanted,
        total: rows.length,
        mensagens: rows.map((row) => ({
          ...row,
          agendarPara:
            row.agendarPara instanceof Date ? row.agendarPara.toISOString() : row.agendarPara,
        })),
      },
      200,
    );
  });

  /**
   * O BlipBeauty avisa o resultado do envio de uma mensagem da fila.
   * `POST /api/blip/fila/:id` com `{ "status": "sent" }` ou
   * `{ "status": "failed", "error": "número inválido" }`.
   */
  app.post("/api/blip/fila/:id", async (c) => {
    const tenant = await authorize(c);
    if (!tenant) return c.json(denied, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: "bad_request", message: "Id inválido." }, 400);
    }

    const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
    const status = String((body as { status?: unknown }).status ?? "sent");
    if (status !== "sent" && status !== "failed") {
      return c.json({ error: "bad_request", message: "status deve ser sent ou failed." }, 400);
    }
    const error =
      status === "failed"
        ? String((body as { error?: unknown }).error ?? "falha informada pelo BlipBeauty").slice(
            0,
            300,
          )
        : null;

    const [updated] = await db
      .update(schema.messages)
      .set({
        status,
        error,
        sentAt: status === "sent" ? new Date() : null,
        channel: "blip",
      })
      .where(and(eq(schema.messages.id, id), eq(schema.messages.tenantId, tenant.id)))
      .returning({ id: schema.messages.id, status: schema.messages.status });

    if (!updated) {
      return c.json({ error: "not_found", message: "Mensagem não encontrada." }, 404);
    }
    return c.json({ ok: true, id: updated.id, status: updated.status }, 200);
  });
}
