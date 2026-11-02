import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, User } from "@supabase/supabase-js";
import type { ConsumptionEntry, FoodCatalogItem, Plan, Recipe } from "../types/plan";
import type { ShoppingConfig } from "../store/nutritionStore";
import type { HydrationState } from "../hydration/types";
import type { TrainingState } from "../training/types";
import { createInitialGamificationState, type GamificationState } from "../gamification/types";
import {
  ACTIVE_PLAN_KEY,
  CHOSEN_OPTIONS_KEY,
  CONSUMPTION_KEY,
  FOOD_LIBRARY_KEY,
  GAMIFICATION_KEY,
  HYDRATION_STATE_KEY,
  EVOLUTION_STATE_KEY,
  TRAINING_STATE_KEY,
  LOCAL_CHANGED_AT_KEY,
  LOCAL_BASE_REVISION_KEY,
  LOCAL_CONFLICT_BACKUP_KEY,
  LOCAL_DIRTY_KEY,
  LOCAL_OWNER_ID_KEY,
  ONBOARDING_COMPLETE_KEY,
  NUTRITION_SEED_KEY,
  PLANS_KEY,
  SHOPPING_STATE_KEY,
  SHOPPING_CONFIG_KEY,
  RECIPES_KEY,
  PROFILE_STATE_KEY,
  THEME_PREFERENCE_KEY,
  WATER_KEY,
  SEED_KEY,
} from "../store/storageKeys";
import { isCloudConfigured, supabase } from "./supabase";
import { authRedirectUrl, normalizeEmail, registerWithPassword, requestPasswordReset, resendEmailConfirmation, signInWithPassword } from "./authFlow";
import { applyRemoteThemePreference, sanitizeThemePreference } from "../store/themeStore";
import type { ThemePreference } from "../theme";
import type { ProfileState } from "../profile/types";
import type { EvolutionState } from "../evolution/types";
import { createInitialProfileState } from "../profile/rules";
import { shouldStartFreshForAccount } from "./accountIsolation";
import { decideSyncAction } from "./syncDecision";

type CloudPhase =
  | "disabled"
  | "initializing"
  | "signed_out"
  | "confirmation_required"
  | "syncing"
  | "synced"
  | "conflict"
  | "error";

export interface CloudStatus {
  configured: boolean;
  phase: CloudPhase;
  authenticated: boolean;
  readyForData: boolean;
  passwordRecovery: boolean;
  email: string | null;
  lastSyncAt: string | null;
  hasConflict: boolean;
  message: string | null;
}

interface AppSnapshot {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  plans: Plan[];
  activePlanId: string | null;
  consumption: ConsumptionEntry[];
  chosenOptions: Record<string, Record<string, string>>;
  shoppingChecked: Record<string, boolean>;
  gamification?: GamificationState;
  waterByDate?: Record<string, number>;
  onboardingComplete?: boolean;
  foodLibrary?: FoodCatalogItem[];
  recipes?: Recipe[];
  shoppingConfig?: ShoppingConfig;
  hydrationState?: HydrationState;
  trainingState?: TrainingState;
  themePreference?: ThemePreference;
  profileState?: ProfileState;
  evolutionState?: EvolutionState;
}

type CloudRow = {
  payload: AppSnapshot;
  updated_at: string;
};

interface SyncConflictBackup {
  ownerId: string;
  snapshot: AppSnapshot;
  localChangedAt: string | null;
  baseRevision: string | null;
  remoteRevision: string;
  createdAt: string;
}

class SyncConflictError extends Error {}

const statusListeners = new Set<(status: CloudStatus) => void>();
const dataListeners = new Set<() => void>();

let status: CloudStatus = {
  configured: isCloudConfigured,
  phase: isCloudConfigured ? "initializing" : "disabled",
  authenticated: false,
  readyForData: !isCloudConfigured,
  passwordRecovery: false,
  email: null,
  lastSyncAt: null,
  hasConflict: false,
  message: isCloudConfigured ? null : "Sincronização não configurada.",
};
let initialized = false;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let activeSync: Promise<void> | null = null;
let pendingLocalChange = false;

const RESETTABLE_DATA_KEYS = [
  PLANS_KEY,
  ACTIVE_PLAN_KEY,
  CONSUMPTION_KEY,
  CHOSEN_OPTIONS_KEY,
  SHOPPING_STATE_KEY,
  SEED_KEY,
  LOCAL_CHANGED_AT_KEY,
  LOCAL_BASE_REVISION_KEY,
  LOCAL_DIRTY_KEY,
  LOCAL_CONFLICT_BACKUP_KEY,
  GAMIFICATION_KEY,
  WATER_KEY,
  HYDRATION_STATE_KEY,
  TRAINING_STATE_KEY,
  ONBOARDING_COMPLETE_KEY,
  FOOD_LIBRARY_KEY,
  RECIPES_KEY,
  NUTRITION_SEED_KEY,
  SHOPPING_CONFIG_KEY,
  PROFILE_STATE_KEY,
  EVOLUTION_STATE_KEY,
];

async function replaceLocalDataWithFreshDefaults(ownerId: string) {
  applyingRemote = true;
  try {
    await AsyncStorage.multiRemove(RESETTABLE_DATA_KEYS);
    const now = new Date().toISOString();
    await AsyncStorage.multiSet([
      [GAMIFICATION_KEY, JSON.stringify(createInitialGamificationState())],
      [PROFILE_STATE_KEY, JSON.stringify(createInitialProfileState(now))],
      [EVOLUTION_STATE_KEY, JSON.stringify({ version: 1, goal: { type: "recomposition", startedAt: now }, assessments: [], photos: [], comparisonEvents: [] } satisfies EvolutionState)],
      [LOCAL_OWNER_ID_KEY, ownerId],
    ]);

    const [{ ensureSeed }, { ensureNutritionSeed }, { ensureHydrationSeed }, { ensureTrainingSeed }] = await Promise.all([
      import("../store/planStore"),
      import("../store/nutritionStore"),
      import("../store/hydrationStore"),
      import("../store/trainingStore"),
    ]);
    await ensureSeed();
    await Promise.all([ensureNutritionSeed(), ensureHydrationSeed(), ensureTrainingSeed()]);
  } finally {
    applyingRemote = false;
  }
}

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
  const [plans, activePlanId, consumption, chosenOptions, shoppingChecked, gamification, waterByDate, onboardingComplete, foodLibrary, recipes, shoppingConfig, hydrationState, trainingState, themePreference, profileState, evolutionState] =
    await Promise.all([
      readJson<Plan[]>(PLANS_KEY, []),
      AsyncStorage.getItem(ACTIVE_PLAN_KEY),
      readJson<ConsumptionEntry[]>(CONSUMPTION_KEY, []),
      readJson<Record<string, Record<string, string>>>(CHOSEN_OPTIONS_KEY, {}),
      readJson<Record<string, boolean>>(SHOPPING_STATE_KEY, {}),
      readJson<GamificationState>(GAMIFICATION_KEY, createInitialGamificationState()),
      readJson<Record<string, number>>(WATER_KEY, {}),
      AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY),
      readJson<FoodCatalogItem[]>(FOOD_LIBRARY_KEY, []),
      readJson<Recipe[]>(RECIPES_KEY, []),
      readJson<ShoppingConfig>(SHOPPING_CONFIG_KEY, {
        periodDays: 7,
        preferredSubstitutions: {},
        quantityOverrides: {},
        manualItems: [],
      }),
      readJson<HydrationState | undefined>(HYDRATION_STATE_KEY, undefined),
      readJson<TrainingState | undefined>(TRAINING_STATE_KEY, undefined),
      AsyncStorage.getItem(THEME_PREFERENCE_KEY),
      readJson<ProfileState | undefined>(PROFILE_STATE_KEY, undefined),
      readJson<EvolutionState | undefined>(EVOLUTION_STATE_KEY, undefined),
    ]);

  return {
    version: 9,
    plans,
    activePlanId,
    consumption,
    chosenOptions,
    shoppingChecked,
    gamification,
    waterByDate,
    onboardingComplete: onboardingComplete === "1",
    foodLibrary,
    recipes,
    shoppingConfig,
    hydrationState,
    trainingState,
    themePreference: sanitizeThemePreference(themePreference),
    profileState,
    evolutionState,
  };
}

function isValidSnapshot(value: unknown): value is AppSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppSnapshot>;
  return (
    (candidate.version === 1 || candidate.version === 2 || candidate.version === 3 || candidate.version === 4 || candidate.version === 5 || candidate.version === 6 || candidate.version === 7 || candidate.version === 8 || candidate.version === 9) &&
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
      row.payload.version >= 3
        ? AsyncStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(row.payload.foodLibrary ?? []))
        : Promise.resolve(),
      row.payload.version >= 3
        ? AsyncStorage.setItem(RECIPES_KEY, JSON.stringify(row.payload.recipes ?? []))
        : Promise.resolve(),
      row.payload.version >= 3
        ? AsyncStorage.setItem(
            SHOPPING_CONFIG_KEY,
            JSON.stringify(row.payload.shoppingConfig ?? {
              periodDays: 7,
              preferredSubstitutions: {},
              quantityOverrides: {},
              manualItems: [],
            })
          )
        : Promise.resolve(),
      row.payload.version >= 3
        ? AsyncStorage.setItem(NUTRITION_SEED_KEY, "1")
        : Promise.resolve(),
      row.payload.version >= 4 && row.payload.hydrationState
        ? AsyncStorage.setItem(HYDRATION_STATE_KEY, JSON.stringify(row.payload.hydrationState))
        : Promise.resolve(),
      row.payload.version >= 5 && row.payload.trainingState
        ? AsyncStorage.setItem(TRAINING_STATE_KEY, JSON.stringify(row.payload.trainingState))
        : Promise.resolve(),
      row.payload.version >= 6
        ? applyRemoteThemePreference(row.payload.themePreference)
        : Promise.resolve(),
      row.payload.version >= 7 && row.payload.profileState
        ? AsyncStorage.setItem(PROFILE_STATE_KEY, JSON.stringify(row.payload.profileState))
        : Promise.resolve(),
      row.payload.version >= 8 && row.payload.evolutionState
        ? AsyncStorage.setItem(EVOLUTION_STATE_KEY, JSON.stringify(row.payload.evolutionState))
        : Promise.resolve(),
      row.payload.onboardingComplete
        ? AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1")
        : AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY),
      AsyncStorage.setItem(LOCAL_CHANGED_AT_KEY, row.updated_at),
      AsyncStorage.setItem(LOCAL_BASE_REVISION_KEY, row.updated_at),
      AsyncStorage.removeItem(LOCAL_DIRTY_KEY),
      AsyncStorage.removeItem(LOCAL_CONFLICT_BACKUP_KEY),
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

async function pushLocalState(
  session?: Session,
  options: { expectedRevision?: string | null } = {}
): Promise<void> {
  if (!supabase) return;
  const currentSession = session ?? (await getSession());
  if (!currentSession) {
    updateStatus({ phase: "signed_out", authenticated: false, readyForData: true, email: null });
    return;
  }

  updateStatus({ phase: "syncing", email: currentSession.user.email ?? null });
  const payload = await readLocalSnapshot();
  const updatedAt = new Date().toISOString();
  const nextRow = { user_id: currentSession.user.id, payload, updated_at: updatedAt };
  let savedRevision = updatedAt;

  if (options.expectedRevision) {
    const { data, error } = await supabase
      .from("user_app_state")
      .update({ payload, updated_at: updatedAt })
      .eq("user_id", currentSession.user.id)
      .eq("updated_at", options.expectedRevision)
      .select("updated_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new SyncConflictError("A nuvem mudou antes do envio local.");
    savedRevision = data.updated_at;
  } else {
    const { data, error } = await supabase.from("user_app_state").insert(nextRow).select("updated_at").single();
    if (error) throw error;
    savedRevision = data.updated_at;
  }

  await AsyncStorage.multiSet([
    [LOCAL_CHANGED_AT_KEY, savedRevision],
    [LOCAL_BASE_REVISION_KEY, savedRevision],
    [LOCAL_OWNER_ID_KEY, currentSession.user.id],
  ]);
  await AsyncStorage.multiRemove([LOCAL_DIRTY_KEY, LOCAL_CONFLICT_BACKUP_KEY]);
  updateStatus({
    phase: "synced",
    authenticated: true,
    readyForData: true,
    email: currentSession.user.email ?? null,
    lastSyncAt: savedRevision,
    hasConflict: false,
    message: null,
  });
}

async function preserveSyncConflict(session: Session, remoteRevision: string) {
  const [snapshot, localChangedAt, baseRevision] = await Promise.all([
    readLocalSnapshot(),
    AsyncStorage.getItem(LOCAL_CHANGED_AT_KEY),
    AsyncStorage.getItem(LOCAL_BASE_REVISION_KEY),
  ]);
  const backup: SyncConflictBackup = {
    ownerId: session.user.id,
    snapshot,
    localChangedAt,
    baseRevision,
    remoteRevision,
    createdAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(LOCAL_CONFLICT_BACKUP_KEY, JSON.stringify(backup));
  updateStatus({
    phase: "conflict",
    authenticated: true,
    readyForData: true,
    email: session.user.email ?? null,
    hasConflict: true,
    message: "Este aparelho e a nuvem têm alterações diferentes. Nenhuma versão foi apagada.",
  });
}

async function performSync(): Promise<void> {
  if (!supabase) return;
  const session = await getSession();
  if (!session) {
    updateStatus({ phase: "signed_out", authenticated: false, readyForData: true, email: null, hasConflict: false, message: null });
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

  const localOwnerId = await AsyncStorage.getItem(LOCAL_OWNER_ID_KEY);
  const differentAccount = Boolean(localOwnerId && localOwnerId !== session.user.id);
  if (differentAccount) {
    if (shouldStartFreshForAccount(localOwnerId, session.user.id, Boolean(data))) {
      await replaceLocalDataWithFreshDefaults(session.user.id);
      await pushLocalState(session);
    } else if (data) {
      await applyCloudSnapshot(data);
      await AsyncStorage.setItem(LOCAL_OWNER_ID_KEY, session.user.id);
    }
    notifyDataChanged();
    return;
  }

  if (!data) {
    await pushLocalState(session);
    return;
  }

  const [localChangedAt, baseRevision, dirtyMarker] = await Promise.all([
    AsyncStorage.getItem(LOCAL_CHANGED_AT_KEY),
    AsyncStorage.getItem(LOCAL_BASE_REVISION_KEY),
    AsyncStorage.getItem(LOCAL_DIRTY_KEY),
  ]);
  const dirty = dirtyMarker === "1" || (!baseRevision && Boolean(localChangedAt && localChangedAt > data.updated_at));
  const action = decideSyncAction({
    hasRemote: true,
    baseRevision,
    remoteRevision: data.updated_at,
    dirty,
  });

  if (action === "conflict") {
    await preserveSyncConflict(session, data.updated_at);
    return;
  }

  if (action === "push_local") {
    try {
      await pushLocalState(session, { expectedRevision: data.updated_at });
    } catch (error) {
      if (!(error instanceof SyncConflictError)) throw error;
      const { data: latest, error: latestError } = await supabase
        .from("user_app_state")
        .select("updated_at")
        .eq("user_id", session.user.id)
        .single<{ updated_at: string }>();
      if (latestError) throw latestError;
      await preserveSyncConflict(session, latest.updated_at);
    }
    return;
  }

  await applyCloudSnapshot(data);
  await AsyncStorage.setItem(LOCAL_OWNER_ID_KEY, session.user.id);
  updateStatus({
    phase: "synced",
    authenticated: true,
    readyForData: true,
    email: session.user.email ?? null,
    lastSyncAt: data.updated_at,
    hasConflict: false,
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
  await AsyncStorage.multiSet([
    [LOCAL_CHANGED_AT_KEY, new Date().toISOString()],
    [LOCAL_DIRTY_KEY, "1"],
  ]);
  pendingLocalChange = true;
  notifyDataChanged();
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
        readyForData: true,
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

export async function resolveSyncConflict(choice: "cloud" | "local"): Promise<void> {
  if (!supabase) throw new Error("Sincronização não configurada.");
  const session = await getSession();
  if (!session) throw new Error("Entre na sua conta para resolver a sincronização.");
  const raw = await AsyncStorage.getItem(LOCAL_CONFLICT_BACKUP_KEY);
  if (!raw) {
    updateStatus({ hasConflict: false, message: null });
    await syncCloudNow();
    return;
  }
  const backup = JSON.parse(raw) as SyncConflictBackup;
  if (backup.ownerId !== session.user.id) throw new Error("A cópia local pertence a outra conta.");

  const { data, error } = await supabase
    .from("user_app_state")
    .select("payload, updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle<CloudRow>();
  if (error) throw error;

  if (choice === "cloud") {
    if (!data) throw new Error("A versão da nuvem não está mais disponível.");
    await applyCloudSnapshot(data);
    updateStatus({ phase: "synced", hasConflict: false, lastSyncAt: data.updated_at, message: null });
    return;
  }

  const baseRevision = data?.updated_at ?? null;
  await applyCloudSnapshot({ payload: backup.snapshot, updated_at: baseRevision ?? backup.createdAt });
  await markLocalChange();
  await pushLocalState(session, { expectedRevision: baseRevision });
  notifyDataChanged();
}

export async function resetUserData(): Promise<void> {
  if (!supabase) throw new Error("Sincronização não configurada.");
  if (activeSync) await activeSync.catch(() => undefined);
  const session = await getSession();
  if (!session) throw new Error("Entre na sua conta para zerar o progresso.");
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  pendingLocalChange = false;
  updateStatus({ phase: "syncing", authenticated: true, readyForData: false, email: session.user.email ?? null, message: null });

  const resetTask = (async () => {
    const { data, error } = await supabase
      .from("user_app_state")
      .select("updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle<{ updated_at: string }>();
    if (error) throw error;
    await replaceLocalDataWithFreshDefaults(session.user.id);
    await pushLocalState(session, data ? { expectedRevision: data.updated_at } : {});
    notifyDataChanged();
  })();
  activeSync = resetTask;
  try {
    await resetTask;
  } catch (error) {
    updateStatus({ phase: "error", readyForData: true, message: "Não foi possível zerar o progresso. Nenhuma nova tentativa será feita automaticamente." });
    throw error;
  } finally {
    activeSync = null;
  }
}

export async function initializeCloudSync(): Promise<void> {
  if (!supabase || initialized) return;
  initialized = true;

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    if (event === "PASSWORD_RECOVERY") {
      updateStatus({ passwordRecovery: true, authenticated: true, readyForData: true, email: session?.user.email ?? null });
      return;
    }
    if (!session) {
      updateStatus({ phase: "signed_out", authenticated: false, readyForData: true, passwordRecovery: false, email: null, hasConflict: false, message: null });
      return;
    }
    const sameUser = status.authenticated && status.email === (session.user.email ?? null);
    updateStatus({ phase: "syncing", authenticated: true, readyForData: sameUser ? status.readyForData : false, email: session.user.email ?? null });
    setTimeout(() => void syncCloudNow().catch(() => undefined), 0);
  });

  try {
    const session = await getSession();
    if (!session) {
      updateStatus({ phase: "signed_out", authenticated: false, readyForData: true, email: null, hasConflict: false, message: null });
      return;
    }
    updateStatus({ phase: "syncing", authenticated: true, readyForData: false, email: session.user.email ?? null });
    void syncCloudNow().catch(() => undefined);
  } catch (error) {
    subscription.unsubscribe();
    initialized = false;
    updateStatus({ phase: "error", readyForData: true, message: "Não foi possível recuperar a sessão. Tente novamente." });
    throw error;
  }
}

export async function signInToCloud(email: string, password: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  updateStatus({ phase: "syncing", message: null });
  try {
    const user = await signInWithPassword(supabase.auth, email, password);
    updateStatus({ phase: "syncing", authenticated: true, readyForData: false, email: user.email ?? null });
    void syncCloudNow().catch(() => undefined);
    return user;
  } catch (error) {
    updateStatus({ phase: "signed_out", authenticated: false, readyForData: true });
    throw error;
  }
}

export async function signUpForCloud(email: string, password: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  updateStatus({ phase: "syncing", message: null });
  try {
    const redirectTo = typeof window === "undefined" ? undefined : authRedirectUrl(window.location.origin);
    const result = await registerWithPassword(supabase.auth, email, password, redirectTo);
    if (!result.needsEmailConfirmation) {
      updateStatus({ phase: "syncing", authenticated: true, readyForData: false, email: normalizeEmail(email) });
      void syncCloudNow().catch(() => undefined);
    } else {
      updateStatus({
        phase: "confirmation_required",
        authenticated: false,
        readyForData: true,
        email: normalizeEmail(email),
        message: "Confira seu e-mail para confirmar a conta e depois entre no app.",
      });
    }
    return { needsEmailConfirmation: result.needsEmailConfirmation };
  } catch (error) {
    updateStatus({ phase: "signed_out", authenticated: false, readyForData: true });
    throw error;
  }
}

export async function sendPasswordReset(email: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  await requestPasswordReset(supabase.auth, email, typeof window === "undefined" ? undefined : authRedirectUrl(window.location.origin, true));
}

export async function resendConfirmation(email: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  await resendEmailConfirmation(supabase.auth, email, typeof window === "undefined" ? undefined : authRedirectUrl(window.location.origin));
}

export async function updateCloudPassword(password: string) {
  if (!supabase) throw new Error("Sincronização não configurada.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  updateStatus({ passwordRecovery: false });
}

export async function signOutFromCloud(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  updateStatus({
    phase: "signed_out",
    authenticated: false,
    readyForData: true,
    passwordRecovery: false,
    email: null,
    lastSyncAt: null,
    hasConflict: false,
    message: null,
  });
}

export function getSignedInUser(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  return getSession().then((session) => session?.user ?? null);
}
