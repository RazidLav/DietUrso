import { GLOBAL_EXERCISES } from "./catalog";
import type {
  ActivityType,
  ExerciseDefinition,
  PersonalRecord,
  PlannedSession,
  StrengthSetResult,
  TrainingDayEntry,
  TrainingHistoryFilters,
  TrainingHistorySummary,
  TrainingPlan,
  TrainingState,
  WorkoutPrescription,
  WorkoutResult,
  WorkoutSession,
  WorkoutSessionStatus,
} from "./types";

export function uid(prefix: string, now = Date.now()) {
  return `${prefix}-${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return localDate(value);
}

export function startOfWeek(date: string) {
  const value = new Date(`${date}T12:00:00`);
  const distance = (value.getDay() + 6) % 7;
  return addDays(date, -distance);
}

export function clonePrescription<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultPrescription(activityType: ActivityType): WorkoutPrescription {
  if (activityType === "strength") return { activityType, strength: { exercises: [] } };
  if (activityType === "mobility") return { activityType, mobility: { movements: [] } };
  if (activityType === "running") return { activityType, running: { kind: "easy", blocks: [] } };
  if (activityType === "cycling") return { activityType, cycling: { kind: "indoor", blocks: [] } };
  if (activityType === "crossfit") return { activityType, crossfit: { blocks: [], scale: "scaled" } };
  return { activityType, custom: { fields: [] } };
}

export function createInitialTrainingState(): TrainingState {
  return {
    version: 1,
    plans: [],
    templates: [],
    exercises: clonePrescription(GLOBAL_EXERCISES),
    plannedSessions: [],
    sessions: [],
    personalRecords: [],
  };
}

function validArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function sanitizeTrainingState(value: unknown): TrainingState {
  const initial = createInitialTrainingState();
  if (!value || typeof value !== "object") return initial;
  const candidate = value as Partial<TrainingState>;
  const storedExercises = validArray<ExerciseDefinition>(candidate.exercises);
  const storedById = new Map(storedExercises.map((exercise) => [exercise.id, exercise]));
  const globals = GLOBAL_EXERCISES.map((exercise) => ({
    ...exercise,
    favorite: storedById.get(exercise.id)?.favorite ?? exercise.favorite,
  }));
  const personal = storedExercises.filter((exercise) => exercise.scope === "personal" && typeof exercise.id === "string");
  return {
    version: 1,
    activePlanId: typeof candidate.activePlanId === "string" ? candidate.activePlanId : undefined,
    plans: validArray(candidate.plans),
    templates: validArray(candidate.templates),
    exercises: [...globals, ...personal.filter((exercise) => !globals.some((global) => global.id === exercise.id))],
    plannedSessions: validArray(candidate.plannedSessions),
    sessions: validArray(candidate.sessions),
    personalRecords: validArray(candidate.personalRecords),
  };
}

export function scopeTrainingStateToOwner(state: TrainingState, ownerId: string): TrainingState {
  return {
    ...state,
    plans: state.plans.map((item) => ({ ...item, ownerId })),
    templates: state.templates.map((item) => ({ ...item, ownerId })),
    exercises: state.exercises.map((item) => item.scope === "personal" ? { ...item, ownerId } : item),
    plannedSessions: state.plannedSessions.map((item) => ({ ...item, ownerId })),
    sessions: state.sessions.map((item) => ({ ...item, ownerId })),
    personalRecords: state.personalRecords.map((item) => ({ ...item, ownerId })),
  };
}

export function upsertTrainingPlanState(state: TrainingState, plan: TrainingPlan): TrainingState {
  const exists = state.plans.some((candidate) => candidate.id === plan.id);
  return {
    ...state,
    activePlanId: state.activePlanId ?? plan.id,
    plans: exists ? state.plans.map((candidate) => candidate.id === plan.id ? plan : candidate) : [...state.plans, plan],
  };
}

export function archiveTrainingPlanState(state: TrainingState, id: string, archivedAt?: string): TrainingState {
  const plans = state.plans.map((plan) => plan.id === id ? { ...plan, archivedAt, updatedAt: archivedAt ?? new Date().toISOString() } : plan);
  return { ...state, plans, activePlanId: archivedAt && state.activePlanId === id ? plans.find((plan) => !plan.archivedAt)?.id : state.activePlanId };
}

export function duplicateTrainingPlanState(
  state: TrainingState,
  id: string,
  newPlanId = uid("training-plan"),
  now = new Date(),
): { state: TrainingState; plan: TrainingPlan } {
  const source = state.plans.find((plan) => plan.id === id);
  if (!source) throw new Error("Plano de treino não encontrado.");
  let itemIndex = 0;
  const timestamp = now.toISOString();
  const plan: TrainingPlan = {
    ...clonePrescription(source),
    id: newPlanId,
    name: `${source.name} — cópia`,
    archivedAt: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    days: source.days.map((day) => ({ ...day, items: day.items.map((item, order) => ({ ...clonePrescription(item), id: `${newPlanId}-item-${itemIndex++}`, order })) })),
  };
  return { state: { ...state, plans: [...state.plans, plan] }, plan };
}

export function upsertExerciseState(state: TrainingState, exercise: ExerciseDefinition): TrainingState {
  const existing = state.exercises.find((candidate) => candidate.id === exercise.id);
  if (existing?.scope === "global") throw new Error("Exercícios globais são somente leitura.");
  return { ...state, exercises: existing ? state.exercises.map((candidate) => candidate.id === exercise.id ? exercise : candidate) : [...state.exercises, exercise] };
}

function dateInPlan(date: string, plan: TrainingPlan) {
  return (!plan.validFrom || date >= plan.validFrom) && (!plan.validUntil || date <= plan.validUntil);
}

export function materializePlans(state: TrainingState, from: string, to: string, now = new Date()): TrainingState {
  const existingKeys = new Set(state.plannedSessions.map((session) => session.idempotencyKey).filter(Boolean));
  const created: PlannedSession[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    for (const plan of state.plans.filter((candidate) => !candidate.archivedAt && candidate.repeatWeekly && dateInPlan(date, candidate))) {
      for (const item of plan.days.find((day) => day.weekday === weekday)?.items ?? []) {
        const idempotencyKey = `plan:${plan.id}:${item.id}:${date}`;
        if (existingKeys.has(idempotencyKey)) continue;
        const timestamp = now.toISOString();
        created.push({
          id: uid("planned", now.getTime() + created.length),
          ownerId: plan.ownerId,
          planId: plan.id,
          planItemId: item.id,
          templateId: item.templateId,
          name: item.name,
          activityType: item.activityType,
          date,
          scheduledTime: item.scheduledTime,
          estimatedDurationMinutes: item.estimatedDurationMinutes,
          status: "planned",
          prescriptionSnapshot: clonePrescription(item.prescription),
          sortOrder: item.order,
          idempotencyKey,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        existingKeys.add(idempotencyKey);
      }
    }
  }
  return created.length ? { ...state, plannedSessions: [...state.plannedSessions, ...created] } : state;
}

export function createWorkoutResult(prescription: WorkoutPrescription): WorkoutResult {
  return {
    strengthSets: (prescription.strength?.exercises ?? []).flatMap((exercise) => exercise.sets.map((set) => ({
      id: uid("set-result"),
      planSetId: set.id,
      exercisePlanId: exercise.id,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseSnapshot.name,
      status: "pending" as const,
      loadUnit: set.loadUnit,
    }))),
    mobilityMovements: (prescription.mobility?.movements ?? []).map((movement) => ({
      id: uid("movement-result"),
      movementPlanId: movement.id,
      status: "pending" as const,
    })),
    running: prescription.running ? { completedBlockIds: [] } : undefined,
    cycling: prescription.cycling ? { completedBlockIds: [] } : undefined,
    crossfit: prescription.crossfit ? { completedBlockIds: [], scale: prescription.crossfit.scale } : undefined,
    customFields: prescription.custom?.fields.map((field) => ({ ...field, value: "" })),
  };
}

export function beginSession(state: TrainingState, plannedSessionId: string, now = new Date()): { state: TrainingState; session: WorkoutSession } {
  const planned = state.plannedSessions.find((candidate) => candidate.id === plannedSessionId);
  if (!planned) throw new Error("Sessão planejada não encontrada.");
  if (planned.status !== "planned") throw new Error("Esta sessão não pode ser iniciada.");
  const existing = state.sessions.find((candidate) => candidate.plannedSessionId === plannedSessionId);
  if (existing) return { state, session: existing };
  const timestamp = now.toISOString();
  const session: WorkoutSession = {
    id: uid("session", now.getTime()),
    ownerId: planned.ownerId,
    plannedSessionId,
    name: planned.name,
    activityType: planned.activityType,
    date: planned.date,
    scheduledTime: planned.scheduledTime,
    status: "in_progress",
    isPaused: false,
    prescriptionSnapshot: clonePrescription(planned.prescriptionSnapshot),
    result: createWorkoutResult(planned.prescriptionSnapshot),
    startedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    idempotencyKey: `start:${plannedSessionId}`,
  };
  return { state: { ...state, sessions: [...state.sessions, session] }, session };
}

export function updateSession(state: TrainingState, updated: WorkoutSession): TrainingState {
  const index = state.sessions.findIndex((session) => session.id === updated.id);
  if (index < 0) throw new Error("Sessão não encontrada.");
  return { ...state, sessions: state.sessions.map((session) => session.id === updated.id ? updated : session) };
}

export function finishSession(
  state: TrainingState,
  sessionId: string,
  status: Extract<WorkoutSessionStatus, "completed" | "partial">,
  durationMinutes?: number,
  now = new Date(),
) {
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  if (!session) throw new Error("Sessão não encontrada.");
  const computedDuration = Math.max(1, Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 60000));
  const next = {
    ...session,
    status,
    isPaused: false,
    pausedAt: undefined,
    completedAt: now.toISOString(),
    durationMinutes: durationMinutes && durationMinutes > 0 ? Math.round(durationMinutes) : computedDuration,
    updatedAt: now.toISOString(),
  };
  return updateSession(state, next);
}

export function strengthVolume(session: WorkoutSession) {
  return session.result.strengthSets.reduce((total, set) => {
    if (set.status !== "completed" || !set.performedLoad || !set.performedReps) return total;
    return total + set.performedLoad * set.performedReps;
  }, 0);
}

export function sessionProgress(session: WorkoutSession | undefined) {
  if (!session) return 0;
  if (session.status === "completed") return 1;
  const checks = [
    ...session.result.strengthSets.map((set) => set.status !== "pending"),
    ...session.result.mobilityMovements.map((movement) => movement.status !== "pending"),
    ...(session.result.running ? session.prescriptionSnapshot.running?.blocks.map((block) => session.result.running!.completedBlockIds.includes(block.id)) ?? [] : []),
    ...(session.result.cycling ? session.prescriptionSnapshot.cycling?.blocks.map((block) => session.result.cycling!.completedBlockIds.includes(block.id)) ?? [] : []),
    ...(session.result.crossfit ? session.prescriptionSnapshot.crossfit?.blocks.map((block) => session.result.crossfit!.completedBlockIds.includes(block.id)) ?? [] : []),
  ];
  if (!checks.length) return session.status === "partial" ? 0.5 : 0;
  return checks.filter(Boolean).length / checks.length;
}

export function dayEntries(state: TrainingState, date: string): TrainingDayEntry[] {
  return state.plannedSessions
    .filter((planned) => planned.date === date && !planned.replacedById)
    .map((planned) => {
      const execution = state.sessions.find((session) => session.plannedSessionId === planned.id);
      return { planned, execution, status: execution?.status ?? planned.status, progress: sessionProgress(execution) };
    })
    .sort((a, b) => (a.planned.scheduledTime ?? "99:99").localeCompare(b.planned.scheduledTime ?? "99:99") || a.planned.sortOrder - b.planned.sortOrder);
}

export function completedStrengthSet(
  set: StrengthSetResult,
  values: Partial<Pick<StrengthSetResult, "performedReps" | "performedLoad" | "loadUnit" | "rir" | "rpe" | "notes">>,
  now = new Date(),
) {
  return { ...set, ...values, status: "completed" as const, completedAt: now.toISOString() };
}

function recordBeats(previous: PersonalRecord | undefined, metric: PersonalRecord["metric"], value: number) {
  if (!previous) return true;
  return metric === "fastest_5k" || metric === "fastest_10k" ? value < previous.value : value > previous.value;
}

export function newPersonalRecords(state: TrainingState, session: WorkoutSession): PersonalRecord[] {
  if (session.status !== "completed") return [];
  const candidates: Omit<PersonalRecord, "id" | "ownerId" | "achievedAt" | "dedupeKey">[] = [];
  session.result.strengthSets.filter((set) => set.status === "completed" && (set.performedReps ?? 0) > 0).forEach((set) => {
    if ((set.performedLoad ?? 0) > 0) {
      candidates.push({ sessionId: session.id, exerciseId: set.exerciseId, exerciseName: set.exerciseName, metric: "max_load", value: set.performedLoad!, unit: set.loadUnit ?? "kg" });
      candidates.push({ sessionId: session.id, exerciseId: set.exerciseId, exerciseName: set.exerciseName, metric: "set_volume", value: set.performedLoad! * set.performedReps!, unit: `${set.loadUnit ?? "kg"}·rep` });
    }
    candidates.push({ sessionId: session.id, exerciseId: set.exerciseId, exerciseName: set.exerciseName, metric: "max_reps", value: set.performedReps!, unit: "reps" });
  });
  const running = session.result.running;
  if (running?.distanceKm && running.durationMinutes) {
    if (running.distanceKm >= 5) candidates.push({ sessionId: session.id, metric: "fastest_5k", value: running.durationMinutes * (5 / running.distanceKm), unit: "min" });
    if (running.distanceKm >= 10) candidates.push({ sessionId: session.id, metric: "fastest_10k", value: running.durationMinutes * (10 / running.distanceKm), unit: "min" });
  }
  if ((session.result.cycling?.distanceKm ?? 0) > 0) candidates.push({ sessionId: session.id, metric: "cycling_distance", value: session.result.cycling!.distanceKm!, unit: "km" });

  const timestamp = session.completedAt ?? session.updatedAt;
  return candidates.flatMap((candidate) => {
    const scope = candidate.exerciseId ?? candidate.exerciseName ?? "cardio";
    const previous = state.personalRecords
      .filter((record) => record.metric === candidate.metric && (record.exerciseId ?? record.exerciseName ?? "cardio") === scope)
      .sort((a, b) => candidate.metric.startsWith("fastest") ? a.value - b.value : b.value - a.value)[0];
    const dedupeKey = `pr:${session.id}:${candidate.metric}:${scope}`;
    if (state.personalRecords.some((record) => record.dedupeKey === dedupeKey) || !recordBeats(previous, candidate.metric, candidate.value)) return [];
    return [{ ...candidate, id: uid("record"), ownerId: session.ownerId, achievedAt: timestamp, dedupeKey }];
  });
}

export function filterSessions(state: TrainingState, filters: TrainingHistoryFilters) {
  return state.sessions.filter((session) => {
    if (filters.from && session.date < filters.from) return false;
    if (filters.to && session.date > filters.to) return false;
    if (filters.activityType && session.activityType !== filters.activityType) return false;
    if (filters.status && !["in_progress", "completed", "partial"].includes(filters.status)) return false;
    if (filters.status && session.status !== filters.status) return false;
    if (filters.planId) {
      const planned = state.plannedSessions.find((candidate) => candidate.id === session.plannedSessionId);
      if (planned?.planId !== filters.planId) return false;
    }
    if (filters.exerciseId && !session.prescriptionSnapshot.strength?.exercises.some((exercise) => exercise.exerciseId === filters.exerciseId)) return false;
    return true;
  }).sort((a, b) => `${b.date}${b.completedAt ?? b.startedAt}`.localeCompare(`${a.date}${a.completedAt ?? a.startedAt}`));
}

export function historySummary(state: TrainingState, filters: TrainingHistoryFilters = {}): TrainingHistorySummary {
  const sessions = filterSessions(state, filters);
  const planned = state.plannedSessions.filter((session) => {
    if (filters.from && session.date < filters.from) return false;
    if (filters.to && session.date > filters.to) return false;
    if (filters.activityType && session.activityType !== filters.activityType) return false;
    if (filters.planId && session.planId !== filters.planId) return false;
    if (filters.exerciseId && !session.prescriptionSnapshot.strength?.exercises.some((exercise) => exercise.exerciseId === filters.exerciseId)) return false;
    return true;
  }).length;
  const completed = sessions.filter((session) => session.status === "completed");
  const dates = sessions.map((session) => session.date).sort();
  const spanDays = dates.length ? Math.max(1, Math.round((Date.parse(`${dates.at(-1)}T12:00:00Z`) - Date.parse(`${dates[0]}T12:00:00Z`)) / 86400000) + 1) : 7;
  return {
    planned,
    completed: completed.length,
    partial: sessions.filter((session) => session.status === "partial").length,
    totalDurationMinutes: sessions.reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0),
    strengthVolume: sessions.reduce((sum, session) => sum + strengthVolume(session), 0),
    runningDistanceKm: sessions.reduce((sum, session) => sum + (session.result.running?.distanceKm ?? 0), 0),
    cyclingDistanceKm: sessions.reduce((sum, session) => sum + (session.result.cycling?.distanceKm ?? 0), 0),
    mobilityMinutes: sessions.filter((session) => session.activityType === "mobility").reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0),
    weeklyFrequency: Math.round((completed.length / Math.max(1, spanDays / 7)) * 10) / 10,
  };
}

export function trainingDatesByStatus(state: TrainingState, status: WorkoutSessionStatus = "completed") {
  return Array.from(new Set(state.sessions.filter((session) => session.status === status).map((session) => session.date))).sort();
}
