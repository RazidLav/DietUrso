import { getSignedInUser } from "../cloud/cloudSync";
import { supabase } from "../cloud/supabase";
import type { AccessProfile, AppConfig, AppEvent, AppEventInput } from "./types";
import { DEFAULT_APP_CONFIG } from "./types";

const HEX_COLOR = /^#[0-9A-F]{6}$/i;

type EventRow = {
  id: string; title: string; description: string; starts_at: string; ends_at: string;
  accent_color: string; cta_label: string | null; cta_route: string | null;
  status: AppEvent["status"]; created_at: string; updated_at: string;
};

function mapEvent(row: EventRow): AppEvent {
  return {
    id: row.id, title: row.title, description: row.description,
    startsAt: row.starts_at, endsAt: row.ends_at, accentColor: row.accent_color,
    ctaLabel: row.cta_label, ctaRoute: row.cta_route, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function sanitizeAccentColor(value: string, fallback = DEFAULT_APP_CONFIG.brandAccent) {
  const clean = value.trim().toUpperCase();
  return HEX_COLOR.test(clean) ? clean : fallback;
}

export async function getAccessProfile(): Promise<AccessProfile> {
  const user = await getSignedInUser();
  if (!user || !supabase) return { userId: null, email: null, role: "user", authenticated: false };
  const { data, error } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return { userId: user.id, email: user.email ?? null, role: data?.role === "admin" ? "admin" : "user", authenticated: true };
}

export async function requireAdmin() {
  const access = await getAccessProfile();
  if (!access.authenticated) throw new Error("Entre na sua conta para acessar a administração.");
  if (access.role !== "admin") throw new Error("Esta conta não possui acesso administrativo.");
  return access;
}

export async function listVisibleEvents(now = new Date()): Promise<AppEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("app_events")
    .select("id,title,description,starts_at,ends_at,accent_color,cta_label,cta_route,status,created_at,updated_at")
    .eq("status", "published").gte("ends_at", now.toISOString()).order("starts_at", { ascending: true }).limit(6);
  if (error) throw error;
  return (data ?? []).map((row) => mapEvent(row as EventRow));
}

export async function listAdminEvents(): Promise<AppEvent[]> {
  await requireAdmin();
  const { data, error } = await supabase!.from("app_events")
    .select("id,title,description,starts_at,ends_at,accent_color,cta_label,cta_route,status,created_at,updated_at")
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapEvent(row as EventRow));
}

function validateEvent(input: AppEventInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (title.length < 3 || title.length > 80) throw new Error("O título precisa ter entre 3 e 80 caracteres.");
  if (description.length > 500) throw new Error("A descrição pode ter até 500 caracteres.");
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new Error("Informe um período válido para o evento.");
  if (input.ctaRoute && !input.ctaRoute.startsWith("/")) throw new Error("A rota do botão deve começar com /.");
  return { ...input, title, description, accentColor: sanitizeAccentColor(input.accentColor), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export async function saveAppEvent(input: AppEventInput, id?: string) {
  await requireAdmin();
  const clean = validateEvent(input);
  const payload = {
    title: clean.title, description: clean.description, starts_at: clean.startsAt, ends_at: clean.endsAt,
    accent_color: clean.accentColor, cta_label: clean.ctaLabel?.trim() || null,
    cta_route: clean.ctaRoute?.trim() || null, status: clean.status,
  };
  const query = id ? supabase!.from("app_events").update(payload).eq("id", id) : supabase!.from("app_events").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function archiveAppEvent(id: string) {
  await requireAdmin();
  const { error } = await supabase!.from("app_events").update({ status: "archived" }).eq("id", id);
  if (error) throw error;
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (!supabase) return DEFAULT_APP_CONFIG;
  const { data, error } = await supabase.from("app_settings").select("key,value").in("key", ["brand_accent", "announcement_message"]);
  if (error) throw error;
  const settings = new Map((data ?? []).map((row) => [row.key, row.value]));
  return {
    brandAccent: sanitizeAccentColor(typeof settings.get("brand_accent") === "string" ? settings.get("brand_accent") as string : DEFAULT_APP_CONFIG.brandAccent),
    announcementMessage: typeof settings.get("announcement_message") === "string" ? (settings.get("announcement_message") as string).slice(0, 160) : "",
  };
}

export async function saveAppConfig(config: AppConfig) {
  await requireAdmin();
  const clean: AppConfig = { brandAccent: sanitizeAccentColor(config.brandAccent), announcementMessage: config.announcementMessage.trim().slice(0, 160) };
  const { error } = await supabase!.from("app_settings").upsert([
    { key: "brand_accent", value: clean.brandAccent, description: "Cor principal da experiência web." },
    { key: "announcement_message", value: clean.announcementMessage, description: "Aviso curto exibido na Home." },
  ], { onConflict: "key" });
  if (error) throw error;
  notifyAppConfig(clean);
  return clean;
}

let cachedConfig = DEFAULT_APP_CONFIG;
const configListeners = new Set<(config: AppConfig) => void>();

function notifyAppConfig(config: AppConfig) {
  cachedConfig = config;
  configListeners.forEach((listener) => listener(config));
}

export function getCachedAppConfig() { return cachedConfig; }

export function subscribeAppConfig(listener: (config: AppConfig) => void) {
  configListeners.add(listener); listener(cachedConfig);
  return () => { configListeners.delete(listener); };
}

export async function refreshAppConfig() {
  try { notifyAppConfig(await loadAppConfig()); }
  catch { notifyAppConfig(DEFAULT_APP_CONFIG); }
  return cachedConfig;
}
