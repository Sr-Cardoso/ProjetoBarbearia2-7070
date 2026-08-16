import { createHmac, timingSafeEqual } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";
import { resolveTenant, tenantAdminAccess } from "../lib/tenant";
import { allSections, SECTION_LABELS, type Section } from "../lib/permissions";

/**
 * Senha mestra do painel — vem SÓ do ambiente (`ADMIN_PASSWORD` no `.env` da
 * raiz). Não existe senha padrão no código: sem a variável definida, o login
 * por senha fica desligado e só o Google entra. Antes havia um valor embutido,
 * o que significava que qualquer pessoa com acesso ao código entrava no painel.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() ?? "";
const SECRET = process.env.BETTER_AUTH_SECRET ?? "";

/** O login por senha só existe quando há senha e segredo configurados. */
export const PASSWORD_LOGIN_ENABLED = ADMIN_PASSWORD.length > 0 && SECRET.length > 0;

/**
 * Token derivado da senha mestra (HMAC-SHA256 com `BETTER_AUTH_SECRET`) —
 * é o que fica guardado no navegador, nunca a senha em si.
 */
export function passwordToken(password: string): string {
  return createHmac("sha256", SECRET).update(`admin:${password}`).digest("hex");
}

export const VALID_PASSWORD_TOKEN = PASSWORD_LOGIN_ENABLED ? passwordToken(ADMIN_PASSWORD) : "";

/**
 * Compara em tempo constante. Com `===` o tempo de resposta varia conforme
 * quantos caracteres batem, o que permite descobrir o token aos poucos.
 */
export function safeTokenEqual(candidate: string | null | undefined): boolean {
  if (!PASSWORD_LOGIN_ENABLED || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(VALID_PASSWORD_TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

if (!PASSWORD_LOGIN_ENABLED) {
  console.warn(
    "[auth] ADMIN_PASSWORD não definido — login por senha mestra desativado (use o Google).",
  );
} else if (ADMIN_PASSWORD.length < 12) {
  console.warn(
    `[auth] ADMIN_PASSWORD tem apenas ${ADMIN_PASSWORD.length} caracteres — use 16 ou mais.`,
  );
}

/** Todo procedimento recebe a unidade resolvida pelo domínio da requisição. */
export const tenantBase = base.use(async ({ context, next }) => {
  const tenant = await resolveTenant(context.headers);
  return next({ context: { tenant } });
});

/**
 * Admin: aceita sessão Google (e-mail autorizado na unidade) ou o token da
 * senha mestra no header `x-admin-token`.
 */
export type AdminContext = {
  email: string;
  superAdmin: boolean;
  via: "password" | "google";
  /** Áreas do painel liberadas (super admin recebe todas). */
  sections: Section[];
  /** Pode mexer na integração de plataforma de mensagens. */
  canIntegrations: boolean;
};

export const adminBase = tenantBase.use<{ admin: AdminContext }>(async ({ context, next }) => {
  const masterToken = context.headers.get("x-admin-token");
  if (safeTokenEqual(masterToken)) {
    return next({
      context: {
        admin: {
          email: "senha-mestra",
          superAdmin: true,
          via: "password",
          sections: allSections(),
          canIntegrations: true,
        },
      },
    });
  }

  const session = await auth.api.getSession({ headers: context.headers });
  const email = session?.user.email?.toLowerCase();
  if (!email) {
    throw new ORPCError("UNAUTHORIZED", { message: "Acesso restrito." });
  }

  const access = await tenantAdminAccess(context.tenant.id, email);
  if (!access) {
    throw new ORPCError("FORBIDDEN", {
      message: `A conta ${email} não tem permissão nesta unidade.`,
    });
  }

  return next({
    context: {
      admin: {
        email,
        superAdmin: access.superAdmin,
        via: "google" as const,
        sections: access.sections,
        canIntegrations: access.canIntegrations,
      },
    },
  });
});

/**
 * Exige pelo menos uma das áreas informadas. Serve para o convidado que só
 * recebeu, por exemplo, "Agenda" não conseguir chamar a API de Produtos direto,
 * mesmo com a aba escondida no painel.
 */
export function adminSections(...sections: [Section, ...Section[]]) {
  return adminBase.use(async ({ context, next }) => {
    const allowed = sections.some((section) => context.admin.sections.includes(section));
    if (!allowed) {
      const labels = sections.map((section) => SECTION_LABELS[section]).join(" ou ");
      throw new ORPCError("FORBIDDEN", {
        message: `Sua conta não tem acesso a ${labels}.`,
      });
    }
    return next();
  });
}

/** Exige o direito de configurar integrações (BlipBeauty ou outra plataforma). */
export const integrationsBase = adminBase.use(async ({ context, next }) => {
  if (!context.admin.canIntegrations) {
    throw new ORPCError("FORBIDDEN", {
      message: "Só o dono da conta configura a integração de plataformas de mensagem.",
    });
  }
  return next();
});

/** Cliente logado (opcional) — `context.user` é a conta ou null. */
export const withUser = tenantBase.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  return next({ context: { user: session?.user ?? null } });
});

/** Área do cliente — exige conta logada. */
export const customerBase = tenantBase.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED", { message: "Entre na sua conta." });
  return next({ context: { user: session.user } });
});
