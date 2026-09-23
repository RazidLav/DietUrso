export type ThemePreference = "emo" | "gratiluz";

export type SemanticColors = {
  surface: string; onSurface: string; surfaceSecondary: string; onSurfaceSecondary: string;
  surfaceTertiary: string; onSurfaceTertiary: string; surfaceElevated: string;
  surfaceInverse: string; onSurfaceInverse: string;
  brand: string; onBrand: string; brandPrimary: string; onBrandPrimary: string;
  brandSecondary: string; onBrandSecondary: string; brandTertiary: string; onBrandTertiary: string;
  success: string; onSuccess: string; warning: string; onWarning: string;
  error: string; onError: string; info: string; onInfo: string;
  border: string; borderStrong: string; divider: string; muted: string;
  overlay: string; focusRing: string; protein: string; carbs: string; fats: string;
};

export const themePalettes: Record<ThemePreference, SemanticColors> = {
  emo: {
    surface: "#101114", onSurface: "#F3F5EF", surfaceSecondary: "#1A1C20", onSurfaceSecondary: "#DEE2D9",
    surfaceTertiary: "#25282D", onSurfaceTertiary: "#A8AEA4", surfaceElevated: "#202329",
    surfaceInverse: "#F3F5EF", onSurfaceInverse: "#151712",
    brand: "#B7FF2A", onBrand: "#182000", brandPrimary: "#B7FF2A", onBrandPrimary: "#182000",
    brandSecondary: "#79AFFF", onBrandSecondary: "#101A2D", brandTertiary: "#FFAD5B", onBrandTertiary: "#2A1707",
    success: "#65D982", onSuccess: "#0B2512", warning: "#FFAD5B", onWarning: "#2A1707",
    error: "#FF6F6A", onError: "#2B0908", info: "#79AFFF", onInfo: "#101A2D",
    border: "#30343B", borderStrong: "#454B55", divider: "#30343B", muted: "#8C938A",
    overlay: "rgba(4, 5, 7, 0.76)", focusRing: "#B7FF2A",
    protein: "#65D982", carbs: "#79AFFF", fats: "#FFAD5B",
  },
  gratiluz: {
    surface: "#F7F3EA", onSurface: "#22251F", surfaceSecondary: "#FFFDF8", onSurfaceSecondary: "#3E433A",
    surfaceTertiary: "#ECE7DC", onSurfaceTertiary: "#6E736A", surfaceElevated: "#FFFFFF",
    surfaceInverse: "#22251F", onSurfaceInverse: "#FFFDF8",
    brand: "#579B2E", onBrand: "#FFFFFF", brandPrimary: "#579B2E", onBrandPrimary: "#FFFFFF",
    brandSecondary: "#6376C8", onBrandSecondary: "#FFFFFF", brandTertiary: "#C97937", onBrandTertiary: "#FFFFFF",
    success: "#39884E", onSuccess: "#FFFFFF", warning: "#B86D27", onWarning: "#FFFFFF",
    error: "#C64C49", onError: "#FFFFFF", info: "#536BC1", onInfo: "#FFFFFF",
    border: "#DED7C9", borderStrong: "#C7BEAE", divider: "#DED7C9", muted: "#777B72",
    overlay: "rgba(34, 37, 31, 0.46)", focusRing: "#579B2E",
    protein: "#39884E", carbs: "#536BC1", fats: "#C97937",
  },
};

const cssName = (key: keyof SemanticColors) => `--uf-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
const semanticColor = (key: keyof SemanticColors) => typeof document !== "undefined" ? `var(${cssName(key)})` : themePalettes.emo[key];

export const colors = Object.fromEntries(
  (Object.keys(themePalettes.emo) as (keyof SemanticColors)[]).map((key) => [key, semanticColor(key)])
) as SemanticColors;

export function themeCssVariables(theme: ThemePreference) {
  const palette = themePalettes[theme];
  return Object.fromEntries((Object.keys(palette) as (keyof SemanticColors)[]).map((key) => [cssName(key), palette[key]]));
}

export function withAlpha(color: string, opacity: number | string) {
  const normalized = typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : parseInt(opacity.replace("#", ""), 16) / 255;
  if (color.startsWith("var(")) return `color-mix(in srgb, ${color} ${Math.round(normalized * 100)}%, transparent)`;
  const alpha = Math.round(normalized * 255).toString(16).padStart(2, "0");
  return color.startsWith("#") && (color.length === 4 || color.length === 7) ? `${color}${alpha}` : color;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 8, md: 14, lg: 24, pill: 999 };
export const breakpoints = { compact: 320, mobile: 390, tablet: 768, desktop: 1024, wide: 1440 };
export const motion = { contextExitMs: 90, contextEnterMs: 130, contextTotalMs: 220 };
export const zIndex = { content: 0, navigation: 20, modal: 100, toast: 120 };
export const typography = {
  display: "BarlowCondensed_700Bold", displayMedium: "BarlowCondensed_600SemiBold", displayRegular: "BarlowCondensed_400Regular",
  text: "Inter_400Regular", textMedium: "Inter_500Medium", textSemiBold: "Inter_600SemiBold", textBold: "Inter_700Bold",
};

export function useTheme() {
  return { colors, spacing, radius, typography, breakpoints, motion, zIndex };
}
