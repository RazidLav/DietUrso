import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import type { ConsumptionEntry, Plan } from "../types/plan";
import { createInitialGamificationState, type GamificationState } from "../gamification/types";
import {
  ACTIVE_PLAN_KEY,
  CHOSEN_OPTIONS_KEY,
  CONSUMPTION_KEY,
  GAMIFICATION_KEY,
  LOCAL_CHANGED_AT_KEY,
  ONBOARDING_COMPLETE_KEY,
  PLANS_KEY,
  SHOPPING_STATE_KEY,
  WATER_KEY,
} from "../store/storageKeys";
import { isCloudConfigured, supabase } from "./supabase";

type CloudPhase =
  | "disabled"
  | "signed_out"
  | "confirmation_required"
  | "syncing"
  | "synced"
  | "error";

export interface CloudStatus {
  configured: boolean;
  phase: CloudPhase;
  email: string | null;
  lastSyncAt: string | null;
  message: string | null;
}

interface AppSnapshot {
  version: 1 | 2;
  plans: Plan[];
  activePlanId: string | null;
  consumption: ConsumptionEntry[];
  chosenOptions: Record<string, Record<string, string>>;
  shoppingChecked: Record<string, boolean>;
  gamification?: GamificationState;
  waterByDate?: Record<string, number>;
  onboardingComplete?: boolean;
}

type CloudRow = {
  payload: AppSnapshot;
  updated_at: string;
};

const statusListeners = new Set<(status: CloudStatus) => void>();
const dataListeners = new Set<() => void>();

let status: CloudStatus = {
  configured: isCloudConfigured,
  phase: isCloudConfigured ? "signed_out" : "disabled",
  email: null,
  lastSyncAt: null,
  message: isCloudConfigured ? null : "Sincronização não configurada.",
};
let initialized = false;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let activeSync: Promise<void> | null = null;
let pendingLocalChange = false;

function updateStatus(next: Partial<CloudStatus>) {
  status = { ...status, ...next };
  statusListeners.forEach((listener) => listener(status));
}

function notifyDataChanged() {
  dataListeners.forEach((listener) => listener());
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readLocalSnapshot(): Promise<AppSnapshot> {
  const [plans, activePlanId, consumption, chosenOptions, shoppingChecked, gamification, waterByDate, onboardingComplete] =
    await Promise.all([
      readJson<Plan[]>(PLANS_KEY, []),
      AsyncStorage.getItem(ACTIVE_PLAN_KEY),
      readJson<ConsumptionEntry[]>(CONSUMPTION_KEY, []),
      readJson<Record<string, Record<string, string>>>(CHOSEN_OPTIONS_KEY, {}),
      readJson<Record<string, boolean>>(SHOPPING_STATE_KEY, {}),
      readJson<GamificationState>(GAMIFICATION_KEY, createInitialGamificationState()),
      readJson<Record<string, number>>(WATER_KEY, {}),
      AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
    ]);

  return {
    version: 2,
    plans,
    activePlanId,
    consumption,
    chosenOptions,
    shoppingChecked,
    gamification,
    waterByDate,
    onboardingComplete: onboardingComplete === "1",
  };
}

function isValidSnapshot(value: unknown): value is AppSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppSnapshot>;
  return (
    (candidate.version === 1 || candidate.version === 2) &&
    Array.isArray(candidate.plans) &&
    Array.isArray(candidate.consumption) &&
    typeof candidate.chosenOptions === "object" &&
    candidate.chosenOptions !== null &&
    typeof candidate.shoppingChecked === "object" &&
    candidate.shoppingChecked !== null
  );
}

async function applyCloudSnapshot(row: CloudRow) {
  if (!isValidSnapshot(row.payload)) {
    throw new Error("Os dados encontrados na nuvem não têm um formato válido.");
  }

  applyingRemote = true;
  try {
    await Promise.all([
      AsyncStorage.setItem(PLANS_KEY, JSON.stringify(row.payload.plans)),
      AsyncStorage.setItem(
        CONSUMPTION_KEY,
        JSON.stringify(row.payload.consumption)
      ),
      AsyncStorage.setItem(
        CHOSEN_OPTIONS_KEY,
        JSON.stringify(row.payload.chosenOptions)
      ),
      AsyncStorage.setItem(
        SHOPPING_STATE_KEY,
        JSON.stringify(row.payload.shoppingChecked)
      ),
      AsyncStorage.setItem(
        GAMIFICATION_KEY,
        JSON.stringify(row.payload.gamification ?? createInitialGamificationState())
      ),
      AsyncStorage.setItem(WATER_KEY, JSON.stringify(row.payload.waterByDate ?? {})),
      row.payload.onboardingComplete
        ? AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1")
        : AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY),
      AsyncStorage.setItem(LOCAL_CHANGED_AT_KEY, row.updated_at),
      row.payload.activePlanId
        ? AsyncStorage.setItem(ACTIVE_PLAN_KEY, row.payload.activePlanId)
        : AsyncStorage.removeItem(ACTIVE_PLAN_KEY),
    ]);
  } finally {
    applyingRemote = false;
  }

  notifyDataChanged();
}

async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

async function pushLocalState(session?: Session): Promise<void> {
  if (!supabase) return;
  const currentSession = session ?? (await getSession());
  if (!currentSession) {
    updateStatus({ phase: "signed_out", email: null });
    return;
  }

  updateStatus({ phase: "syncing", email: currentSession.user.email ?? null });
  const payload = await readLocalSnapshot();
  const updatedAt = new Date().toISOString();
  const { error } = await supabase.from("user_app_state").upsert({
    user_id: currentSession.user.id,
    payload,
    updated_at: updatedAt,
  });

  if (error) throw error;
  await AsyncStorage.setItem(LOCAL_CHANGED_AT_KEY, updatedAt);
  updateStatus({
    phase: "synced",
    email: currentSession.user.email ?? null,
    lastSyncAt: updatedAt,
    message: null,
  });
}

async function performSync(): Promise<void> {
  if (!supabase) return;
  const session = await getSession();
  if (!session) {
    updateStatus({ phase: "signed_out", email: null, message: null });
    return;
  }

  updateStatus({
    phase: "syncing",
    email: session.user.email ?? null,
    message: null,
  });

  const { data, error } = await supabase
    .from("user_app_state")
    .select("payload, updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle<CloudRow>();

  if (error) throw error;

  if (!data) {
    await pushLocalState(session);
    return;
  }

  const localChangedAt = await AsyncStorage.getItem(LOCAL_CHANGED_AT_KEY);
  if (localChangedAt && localChangedAt > data.updated_at) {
    await pushLocalState(session);
    return;
  }

  await applyCloudSnapshot(data);
  updateStatus({
    phase: "synced",
    email: session.user.email ?? null,
    lastSyncAt: data.updated_at,
    message: null,
  });
}

export function getCloudStatus(): CloudStatus {
  return status;
}

export function subscribeCloudStatus(listener: (next: CloudStatus) => void) {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export function subscribeCloudData(listener: () => void) {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

export async function markLocalChange(): Promise<void> {
  if (applyingRemote) return;
  await AsyncStorage.setItem(LOCAL_CHANGED_AT_KEY, new Date().toISOString());
  pendingLocalChange = true;
  scheduleCloudPush();
}

export function scheduleCloudPush() {
  if (!isCloudConfigured || applyingRemote) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void syncCloudNow().catch(() => undefined);
  }, 500);
}

export function syncCloudNow(): Promise<void> {
  if (!isCloudConfigured) return Promise.resolve();
  if (activeSync) return activeSync;

  pendingLocalChange = false;
  activeSync = performSync()
    .catch((error) => {
      console.error("Falha ao sincronizar dados", error);
      updateStatus({
        phase: "error",
        message:
          "Não foi possível sincronizar agora. Os dados continuam salvos neste aparelho.",
      });
      throw error;
    })
    .finally(() => {
      activeSync = null;
      if (pendingLocalChange) scheduleCloudPush();
    });

  return activeSync;
}

export async function initializeCloudSync(): Promise<void> {
  if (!supabase || initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      updateStatus({ phase: "signed_out", email: null, message: null });
      return;
    }
    updateStatus({ email: session.user.email ?? null });
    setTimeout(() => void syncCloudNow().catch(() => undefined), 0);
  });

  await syncCloudNow();
}

export async function signInToCloud(email: string, password: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  updateStatus({ phase: "syncing", message: null });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  await syncCloudNow();
  return data.user;
}

export async function signUpForCloud(email: string, password: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  updateStatus({ phase: "syncing", message: null });
  const redirectTo =
    typeof window === "undefined"
      ? undefined
      : `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;

  if (data.session) {
    await syncCloudNow();
  } else {
    updateStatus({
      phase: "confirmation_required",
      email: email.trim(),
      message: "Confira seu e-mail para confirmar a conta e depois entre no app.",
    });
  }

  return { needsEmailConfirmation: !data.session };
}

export async function signOutFromCloud(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  updateStatus({
    phase: "signed_out",
    email: null,
    lastSyncAt: null,
    message: null,
  });
}

export function getSignedInUser(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  return supabase.auth.getUser().then(({ data }) => data.user);
}
