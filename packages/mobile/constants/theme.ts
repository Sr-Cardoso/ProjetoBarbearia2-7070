import { Platform } from "react-native";

/**
 * Tokens de cor da Barbearia Cardoso — vermelho Netflix (#E50914) sobre preto,
 * espelhando os tokens do web em packages/web/src/web/styles.css.
 */
export const Colors = {
  light: {
    background: "#000000",
    foreground: "#FFFFFF",
    card: "#141414",
    cardForeground: "#FFFFFF",
    primary: "#E50914",
    primaryForeground: "#FFFFFF",
    secondary: "#1F1F1F",
    secondaryForeground: "#FFFFFF",
    muted: "#1A1A1A",
    mutedForeground: "#A3A3A3",
    accent: "#E50914",
    accentForeground: "#FFFFFF",
    border: "#2A2A2A",
    destructive: "#E50914",
    success: "#22C55E",
    warning: "#F59E0B",
  },
  dark: {
    background: "#000000",
    foreground: "#FFFFFF",
    card: "#141414",
    cardForeground: "#FFFFFF",
    primary: "#E50914",
    primaryForeground: "#FFFFFF",
    secondary: "#1F1F1F",
    secondaryForeground: "#FFFFFF",
    muted: "#1A1A1A",
    mutedForeground: "#A3A3A3",
    accent: "#E50914",
    accentForeground: "#FFFFFF",
    border: "#2A2A2A",
    destructive: "#EF4444",
    success: "#22C55E",
    warning: "#F59E0B",
  },
} as const;

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ColorScheme];

/** Fontes da marca: Playfair Display (títulos) + Jost (texto). */
export const Fonts = {
  display: "PlayfairDisplay_600SemiBold",
  displayBold: "PlayfairDisplay_700Bold",
  sans: "Jost_400Regular",
  sansMedium: "Jost_500Medium",
  sansBold: "Jost_600SemiBold",
  mono: Platform.select({ ios: "ui-monospace", default: "monospace" }),
} as const;
