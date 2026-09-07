import type {
  HydrationAlert,
  HydrationAlertReceipt,
  HydrationConfig,
  HydrationDaySnapshot,
  HydrationRecord,
  HydrationState,
  HydrationSummary,
} from "./types";

const DAY_MINUTES = 24 * 60;

export function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function addIsoDays(date: string, delta: number) {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return parsed.toISOString().slice(0, 10);
}

export function zonedDateParts(now: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function hydrationClock(now: Date, config: Pick<HydrationConfig, "dailyGoalMl" | "wakeTime" | "sleepTime" | "timezone">) {
  const wake = parseClock(config.wakeTime) ?? 8 * 60;
  const sleep = parseClock(config.sleepTime) ?? 23 * 60;
  const zoned = zonedDateParts(now, config.timezone);
  const crossesMidnight = sleep <= wake;
  const duration = crossesMidnight ? sleep + DAY_MINUTES - wake : sleep - wake;
  let date = zoned.date;
  let current = zoned.minutes;

  if (crossesMidnight && current < wake) {
    date = addIsoDays(date, -1);
    current += DAY_MINUTES;
  }

  const elapsed = current - wake;
  const progress = Math.max(0, Math.min(1, duration > 0 ? elapsed / duration : 1));
  return {
    date,
    progress,
    expectedMl: config.dailyGoalMl * progress,
    isActive: elapsed >= 0 && elapsed < duration,
    crossesMidnight,
  };
}

export function snapshotFromConfig(config: HydrationConfig, date: string, capturedAt = new Date().toISOString()): HydrationDaySnapshot {
  return { date, dailyGoalMl: config.dailyGoalMl, wakeTime: config.wakeTime, sleepTime: config.sleepTime, timezone: config.timezone, capturedAt };
}

export function totalForDate(records: HydrationRecord[], date: string) {
  return records.filter((record) => record.localDate === date).reduce((total, record) => total + record.amountMl, 0);
}

export function scopeHydrationStateToOwner(state: HydrationState, ownerId: string): HydrationState {
  return {
    ...state,
    config: { ...state.config, ownerId },
    containers: state.containers.map((container) => ({ ...container, ownerId })),
    records: state.records.map((record) => ({ ...record, ownerId })),
  };
}

export function hydrationSummary(state: HydrationState, now = new Date()): HydrationSummary {
  const clock = hydrationClock(now, state.config);
  const snapshot = state.daySnapshots[clock.date] ?? snapshotFromConfig(state.config, clock.date, now.toISOString());
  const goalMl = snapshot.dailyGoalMl;
  const expectedMl = goalMl * clock.progress;
  const consumedMl = totalForDate(state.records, clock.date);
  const toleranceMl = Math.max(100, goalMl * 0.05);
  const differenceMl = consumedMl - expectedMl;
  return {
    date: clock.date,
    goalMl,
    consumedMl,
    expectedMl,
    remainingMl: Math.max(0, goalMl - consumedMl),
    differenceMl,
    percentage: goalMl > 0 ? (consumedMl / goalMl) * 100 : 0,
    pace: differenceMl > toleranceMl ? "ahead" : differenceMl < -toleranceMl ? "behind" : "on_track",
    toleranceMl,
    activeProgress: clock.progress,
  };
}

export function summaryMessage(summary: HydrationSummary) {
  if (summary.consumedMl >= summary.goalMl) return `Meta concluída. Vc chegou a ${formatHydrationVolume(summary.consumedMl)} hoje.`;
  if (summary.pace === "behind") return `Faltam ${formatHydrationVolume(Math.abs(summary.differenceMl))} para acompanhar o ritmo até agora.`;
  if (summary.pace === "ahead") return `Vc está ${formatHydrationVolume(summary.differenceMl)} adiantado em relação ao ritmo.`;
  return "Vc está dentro do ritmo de hoje.";
}

export function formatHydrationVolume(amountMl: number) {
  const value = Math.max(0, amountMl);
  if (value >= 1000) return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
  return `${Math.round(value).toLocaleString("pt-BR")} ml`;
}

export function isClockInside(value: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? value >= start && value < end : value >= start || value < end;
}

export function selectHydrationAlert(
  state: HydrationState,
  summary: HydrationSummary,
  now = new Date()
): HydrationAlert | null {
  const config = state.config;
  if (!config.internalAlertsEnabled) return null;
  if (summary.activeProgress <= 0 || summary.activeProgress >= 1) return null;
  const zoned = zonedDateParts(now, config.timezone);
  const quietStart = config.quietStart ? parseClock(config.quietStart) : null;
  const quietEnd = config.quietEnd ? parseClock(config.quietEnd) : null;
  if (quietStart !== null && quietEnd !== null && isClockInside(zoned.minutes, quietStart, quietEnd)) return null;

  const records = state.records.filter((record) => record.localDate === summary.date);
  const lastRecord = records.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  const minutesSinceLast = lastRecord ? Math.max(0, (now.getTime() - Date.parse(lastRecord.occurredAt)) / 60000) : Infinity;
  const bucket = Math.max(0, Math.floor(summary.percentage / 10) * 10);
  let alert: Omit<HydrationAlert, "key"> | null = null;

  if (summary.consumedMl >= summary.goalMl) alert = { type: "goal", title: "Meta alcançada 💧", message: "Seu ritmo de hoje está completo. Continue ouvindo o seu corpo." };
  else if (summary.percentage >= 85) alert = { type: "near_goal", title: "Quase lá", message: `Faltam ${formatHydrationVolume(summary.remainingMl)} para concluir sua meta de hoje.` };
  else if (summary.pace === "behind" && summary.activeProgress > 0 && summary.activeProgress < 1) alert = { type: "behind", title: "Um gole de cada vez", message: summaryMessage(summary) };
  else if (summary.activeProgress > 0 && summary.activeProgress < 1 && minutesSinceLast >= Math.max(120, config.alertIntervalMinutes)) alert = { type: "long_gap", title: "Pausa para água?", message: "Faz um tempinho desde o último registro. Sem pressa e sem culpa." };
  if (!alert) return null;

  const key = `${summary.date}:${alert.type}:${alert.type === "goal" ? "done" : bucket}`;
  const receipt: HydrationAlertReceipt | undefined = state.alertReceipts[key];
  const lastSameType = Object.values(state.alertReceipts)
    .filter((item) => item.date === summary.date && item.type === alert.type)
    .sort((a, b) => b.lastShownAt.localeCompare(a.lastShownAt))[0];
  if (receipt?.dismissedAt) return null;
  if (receipt?.snoozedUntil && Date.parse(receipt.snoozedUntil) > now.getTime()) return null;
  if (lastSameType?.lastShownAt && now.getTime() - Date.parse(lastSameType.lastShownAt) < config.alertIntervalMinutes * 60000) return null;
  if (receipt?.lastShownAt && now.getTime() - Date.parse(receipt.lastShownAt) < config.alertIntervalMinutes * 60000) return null;
  return { ...alert, key };
}

export function appendRecord(state: HydrationState, record: HydrationRecord): HydrationState {
  if (state.records.some((item) => item.id === record.id || (record.idempotencyKey && item.idempotencyKey === record.idempotencyKey))) return state;
  return { ...state, records: [...state.records, record] };
}

export function replaceRecord(state: HydrationState, record: HydrationRecord): HydrationState {
  return { ...state, records: state.records.map((item) => item.id === record.id ? record : item) };
}

export function withoutRecord(state: HydrationState, recordId: string): HydrationState {
  return { ...state, records: state.records.filter((item) => item.id !== recordId) };
}
