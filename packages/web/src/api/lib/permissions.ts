/**
 * Permissões do painel por usuário convidado.
 *
 * O dono (super admin) libera o acesso de um e-mail Google no mesmo lugar em que
 * cadastra o domínio da unidade — aba **Unidades** — marcando quais áreas do
 * painel aquele e-mail pode abrir. As áreas são exatamente as abas do admin.
 *
 * A integração de plataformas de mensagem (BlipBeauty e afins) **não** é uma
 * área comum: fica atrás de `canIntegrations`, que por padrão é falso. Quem não
 * tem esse direito vê apenas um botão para pedir a liberação/escolher a
 * plataforma no futuro, nunca a URL nem a API key.
 */

/** Áreas liberáveis — mesma ordem das abas do painel. */
export const SECTIONS = [
  "agenda",
  "servicos",
  "barbeiros",
  "bloqueios",
  "produtos",
  "pedidos",
  "mensagens",
  "site",
  "config",
] as const;

export type Section = (typeof SECTIONS)[number];

/** Rótulos em pt-BR (painel e mensagens de erro). */
export const SECTION_LABELS: Record<Section, string> = {
  agenda: "Agenda",
  servicos: "Serviços",
  barbeiros: "Barbeiros",
  bloqueios: "Bloqueios",
  produtos: "Produtos",
  pedidos: "Pedidos",
  mensagens: "Mensagens",
  site: "Site",
  config: "Configurações",
};

/** Sugestão para um convidado novo: o dia a dia do balcão, sem configurar nada. */
export const DEFAULT_SECTIONS: Section[] = ["agenda", "pedidos"];

export function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

/** Lê o CSV guardado no banco e devolve só as áreas válidas, sem repetir. */
export function parseSections(raw: string | null | undefined): Section[] {
  if (!raw) return [];
  const found = new Set<Section>();
  for (const part of raw.split(",")) {
    const key = part.trim().toLowerCase();
    if (isSection(key)) found.add(key);
  }
  return SECTIONS.filter((section) => found.has(section));
}

/** Formato de gravação: CSV na ordem canônica. */
export function serializeSections(sections: readonly string[]): string {
  const found = new Set(sections.map((s) => s.trim().toLowerCase()));
  return SECTIONS.filter((section) => found.has(section)).join(",");
}

/** Super admin e senha mestra enxergam tudo. */
export function allSections(): Section[] {
  return [...SECTIONS];
}

export function hasSection(sections: readonly Section[], section: Section): boolean {
  return sections.includes(section);
}

/** Chave de `settings` com o pedido de integração feito por um convidado. */
export const INTEGRATION_REQUEST_KEY = "blipIntegrationRequest";

/** Plataformas que o painel sabe oferecer no pedido de integração. */
export const INTEGRATION_PLATFORMS = ["blipbeauty", "evolution", "outra"] as const;

export type IntegrationPlatform = (typeof INTEGRATION_PLATFORMS)[number];

export const INTEGRATION_PLATFORM_LABELS: Record<IntegrationPlatform, string> = {
  blipbeauty: "BlipBeauty",
  evolution: "Evolution API (própria)",
  outra: "Outra plataforma",
};

export type IntegrationRequest = {
  platform: IntegrationPlatform;
  note: string;
  email: string;
  at: string;
};

/** Lê o JSON do pedido; qualquer coisa estranha vira "sem pedido". */
export function parseIntegrationRequest(raw: string | null | undefined): IntegrationRequest | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as Partial<IntegrationRequest>;
    const platform = data.platform;
    if (!platform || !(INTEGRATION_PLATFORMS as readonly string[]).includes(platform)) return null;
    return {
      platform: platform as IntegrationPlatform,
      note: typeof data.note === "string" ? data.note : "",
      email: typeof data.email === "string" ? data.email : "",
      at: typeof data.at === "string" ? data.at : "",
    };
  } catch {
    return null;
  }
}
