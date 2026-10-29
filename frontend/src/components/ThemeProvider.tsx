import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { themeCssVariables, themePalettes, type ThemePreference } from "../theme";
import { getCachedThemePreference, setThemePreference, subscribeThemePreference } from "../store/themeStore";
import { getCachedAppConfig, refreshAppConfig, subscribeAppConfig } from "../admin/service";
import type { AppConfig } from "../admin/types";
import { subscribeCloudStatus } from "../cloud/cloudSync";

type ThemeContextValue = {
  preference: ThemePreference;
  palette: (typeof themePalettes)[ThemePreference];
  appConfig: AppConfig;
  setPreference: (theme: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  preference: "emo",
  palette: themePalettes.emo,
  appConfig: getCachedAppConfig(),
  setPreference: setThemePreference,
});

function readableOn(hex: string) {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16); const green = parseInt(value.slice(2, 4), 16); const blue = parseInt(value.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 148 ? "#172000" : "#FFFFFF";
}

function applyWebTheme(theme: ThemePreference, config: AppConfig) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement;
  window.localStorage.setItem("urso:themePreference", theme);
  root.dataset.ursoTheme = theme;
  root.style.colorScheme = theme === "emo" ? "dark" : "light";
  Object.entries(themeCssVariables(theme)).forEach(([name, value]) => root.style.setProperty(name, value));
  root.style.setProperty("--uf-brand", config.brandAccent);
  root.style.setProperty("--uf-brand-primary", config.brandAccent);
  root.style.setProperty("--uf-on-brand", readableOn(config.brandAccent));
  root.style.setProperty("--uf-on-brand-primary", readableOn(config.brandAccent));
  root.style.setProperty("--uf-focus-ring", config.brandAccent);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", themePalettes[theme].surface);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(getCachedThemePreference());
  const [appConfig, setAppConfig] = useState<AppConfig>(getCachedAppConfig());

  useEffect(() => subscribeThemePreference((theme) => {
    applyWebTheme(theme, appConfig);
    setPreferenceState(theme);
  }), [appConfig]);

  useEffect(() => subscribeAppConfig(setAppConfig), []);
  useEffect(() => subscribeCloudStatus((status) => {
    if (status.readyForData) void refreshAppConfig();
  }), []);
  useEffect(() => { applyWebTheme(preference, appConfig); }, [preference, appConfig]);

  const value = useMemo(() => ({
    preference,
    palette: { ...themePalettes[preference], brand: appConfig.brandAccent, brandPrimary: appConfig.brandAccent, focusRing: appConfig.brandAccent },
    appConfig,
    setPreference: setThemePreference,
  }), [preference, appConfig]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
