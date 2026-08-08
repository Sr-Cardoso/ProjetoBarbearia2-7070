import { and, eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";

export interface TenantConfig {
  id: number;
  domain: string;
  name: string;
  adminEmails: string[];
}

/** Domínio usado quando o host não casa com nenhuma unidade (localhost, preview, mobile). */
export const DEFAULT_TENANT_DOMAIN = process.env.DEFAULT_TENANT_DOMAIN ?? "drcglobal.store";

/** Normaliza o host: sem porta, sem www., minúsculo. */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .split(":")[0]!
    .replace(/^www\./, "");
}

/** Extrai o domínio da requisição (headers do oRPC/Hono). */
export function getTenantFromHost(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-host");
  const host = forwarded ?? headers.get("host") ?? "";
  return host ? normalizeDomain(host) : DEFAULT_TENANT_DOMAIN;
}

/** Unidade padrão — criada sob demanda para nunca deixar o app sem tenant. */
async function ensureDefaultTenant() {
  const [existing] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.domain, DEFAULT_TENANT_DOMAIN));
  if (existing) return existing;

  const [created] = await db
    .insert(schema.tenants)
    .values({ domain: DEFAULT_TENANT_DOMAIN, name: "Barbearia Cardoso" })
    .returning();
  return created!;
}

/** Busca a unidade pelo domínio; cai na unidade padrão se não houver cadastro. */
export async function getTenantByDomain(domain: string) {
  const normalized = normalizeDomain(domain);
  const [found] = await db
    .select()
    .from(schema.tenants)
    .where(and(eq(schema.tenants.domain, normalized), eq(schema.tenants.active, true)));
  if (found) return found;
  return ensureDefaultTenant();
}

/** Unidade resolvida a partir dos headers da requisição. */
export async function resolveTenant(headers: Headers) {
  return getTenantByDomain(getTenantFromHost(headers));
}

/** E-mails autorizados de uma unidade (inclui super admins, que acessam todas). */
export async function tenantAdminEmails(tenantId: number): Promise<string[]> {
  const rows = await db.select().from(schema.tenantAdmins);
  return rows
    .filter((r) => r.superAdmin || r.tenantId === tenantId)
    .map((r) => r.email.toLowerCase());
}

/** Valida se um e-mail tem privilégio de administrador no domínio consultado. */
export async function validateTenantAdmin(domain: string, email: string): Promise<boolean> {
  const tenant = await getTenantByDomain(domain);
  const emails = await tenantAdminEmails(tenant.id);
  return emails.includes(email.trim().toLowerCase());
}

/** É super admin (gerencia todas as unidades)? */
export async function isSuperAdmin(email: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(schema.tenantAdmins)
    .where(
      and(eq(schema.tenantAdmins.email, email.trim().toLowerCase()), eq(schema.tenantAdmins.superAdmin, true)),
    );
  return rows.length > 0;
}

/** Config no formato exposto ao front. */
export async function tenantConfig(tenantId: number): Promise<TenantConfig> {
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
  const emails = await db
    .select()
    .from(schema.tenantAdmins)
    .where(eq(schema.tenantAdmins.tenantId, tenantId));
  return {
    id: tenant!.id,
    domain: tenant!.domain,
    name: tenant!.name,
    adminEmails: emails.map((e) => e.email),
  };
}
