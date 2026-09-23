import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ThemePreference } from "../theme";
import { THEME_PREFERENCE_KEY } from "./storageKeys";

const listeners = new Set<(theme: ThemePreference) => void>();
let cachedTheme: ThemePreference = typeof document !== "undefined" && document.documentElement.dataset.ursoTheme === "gratiluz" ? "gratiluz" : "emo";

export function sanitizeThemePreference(value: unknown): ThemePreference {
  return value === "gratiluz" ? "gratiluz" : "emo";
}

export function getCachedThemePreference() {
  return cachedTheme;
}

export async function loadThemePreference() {
  const webValue = typeof window !== "undefined" ? window.localStorage.getItem(THEME_PREFERENCE_KEY) : null;
  const next = sanitizeThemePreference(webValue ?? await AsyncStorage.getItem(THEME_PREFERENCE_KEY));
  publish(next);
  return next;
}

export function subscribeThemePreference(listener: (theme: ThemePreference) => void) {
  listeners.add(listener);
  listener(cachedTheme);
  return () => { listeners.delete(listener); };
}

function publish(theme: ThemePreference) {
  cachedTheme = theme;
  listeners.forEach((listener) => listener(theme));
}

export async function setThemePreference(theme: ThemePreference) {
  const next = sanitizeThemePreference(theme);
  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, next);
  if (typeof window !== "undefined") window.localStorage.setItem(THEME_PREFERENCE_KEY, next);
  publish(next);
  const { markLocalChange } = await import("../cloud/cloudSync");
  await markLocalChange();
}

export async function applyRemoteThemePreference(theme: unknown) {
  const next = sanitizeThemePreference(theme);
  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, next);
  if (typeof window !== "undefined") window.localStorage.setItem(THEME_PREFERENCE_KEY, next);
  publish(next);
}
