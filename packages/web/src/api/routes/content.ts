import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { adminBase, tenantBase } from "../middleware/auth";
import { DEFAULT_CONTENT, mergeContent, parseContent } from "../lib/site-content";

async function loadRow(tenantId: number) {
  const [row] = await db
    .select()
    .from(schema.siteContent)
    .where(eq(schema.siteContent.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

async function ensureRow(tenantId: number) {
  const existing = await loadRow(tenantId);
  if (existing) return existing;
  const [created] = await db
    .insert(schema.siteContent)
    .values({
      tenantId,
      draft: JSON.stringify(DEFAULT_CONTENT),
      published: JSON.stringify(DEFAULT_CONTENT),
      updatedAt: new Date(),
      publishedAt: new Date(),
    })
    .returning();
  return created;
}

export const content = {
  /**
   * Conteúdo do site para o público (web e app). Com `preview: true`
   * devolve o rascunho — usado pelo preview ao vivo dentro do painel.
   */
  get: tenantBase
    .input(z.object({ preview: z.boolean().default(false) }).default({ preview: false }))
    .handler(async ({ input, context }) => {
      const row = await loadRow(context.tenant.id);
      const raw = input.preview ? row?.draft : row?.published;
      return {
        content: parseContent(raw),
        tenant: { name: context.tenant.name, domain: context.tenant.domain },
      };
    }),

  /** Rascunho + estado de publicação (painel). */
  draft: adminBase.handler(async ({ context }) => {
    const row = await ensureRow(context.tenant.id);
    return {
      draft: parseContent(row.draft),
      dirty: row.draft !== row.published,
      publishedAt: row.publishedAt?.toISOString() ?? null,
    };
  }),

  /** Salva o rascunho (não publica). */
  saveDraft: adminBase
    .input(z.object({ content: z.unknown() }))
    .handler(async ({ input, context }) => {
      await ensureRow(context.tenant.id);
      const merged = mergeContent(input.content);
      await db
        .update(schema.siteContent)
        .set({ draft: JSON.stringify(merged), updatedAt: new Date() })
        .where(eq(schema.siteContent.tenantId, context.tenant.id));
      return { ok: true, content: merged };
    }),

  /** Publica o rascunho atual no site. */
  publish: adminBase.handler(async ({ context }) => {
    const row = await ensureRow(context.tenant.id);
    const now = new Date();
    await db
      .update(schema.siteContent)
      .set({ published: row.draft, publishedAt: now, updatedAt: now })
      .where(eq(schema.siteContent.tenantId, context.tenant.id));
    return { ok: true, publishedAt: now.toISOString() };
  }),

  /** Descarta o rascunho e volta para o conteúdo publicado. */
  discard: adminBase.handler(async ({ context }) => {
    const row = await ensureRow(context.tenant.id);
    await db
      .update(schema.siteContent)
      .set({ draft: row.published, updatedAt: new Date() })
      .where(eq(schema.siteContent.tenantId, context.tenant.id));
    return { ok: true, draft: parseContent(row.published) };
  }),

  /** Restaura o conteúdo padrão no rascunho. */
  reset: adminBase.handler(async ({ context }) => {
    await ensureRow(context.tenant.id);
    await db
      .update(schema.siteContent)
      .set({ draft: JSON.stringify(DEFAULT_CONTENT), updatedAt: new Date() })
      .where(eq(schema.siteContent.tenantId, context.tenant.id));
    return { ok: true, draft: DEFAULT_CONTENT };
  }),
};
