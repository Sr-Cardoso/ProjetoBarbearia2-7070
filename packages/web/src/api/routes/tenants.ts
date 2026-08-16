import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import { adminBase } from "../middleware/auth";
import { normalizeDomain } from "../lib/tenant";
import {
  DEFAULT_SECTIONS,
  INTEGRATION_REQUEST_KEY,
  parseIntegrationRequest,
  parseSections,
  SECTIONS,
  serializeSections,
} from "../lib/permissions";

/** Só super admin gerencia unidades. */
const superAdmin = adminBase.use(async ({ context, next }) => {
  if (!context.admin.superAdmin) {
    throw new ORPCError("FORBIDDEN", { message: "Apenas o super admin gerencia unidades." });
  }
  return next();
});

export const tenants = {
  /** Unidades com seus usuários liberados e o pedido de integração pendente. */
  list: superAdmin.handler(async () => {
    const [rows, admins, requests] = await Promise.all([
      db.select().from(schema.tenants).orderBy(asc(schema.tenants.id)),
      db.select().from(schema.tenantAdmins),
      db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, INTEGRATION_REQUEST_KEY)),
    ]);
    return rows.map((tenant) => ({
      ...tenant,
      admins: admins
        .filter((a) => a.tenantId === tenant.id)
        .map((a) => ({ ...a, sections: parseSections(a.sections) })),
      integrationRequest: parseIntegrationRequest(
        requests.find((r) => r.tenantId === tenant.id)?.value,
      ),
    }));
  }),

  save: superAdmin
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        domain: z.string().trim().min(3),
        name: z.string().trim().min(2),
        active: z.boolean().default(true),
      }),
    )
    .handler(async ({ input }) => {
      const domain = normalizeDomain(input.domain);
      if (input.id) {
        const [updated] = await db
          .update(schema.tenants)
          .set({ domain, name: input.name, active: input.active })
          .where(eq(schema.tenants.id, input.id))
          .returning();
        return updated;
      }
      const [existing] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.domain, domain));
      if (existing) {
        throw new ORPCError("CONFLICT", { message: "Esse domínio já está cadastrado." });
      }
      const [created] = await db
        .insert(schema.tenants)
        .values({ domain, name: input.name, active: input.active })
        .returning();
      return created;
    }),

  remove: superAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input }) => {
      const used = await db
        .select({ id: schema.appointments.id })
        .from(schema.appointments)
        .where(eq(schema.appointments.tenantId, input.id))
        .limit(1);
      if (used.length > 0) {
        await db
          .update(schema.tenants)
          .set({ active: false })
          .where(eq(schema.tenants.id, input.id));
        return { ok: true, deactivated: true };
      }
      await db.delete(schema.tenantAdmins).where(eq(schema.tenantAdmins.tenantId, input.id));
      await db.delete(schema.services).where(eq(schema.services.tenantId, input.id));
      await db.delete(schema.barbers).where(eq(schema.barbers.tenantId, input.id));
      await db.delete(schema.blocks).where(eq(schema.blocks.tenantId, input.id));
      await db.delete(schema.settings).where(eq(schema.settings.tenantId, input.id));
      await db.delete(schema.tenants).where(eq(schema.tenants.id, input.id));
      return { ok: true, deactivated: false };
    }),

  /**
   * Libera o acesso de um e-mail Google na unidade, já com as áreas marcadas.
   * Reenviar o mesmo e-mail atualiza as áreas em vez de duplicar o cadastro.
   */
  addAdmin: superAdmin
    .input(
      z.object({
        tenantId: z.number().int().positive(),
        email: z.string().trim().email("E-mail inválido"),
        name: z.string().trim().max(80).default(""),
        superAdmin: z.boolean().default(false),
        sections: z.array(z.enum(SECTIONS)).default(DEFAULT_SECTIONS),
        canIntegrations: z.boolean().default(false),
      }),
    )
    .handler(async ({ input }) => {
      const email = input.email.toLowerCase();
      const sections = serializeSections(input.sections);
      const [existing] = await db
        .select()
        .from(schema.tenantAdmins)
        .where(
          and(
            eq(schema.tenantAdmins.tenantId, input.tenantId),
            eq(schema.tenantAdmins.email, email),
          ),
        );
      if (existing) {
        const [updated] = await db
          .update(schema.tenantAdmins)
          .set({
            name: input.name || existing.name,
            sections,
            canIntegrations: input.canIntegrations,
          })
          .where(eq(schema.tenantAdmins.id, existing.id))
          .returning();
        return { ...updated!, sections: parseSections(updated!.sections) };
      }
      const [created] = await db
        .insert(schema.tenantAdmins)
        .values({
          tenantId: input.tenantId,
          email,
          name: input.name,
          superAdmin: input.superAdmin,
          sections,
          canIntegrations: input.canIntegrations,
        })
        .returning();
      return { ...created!, sections: parseSections(created!.sections) };
    }),

  /** Troca as áreas liberadas (e o direito de integração) de um usuário. */
  setAdminAccess: superAdmin
    .input(
      z.object({
        id: z.number().int().positive(),
        sections: z.array(z.enum(SECTIONS)),
        canIntegrations: z.boolean().default(false),
        name: z.string().trim().max(80).optional(),
      }),
    )
    .handler(async ({ input }) => {
      const [row] = await db
        .select()
        .from(schema.tenantAdmins)
        .where(eq(schema.tenantAdmins.id, input.id));
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Usuário não encontrado." });
      if (row.superAdmin) {
        throw new ORPCError("BAD_REQUEST", {
          message: "O super admin já tem acesso a tudo.",
        });
      }
      const [updated] = await db
        .update(schema.tenantAdmins)
        .set({
          sections: serializeSections(input.sections),
          canIntegrations: input.canIntegrations,
          ...(input.name === undefined ? {} : { name: input.name }),
        })
        .where(eq(schema.tenantAdmins.id, input.id))
        .returning();
      return { ...updated!, sections: parseSections(updated!.sections) };
    }),

  /** Descarta o pedido de integração de uma unidade. */
  clearIntegrationRequest: superAdmin
    .input(z.object({ tenantId: z.number().int().positive() }))
    .handler(async ({ input }) => {
      await db
        .insert(schema.settings)
        .values({ key: INTEGRATION_REQUEST_KEY, value: "", tenantId: input.tenantId })
        .onConflictDoUpdate({
          target: [schema.settings.tenantId, schema.settings.key],
          set: { value: "" },
        });
      return { ok: true };
    }),

  removeAdmin: superAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input }) => {
      await db.delete(schema.tenantAdmins).where(eq(schema.tenantAdmins.id, input.id));
      return { ok: true };
    }),
};
