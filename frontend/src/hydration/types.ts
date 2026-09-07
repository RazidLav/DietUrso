export type HydrationSource = "quick" | "container" | "manual" | "legacy";
export type HydrationPace = "ahead" | "on_track" | "behind";
export type HydrationAlertType = "behind" | "goal" | "long_gap" | "near_goal";

export interface HydrationConfig {
  id: string;
  ownerId?: string;
  dailyGoalMl: number;
  wakeTime: string;
  sleepTime: string;
  timezone: string;
  internalAlertsEnabled: boolean;
  alertIntervalMinutes: number;
  quietStart?: string;
  quietEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HydrationContainer {
  id: string;
  ownerId?: string;
  name: string;
  volumeMl: number;
  icon?: string;
  color?: string;
  isFavorite: boolean;
  sortOrder: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HydrationDaySnapshot {
  date: string;
  dailyGoalMl: number;
  wakeTime: string;
  sleepTime: string;
  timezone: string;
  capturedAt: string;
}

export interface HydrationRecord {
  id: string;
  ownerId?: string;
  amountMl: number;
  occurredAt: string;
  localDate: string;
  containerId?: string;
  containerSnapshot?: { name: string; volumeMl: number; icon?: string; color?: string };
  source: HydrationSource;
  notes?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HydrationAlertReceipt {
  key: string;
  type: HydrationAlertType;
  date: string;
  lastShownAt: string;
  dismissedAt?: string;
  snoozedUntil?: string;
}

export interface HydrationState {
  version: 1;
  config: HydrationConfig;
  containers: HydrationContainer[];
  records: HydrationRecord[];
  daySnapshots: Record<string, HydrationDaySnapshot>;
  alertReceipts: Record<string, HydrationAlertReceipt>;
}

export interface HydrationSummary {
  date: string;
  goalMl: number;
  consumedMl: number;
  expectedMl: number;
  remainingMl: number;
  differenceMl: number;
  percentage: number;
  pace: HydrationPace;
  toleranceMl: number;
  activeProgress: number;
}

export interface HydrationAlert {
  key: string;
  type: HydrationAlertType;
  title: string;
  message: string;
}
