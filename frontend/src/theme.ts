// Theme tokens for Projeto Urso — 7 Dark-First Utility DARK
// Values sourced from /app/design_guidelines.json

export const colors = {
  surface: "#121214",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1E1E24",
  onSurfaceSecondary: "#E1E1E6",
  surfaceTertiary: "#292930",
  onSurfaceTertiary: "#A9A9B2",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#000000",

  brand: "#34C759",
  onBrand: "#000000",
  brandPrimary: "#34C759",
  onBrandPrimary: "#000000",
  brandSecondary: "#0A84FF",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FF9F0A",
  onBrandTertiary: "#000000",

  success: "#34C759",
  onSuccess: "#000000",
  warning: "#FF9F0A",
  onWarning: "#000000",
  error: "#FF453A",
  onError: "#FFFFFF",
  info: "#0A84FF",
  onInfo: "#FFFFFF",

  border: "#292930",
  borderStrong: "#3E3E4A",
  divider: "#292930",
  muted: "#8D8D99",

  protein: "#34C759",
  carbs: "#0A84FF",
  fats: "#FF9F0A",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  display: "BarlowCondensed_700Bold",
  displayMedium: "BarlowCondensed_600SemiBold",
  displayRegular: "BarlowCondensed_400Regular",
  text: "Inter_400Regular",
  textMedium: "Inter_500Medium",
  textSemiBold: "Inter_600SemiBold",
  textBold: "Inter_700Bold",
};

export function useTheme() {
  return { colors, spacing, radius, typography };
}
