import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";
import { useColors } from "@/hooks/use-colors";
import type { ThemeColors } from "@/constants/theme";

/**
 * Conteúdo do site editado no painel (aba "Site"). O app usa os mesmos
 * textos, imagens e cores da versão web.
 */
export function useSiteContentQuery() {
  return useQuery(orpc.content.get.queryOptions({ input: { preview: false }, staleTime: 60_000 }));
}

export function useSiteContent() {
  return useSiteContentQuery().data?.content;
}

/** Paleta do app com as cores definidas no painel aplicadas por cima. */
export type SiteColors = { [K in keyof ThemeColors]: string };

export function useSiteColors(): SiteColors {
  const base = useColors();
  const theme = useSiteContent()?.theme;
  if (!theme) return base;
  return {
    ...base,
    background: theme.background || base.background,
    card: theme.surface || base.card,
    foreground: theme.foreground || base.foreground,
    primary: theme.primary || base.primary,
    accent: theme.primary || base.accent,
  };
}

/** Ícones dos destaques (nomes do CMS) mapeados para o Ionicons. */
export const HIGHLIGHT_ICON: Record<string, string> = {
  clock: "time-outline",
  shield: "lock-closed-outline",
  sparkles: "sparkles-outline",
  scissors: "cut-outline",
  star: "star-outline",
  calendar: "calendar-outline",
  "map-pin": "location-outline",
  heart: "heart-outline",
};
