import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { themeCssVariables, themePalettes, type ThemePreference } from "../theme";
import { getCachedThemePreference, setThemePreference, subscribeThemePreference } from "../store/themeStore";

type ThemeContextValue = {
  preference: ThemePreference;
  palette: (typeof themePalettes)[ThemePreference];
  setPreference: (theme: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "emo",
  palette: themePalettes.emo,
  setPreference: setThemePreference,
});

function applyWebTheme(theme: ThemePreference) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement;
  window.localStorage.setItem("urso:themePreference", theme);
  root.dataset.ursoTheme = theme;
  root.style.colorScheme = theme === "emo" ? "dark" : "light";
  Object.entries(themeCssVariables(theme)).forEach(([name, value]) => root.style.setProperty(name, value));
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", themePalettes[theme].surface);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getCachedThemePreference());

  useEffect(() => subscribeThemePreference((theme) => {
    applyWebTheme(theme);
    setPreferenceState(theme);
  }), []);

  useEffect(() => { applyWebTheme(preference); }, [preference]);

  const value = useMemo(() => ({ preference, palette: themePalettes[preference], setPreference: setThemePreference }), [preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
