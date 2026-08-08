import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import * as schema from "../database/schema";
import { adminBase } from "../middleware/auth";
import { normalizeDomain } from "../lib/tenant";

/** Só super admin gerencia unidades. */
const superAdmin = adminBase.use(async ({ context, next }) => {
  if (!context.admin.superAdmin) {
    throw new ORPCError("FORBIDDEN", { message: "Apenas o super admin gerencia unidades." });
  }
  return next();
});

export const tenants = {
  /** Unidades com seus e-mails de admin. */
  list: superAdmin.handler(async () => {
    const [rows, admins] = await Promise.all([
      db.select().from(schema.tenants).orderBy(asc(schema.tenants.id)),
      db.select().from(schema.tenantAdmins),
    ]);
    return rows.map((tenant) => ({
      ...tenant,
      admins: admins.filter((a) => a.tenantId === tenant.id),
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

  addAdmin: superAdmin
    .input(
      z.object({
        tenantId: z.number().int().positive(),
        email: z.string().trim().email("E-mail inválido"),
        superAdmin: z.boolean().default(false),
      }),
    )
    .handler(async ({ input }) => {
      const email = input.email.toLowerCase();
      const [existing] = await db
        .select()
        .from(schema.tenantAdmins)
        .where(
          and(
            eq(schema.tenantAdmins.tenantId, input.tenantId),
            eq(schema.tenantAdmins.email, email),
          ),
        );
      if (existing) return existing;
      const [created] = await db
        .insert(schema.tenantAdmins)
        .values({ tenantId: input.tenantId, email, superAdmin: input.superAdmin })
        .returning();
      return created;
    }),

  removeAdmin: superAdmin
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input }) => {
      await db.delete(schema.tenantAdmins).where(eq(schema.tenantAdmins.id, input.id));
      return { ok: true };
    }),
};
