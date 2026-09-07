import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSignedInUser, markLocalChange, syncCloudNow } from "../cloud/cloudSync";
import {
  appendRecord,
  hydrationClock,
  hydrationSummary,
  replaceRecord,
  scopeHydrationStateToOwner,
  snapshotFromConfig,
  withoutRecord,
  zonedDateParts,
} from "../hydration/calculations";
import { persistWithRollback } from "../hydration/transaction";
import type {
  HydrationAlert,
  HydrationAlertReceipt,
  HydrationAlertType,
  HydrationConfig,
  HydrationContainer,
  HydrationRecord,
  HydrationSource,
  HydrationState,
} from "../hydration/types";
import { evaluateGamification } from "../gamification/engine";
import { HYDRATION_STATE_KEY, WATER_KEY } from "./storageKeys";

type WaterByDate = Record<string, number>;

const DEFAULT_GOAL_ML = 2500;
let mutationQueue: Promise<unknown> = Promise.resolve();

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Fortaleza";
  } catch {
    return "America/Fortaleza";
  }
}

export function createInitialHydrationState(now = new Date()): HydrationState {
  const iso = now.toISOString();
  const config: HydrationConfig = {
    id: "hydration-config",
    dailyGoalMl: DEFAULT_GOAL_ML,
    wakeTime: "07:00",
    sleepTime: "23:00",
    timezone: deviceTimezone(),
    internalAlertsEnabled: true,
    alertIntervalMinutes: 120,
    quietStart: "22:30",
    quietEnd: "07:00",
    createdAt: iso,
    updatedAt: iso,
  };
  const clock = hydrationClock(now, config);
  return {
    version: 1,
    config,
    containers: [
      {
        id: "default-cup-250",
        name: "Copo",
        volumeMl: 250,
        icon: "cup-water",
        color: "#0A84FF",
        isFavorite: true,
        sortOrder: 0,
        createdAt: iso,
        updatedAt: iso,
      },
      {
        id: "default-bottle-500",
        name: "Garrafa",
        volumeMl: 500,
        icon: "bottle-soda-classic-outline",
        color: "#34C759",
        isFavorite: true,
        sortOrder: 1,
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    records: [],
    daySnapshots: { [clock.date]: snapshotFromConfig(config, clock.date, iso) },
    alertReceipts: {},
  };
}

function validTimezone(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return deviceTimezone();
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
    return value;
  } catch {
    return deviceTimezone();
  }
}

export function sanitizeHydrationState(value: unknown, now = new Date()): HydrationState {
  const initial = createInitialHydrationState(now);
  if (!value || typeof value !== "object") return initial;
  const candidate = value as Partial<HydrationState>;
  const rawConfig = candidate.config as Partial<HydrationConfig> | undefined;
  const dailyGoalMl = Number(rawConfig?.dailyGoalMl);
  const interval = Number(rawConfig?.alertIntervalMinutes);
  const config: HydrationConfig = {
    ...initial.config,
    ...rawConfig,
    id: typeof rawConfig?.id === "string" ? rawConfig.id : initial.config.id,
    dailyGoalMl: Number.isFinite(dailyGoalMl) && dailyGoalMl > 0 ? Math.round(dailyGoalMl) : DEFAULT_GOAL_ML,
    wakeTime: typeof rawConfig?.wakeTime === "string" ? rawConfig.wakeTime : initial.config.wakeTime,
    sleepTime: typeof rawConfig?.sleepTime === "string" ? rawConfig.sleepTime : initial.config.sleepTime,
    timezone: validTimezone(rawConfig?.timezone),
    internalAlertsEnabled: rawConfig?.internalAlertsEnabled !== false,
    alertIntervalMinutes: Number.isFinite(interval) && interval >= 15 ? Math.round(interval) : 120,
    createdAt: typeof rawConfig?.createdAt === "string" ? rawConfig.createdAt : initial.config.createdAt,
    updatedAt: typeof rawConfig?.updatedAt === "string" ? rawConfig.updatedAt : initial.config.updatedAt,
  };
  return {
    version: 1,
    config,
    containers: Array.isArray(candidate.containers)
      ? candidate.containers.filter((item): item is HydrationContainer => Boolean(item && typeof item.id === "string" && Number(item.volumeMl) > 0))
      : initial.containers,
    records: Array.isArray(candidate.records)
      ? candidate.records.filter((item): item is HydrationRecord => Boolean(item && typeof item.id === "string" && Number(item.amountMl) > 0 && typeof item.localDate === "string"))
      : [],
    daySnapshots: candidate.daySnapshots && typeof candidate.daySnapshots === "object" ? candidate.daySnapshots : {},
    alertReceipts: candidate.alertReceipts && typeof candidate.alertReceipts === "object" ? candidate.alertReceipts : {},
  };
}

function totalsByDate(state: HydrationState): WaterByDate {
  return state.records.reduce<WaterByDate>((totals, record) => {
    totals[record.localDate] = (totals[record.localDate] ?? 0) + record.amountMl;
    return totals;
  }, {});
}

async function writeState(state: HydrationState) {
  await AsyncStorage.multiSet([
    [HYDRATION_STATE_KEY, JSON.stringify(state)],
    [WATER_KEY, JSON.stringify(totalsByDate(state))],
  ]);
}

function legacyState(water: WaterByDate, now = new Date()) {
  const state = createInitialHydrationState(now);
  const iso = now.toISOString();
  for (const [date, amount] of Object.entries(water)) {
    if (!Number.isFinite(amount) || amount <= 0) continue;
    state.records.push({
      id: `legacy-${date}`,
      amountMl: Math.round(amount),
      occurredAt: `${date}T12:00:00.000Z`,
      localDate: date,
      source: "legacy",
      notes: "Importado do contador de água anterior",
      idempotencyKey: `legacy-water:${date}`,
      createdAt: iso,
      updatedAt: iso,
    });
    state.daySnapshots[date] = snapshotFromConfig(state.config, date, iso);
  }
  return state;
}

export async function ensureHydrationSeed() {
  const stored = await AsyncStorage.getItem(HYDRATION_STATE_KEY);
  if (stored) {
    try {
      const state = sanitizeHydrationState(JSON.parse(stored));
      await writeState(state);
      return state;
    } catch {
      // Um estado inválido é recriado abaixo, sem impedir a abertura do app.
    }
  }
  const rawWater = await AsyncStorage.getItem(WATER_KEY);
  let water: WaterByDate = {};
  try {
    water = rawWater ? JSON.parse(rawWater) as WaterByDate : {};
  } catch {
    water = {};
  }
  const state = legacyState(water);
  await writeState(state);
  return state;
}

export async function getHydrationState() {
  const raw = await AsyncStorage.getItem(HYDRATION_STATE_KEY);
  if (!raw) return ensureHydrationSeed();
  try {
    return sanitizeHydrationState(JSON.parse(raw));
  } catch {
    return ensureHydrationSeed();
  }
}

export async function getHydrationSummary(now = new Date()) {
  return hydrationSummary(await getHydrationState(), now);
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const task = mutationQueue.then(operation, operation);
  mutationQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function commit(previous: HydrationState, next: HydrationState, authenticated: boolean) {
  return persistWithRollback(
    previous,
    next,
    async (state) => {
      await writeState(state);
      await markLocalChange();
      if (authenticated) await syncCloudNow();
    },
    async (state) => {
      await writeState(state);
    }
  );
}

async function mutate(transform: (state: HydrationState) => HydrationState, gamify = false) {
  return enqueue(async () => {
    const previous = await getHydrationState();
    const user = await getSignedInUser();
    const base = user ? scopeHydrationStateToOwner(previous, user.id) : previous;
    const next = transform(base);
    if (next === previous) return previous;
    const saved = await commit(previous, next, Boolean(user));
    if (gamify) await evaluateGamification();
    return saved;
  });
}

export interface AddHydrationInput {
  amountMl: number;
  source: Exclude<HydrationSource, "legacy">;
  occurredAt?: string;
  containerId?: string;
  notes?: string;
  idempotencyKey?: string;
}

export async function addHydrationRecord(input: AddHydrationInput) {
  const amountMl = Math.round(Number(input.amountMl));
  if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 50000) throw new Error("Informe uma quantidade de água válida.");
  let created: HydrationRecord | undefined;
  await mutate((state) => {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const clock = hydrationClock(new Date(occurredAt), state.config);
    const container = input.containerId ? state.containers.find((item) => item.id === input.containerId) : undefined;
    const ownerId = state.config.ownerId;
    const timestamp = new Date().toISOString();
    created = {
      id: uid("water"),
      ownerId,
      amountMl,
      occurredAt,
      localDate: clock.date,
      containerId: container?.id,
      containerSnapshot: container ? { name: container.name, volumeMl: container.volumeMl, icon: container.icon, color: container.color } : undefined,
      source: input.source,
      notes: input.notes?.trim() || undefined,
      idempotencyKey: input.idempotencyKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const withRecord = appendRecord(state, created);
    if (withRecord === state) return state;
    return {
      ...withRecord,
      daySnapshots: state.daySnapshots[clock.date]
        ? state.daySnapshots
        : { ...state.daySnapshots, [clock.date]: snapshotFromConfig(state.config, clock.date, timestamp) },
    };
  }, true);
  if (!created) throw new Error("Não foi possível criar o registro.");
  return created;
}

export async function updateHydrationRecord(id: string, updates: { amountMl: number; occurredAt?: string; notes?: string }) {
  const amountMl = Math.round(Number(updates.amountMl));
  if (!Number.isFinite(amountMl) || amountMl <= 0 || amountMl > 50000) throw new Error("Informe uma quantidade de água válida.");
  return mutate((state) => {
    const record = state.records.find((item) => item.id === id);
    if (!record) throw new Error("Registro de água não encontrado.");
    const occurredAt = updates.occurredAt ?? record.occurredAt;
    const localDate = updates.occurredAt ? hydrationClock(new Date(occurredAt), state.config).date : record.localDate;
    return replaceRecord(state, { ...record, amountMl, occurredAt, localDate, notes: updates.notes?.trim() || undefined, updatedAt: new Date().toISOString() });
  }, true);
}

export async function deleteHydrationRecord(id: string) {
  return mutate((state) => state.records.some((record) => record.id === id) ? withoutRecord(state, id) : state, true);
}

export async function undoLastHydrationRecord(date?: string) {
  let removed: HydrationRecord | null = null;
  await mutate((state) => {
    const targetDate = date ?? hydrationClock(new Date(), state.config).date;
    removed = state.records.filter((record) => record.localDate === targetDate).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    return removed ? withoutRecord(state, removed.id) : state;
  }, true);
  return removed;
}

export async function updateHydrationConfig(input: Partial<Pick<HydrationConfig, "dailyGoalMl" | "wakeTime" | "sleepTime" | "timezone" | "internalAlertsEnabled" | "alertIntervalMinutes" | "quietStart" | "quietEnd">>) {
  return mutate((state) => {
    const updatedAt = new Date().toISOString();
    const config = { ...state.config, ...input, dailyGoalMl: input.dailyGoalMl ? Math.round(input.dailyGoalMl) : state.config.dailyGoalMl, timezone: input.timezone ? validTimezone(input.timezone) : state.config.timezone, updatedAt };
    const clock = hydrationClock(new Date(), config);
    return { ...state, config, daySnapshots: { ...state.daySnapshots, [clock.date]: snapshotFromConfig(config, clock.date, updatedAt) } };
  });
}

export async function saveHydrationContainer(input: Partial<HydrationContainer> & { name: string; volumeMl: number }) {
  const volumeMl = Math.round(Number(input.volumeMl));
  if (!input.name.trim() || !Number.isFinite(volumeMl) || volumeMl <= 0 || volumeMl > 50000) throw new Error("Informe nome e volume válidos.");
  let saved: HydrationContainer | undefined;
  await mutate((state) => {
    const existing = input.id ? state.containers.find((item) => item.id === input.id) : undefined;
    const now = new Date().toISOString();
    saved = {
      id: existing?.id ?? uid("container"),
      ownerId: state.config.ownerId,
      name: input.name.trim(),
      volumeMl,
      icon: input.icon || existing?.icon || "cup-water",
      color: input.color || existing?.color || "#0A84FF",
      isFavorite: input.isFavorite ?? existing?.isFavorite ?? false,
      sortOrder: existing?.sortOrder ?? state.containers.length,
      archivedAt: existing?.archivedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    return { ...state, containers: existing ? state.containers.map((item) => item.id === saved!.id ? saved! : item) : [...state.containers, saved] };
  });
  return saved!;
}

export async function toggleHydrationContainerFavorite(id: string) {
  return mutate((state) => ({ ...state, containers: state.containers.map((item) => item.id === id ? { ...item, isFavorite: !item.isFavorite, updatedAt: new Date().toISOString() } : item) }));
}

export async function setHydrationContainerArchived(id: string, archived: boolean) {
  return mutate((state) => ({ ...state, containers: state.containers.map((item) => item.id === id ? { ...item, archivedAt: archived ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : item) }));
}

export async function moveHydrationContainer(id: string, direction: -1 | 1) {
  return mutate((state) => {
    const ordered = state.containers.slice().sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return state;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const updatedAt = new Date().toISOString();
    return { ...state, containers: ordered.map((item, sortOrder) => ({ ...item, sortOrder, updatedAt })) };
  });
}

export async function recordHydrationAlert(alert: HydrationAlert, action: "shown" | "dismiss" | "snooze", now = new Date()) {
  return mutate((state) => {
    const previous = state.alertReceipts[alert.key];
    const receipt: HydrationAlertReceipt = {
      key: alert.key,
      type: alert.type as HydrationAlertType,
      date: alert.key.slice(0, 10),
      lastShownAt: action === "shown" ? now.toISOString() : previous?.lastShownAt ?? now.toISOString(),
      dismissedAt: action === "dismiss" ? now.toISOString() : previous?.dismissedAt,
      snoozedUntil: action === "snooze" ? new Date(now.getTime() + state.config.alertIntervalMinutes * 60000).toISOString() : previous?.snoozedUntil,
    };
    return { ...state, alertReceipts: { ...state.alertReceipts, [alert.key]: receipt } };
  });
}

export function hydrationDateForNow(state: HydrationState, now = new Date()) {
  return hydrationClock(now, state.config).date;
}

export function hydrationCalendarDate(state: HydrationState, now = new Date()) {
  return zonedDateParts(now, state.config.timezone).date;
}
