import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSignedInUser, markLocalChange, syncCloudNow } from "../cloud/cloudSync";
import { evaluateGamification } from "../gamification/engine";
import {
  beginSession,
  clonePrescription,
  createDefaultPrescription,
  createInitialTrainingState,
  finishSession,
  localDate,
  materializePlans,
  newPersonalRecords,
  sanitizeTrainingState,
  scopeTrainingStateToOwner,
  uid,
  updateSession,
  upsertExerciseState,
  upsertTrainingPlanState,
  archiveTrainingPlanState,
  duplicateTrainingPlanState,
} from "../training/calculations";
import { persistTrainingWithRollback } from "../training/transaction";
import type {
  ActivityType,
  CyclingResult,
  ExerciseDefinition,
  PlannedSession,
  PlannedSessionStatus,
  RunningResult,
  StrengthSetResult,
  TrainingPlan,
  TrainingPlanItem,
  TrainingState,
  WorkoutPrescription,
  WorkoutSession,
  WorkoutTemplate,
  CrossfitResult,
} from "../training/types";
import { TRAINING_STATE_KEY } from "./storageKeys";

let trainingQueue: Promise<unknown> = Promise.resolve();

async function writeTrainingState(state: TrainingState) {
  await AsyncStorage.setItem(TRAINING_STATE_KEY, JSON.stringify(state));
}

export async function ensureTrainingSeed() {
  const raw = await AsyncStorage.getItem(TRAINING_STATE_KEY);
  const state = raw ? sanitizeTrainingState(JSON.parse(raw)) : createInitialTrainingState();
  await writeTrainingState(state);
  return state;
}

export async function getTrainingState() {
  const raw = await AsyncStorage.getItem(TRAINING_STATE_KEY);
  if (!raw) return ensureTrainingSeed();
  try {
    return sanitizeTrainingState(JSON.parse(raw));
  } catch {
    return ensureTrainingSeed();
  }
}

function enqueue<T>(operation: () => Promise<T>) {
  const task = trainingQueue.then(operation, operation);
  trainingQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function commit(previous: TrainingState, next: TrainingState, authenticated: boolean) {
  return persistTrainingWithRollback(
    previous,
    next,
    async (value) => {
      await writeTrainingState(value);
      await markLocalChange();
      if (authenticated) await syncCloudNow();
    },
    writeTrainingState,
  );
}

async function mutate(
  transform: (state: TrainingState, ownerId?: string) => TrainingState,
  gamify = false,
) {
  return enqueue(async () => {
    const previous = await getTrainingState();
    const user = await getSignedInUser();
    const base = user ? scopeTrainingStateToOwner(previous, user.id) : previous;
    const next = transform(base, user?.id);
    if (next === base && base === previous) return previous;
    const saved = await commit(previous, next, Boolean(user));
    if (gamify) await evaluateGamification();
    return saved;
  });
}

export async function prepareTrainingRange(from: string, to: string) {
  return mutate((state) => materializePlans(state, from, to));
}

export interface SaveTrainingPlanInput {
  id?: string;
  name: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  repeatWeekly?: boolean;
}

export async function saveTrainingPlan(input: SaveTrainingPlanInput) {
  if (!input.name.trim()) throw new Error("Informe o nome do plano.");
  let saved: TrainingPlan | undefined;
  await mutate((state, ownerId) => {
    const current = input.id ? state.plans.find((plan) => plan.id === input.id) : undefined;
    const timestamp = new Date().toISOString();
    saved = {
      id: current?.id ?? uid("training-plan"),
      ownerId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      validFrom: input.validFrom || undefined,
      validUntil: input.validUntil || undefined,
      repeatWeekly: input.repeatWeekly ?? current?.repeatWeekly ?? true,
      days: current?.days ?? Array.from({ length: 7 }, (_, weekday) => ({ weekday, items: [] })),
      archivedAt: current?.archivedAt,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return upsertTrainingPlanState(state, saved);
  });
  return saved!;
}

export async function setActiveTrainingPlan(id: string) {
  return mutate((state) => state.plans.some((plan) => plan.id === id && !plan.archivedAt) ? { ...state, activePlanId: id } : state);
}

export async function duplicateTrainingPlan(id: string) {
  let duplicate: TrainingPlan | undefined;
  await mutate((state, ownerId) => {
    const result = duplicateTrainingPlanState(state, id);
    duplicate = { ...result.plan, ownerId };
    return { ...result.state, plans: result.state.plans.map((plan) => plan.id === duplicate!.id ? duplicate! : plan) };
  });
  return duplicate!;
}

export async function setTrainingPlanArchived(id: string, archived: boolean) {
  return mutate((state) => {
    const timestamp = new Date().toISOString();
    return archiveTrainingPlanState(state, id, archived ? timestamp : undefined);
  });
}

export async function saveTrainingPlanItem(planId: string, weekday: number, input: Partial<TrainingPlanItem> & { name: string; activityType: ActivityType }) {
  let saved: TrainingPlanItem | undefined;
  await mutate((state) => {
    const plan = state.plans.find((candidate) => candidate.id === planId);
    if (!plan) throw new Error("Plano de treino não encontrado.");
    const day = plan.days.find((candidate) => candidate.weekday === weekday) ?? { weekday, items: [] };
    const current = input.id ? day.items.find((item) => item.id === input.id) : undefined;
    saved = {
      id: current?.id ?? uid("plan-item"),
      templateId: input.templateId ?? current?.templateId,
      name: input.name.trim() || "Sessão",
      activityType: input.activityType,
      scheduledTime: input.scheduledTime || undefined,
      estimatedDurationMinutes: input.estimatedDurationMinutes ? Math.max(1, Math.round(input.estimatedDurationMinutes)) : undefined,
      prescription: clonePrescription(input.prescription ?? current?.prescription ?? createDefaultPrescription(input.activityType)),
      order: current?.order ?? day.items.length,
    };
    const nextDay = { ...day, items: current ? day.items.map((item) => item.id === saved!.id ? saved! : item) : [...day.items, saved] };
    const timestamp = new Date().toISOString();
    const nextPlan = { ...plan, updatedAt: timestamp, days: [...plan.days.filter((candidate) => candidate.weekday !== weekday), nextDay].sort((a, b) => a.weekday - b.weekday) };
    return { ...state, plans: state.plans.map((candidate) => candidate.id === planId ? nextPlan : candidate) };
  });
  return saved!;
}

export async function removeTrainingPlanItem(planId: string, weekday: number, itemId: string) {
  return mutate((state) => ({
    ...state,
    plans: state.plans.map((plan) => plan.id !== planId ? plan : {
      ...plan,
      updatedAt: new Date().toISOString(),
      days: plan.days.map((day) => day.weekday !== weekday ? day : { ...day, items: day.items.filter((item) => item.id !== itemId).map((item, order) => ({ ...item, order })) }),
    }),
  }));
}

export async function moveTrainingPlanItem(planId: string, weekday: number, itemId: string, direction: -1 | 1) {
  return mutate((state) => ({
    ...state,
    plans: state.plans.map((plan) => {
      if (plan.id !== planId) return plan;
      return {
        ...plan,
        updatedAt: new Date().toISOString(),
        days: plan.days.map((day) => {
          if (day.weekday !== weekday) return day;
          const items = day.items.slice().sort((a, b) => a.order - b.order);
          const index = items.findIndex((item) => item.id === itemId);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= items.length) return day;
          [items[index], items[target]] = [items[target], items[index]];
          return { ...day, items: items.map((item, order) => ({ ...item, order })) };
        }),
      };
    }),
  }));
}

export async function saveWorkoutTemplate(input: Partial<WorkoutTemplate> & { name: string; activityType: ActivityType }) {
  let saved: WorkoutTemplate | undefined;
  await mutate((state, ownerId) => {
    const current = input.id ? state.templates.find((template) => template.id === input.id) : undefined;
    const timestamp = new Date().toISOString();
    saved = {
      id: current?.id ?? uid("template"),
      ownerId,
      name: input.name.trim() || "Modelo",
      activityType: input.activityType,
      description: input.description?.trim() || undefined,
      estimatedDurationMinutes: input.estimatedDurationMinutes ? Math.max(1, Math.round(input.estimatedDurationMinutes)) : undefined,
      prescription: clonePrescription(input.prescription ?? current?.prescription ?? createDefaultPrescription(input.activityType)),
      archivedAt: current?.archivedAt,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return { ...state, templates: current ? state.templates.map((template) => template.id === saved!.id ? saved! : template) : [...state.templates, saved] };
  });
  return saved!;
}

export async function duplicateWorkoutTemplate(id: string) {
  let copy: WorkoutTemplate | undefined;
  await mutate((state, ownerId) => {
    const source = state.templates.find((template) => template.id === id);
    if (!source) throw new Error("Modelo não encontrado.");
    const timestamp = new Date().toISOString();
    copy = { ...clonePrescription(source), id: uid("template"), ownerId, name: `${source.name} — cópia`, archivedAt: undefined, createdAt: timestamp, updatedAt: timestamp };
    return { ...state, templates: [...state.templates, copy] };
  });
  return copy!;
}

export async function setWorkoutTemplateArchived(id: string, archived: boolean) {
  return mutate((state) => ({ ...state, templates: state.templates.map((template) => template.id === id ? { ...template, archivedAt: archived ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : template) }));
}

export async function savePersonalExercise(input: Partial<ExerciseDefinition> & { name: string; activityType: ActivityType }) {
  let saved: ExerciseDefinition | undefined;
  await mutate((state, ownerId) => {
    const current = input.id ? state.exercises.find((exercise) => exercise.id === input.id) : undefined;
    if (current?.scope === "global") throw new Error("Exercícios globais não podem ser editados. Crie uma versão pessoal.");
    const timestamp = new Date().toISOString();
    saved = {
      id: current?.id ?? uid("exercise"),
      ownerId,
      name: input.name.trim(),
      activityType: input.activityType,
      primaryMuscle: input.primaryMuscle?.trim() || undefined,
      secondaryMuscles: input.secondaryMuscles ?? current?.secondaryMuscles ?? [],
      equipment: input.equipment?.trim() || undefined,
      instructions: input.instructions?.trim() || undefined,
      cautions: input.cautions?.trim() || undefined,
      mediaUrl: input.mediaUrl?.trim() || undefined,
      alternativeExerciseIds: input.alternativeExerciseIds ?? current?.alternativeExerciseIds ?? [],
      laterality: input.laterality ?? current?.laterality ?? "bilateral",
      scope: "personal",
      favorite: input.favorite ?? current?.favorite ?? false,
      archivedAt: current?.archivedAt,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return upsertExerciseState(state, saved);
  });
  return saved!;
}

export async function createPersonalExerciseVariant(id: string) {
  const state = await getTrainingState();
  const source = state.exercises.find((exercise) => exercise.id === id);
  if (!source) throw new Error("Exercício não encontrado.");
  return savePersonalExercise({ ...source, id: undefined, name: `${source.name} — pessoal`, scope: "personal" });
}

export async function toggleExerciseFavorite(id: string) {
  return mutate((state) => ({ ...state, exercises: state.exercises.map((exercise) => exercise.id === id ? { ...exercise, favorite: !exercise.favorite } : exercise) }));
}

export async function setPersonalExerciseArchived(id: string, archived: boolean) {
  return mutate((state) => ({
    ...state,
    exercises: state.exercises.map((exercise) => exercise.id === id && exercise.scope === "personal" ? { ...exercise, archivedAt: archived ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() } : exercise),
  }));
}

export interface ScheduleSessionInput {
  id?: string;
  templateId?: string;
  planId?: string;
  name: string;
  activityType: ActivityType;
  date: string;
  scheduledTime?: string;
  estimatedDurationMinutes?: number;
  prescription?: WorkoutPrescription;
  notes?: string;
  idempotencyKey?: string;
}

export async function scheduleTrainingSession(input: ScheduleSessionInput) {
  let saved: PlannedSession | undefined;
  await mutate((state, ownerId) => {
    if (input.idempotencyKey) {
      const duplicate = state.plannedSessions.find((session) => session.idempotencyKey === input.idempotencyKey);
      if (duplicate) { saved = duplicate; return state; }
    }
    const current = input.id ? state.plannedSessions.find((session) => session.id === input.id) : undefined;
    const template = input.templateId ? state.templates.find((candidate) => candidate.id === input.templateId) : undefined;
    const timestamp = new Date().toISOString();
    saved = {
      id: current?.id ?? uid("planned"),
      ownerId,
      planId: input.planId ?? current?.planId,
      templateId: input.templateId ?? current?.templateId,
      name: input.name.trim() || "Sessão",
      activityType: input.activityType,
      date: input.date,
      scheduledTime: input.scheduledTime || undefined,
      estimatedDurationMinutes: input.estimatedDurationMinutes ? Math.max(1, Math.round(input.estimatedDurationMinutes)) : undefined,
      status: current?.status ?? "planned",
      prescriptionSnapshot: clonePrescription(input.prescription ?? template?.prescription ?? current?.prescriptionSnapshot ?? createDefaultPrescription(input.activityType)),
      notes: input.notes?.trim() || undefined,
      sortOrder: current?.sortOrder ?? state.plannedSessions.filter((session) => session.date === input.date).length,
      exceptionOfId: current?.exceptionOfId,
      replacedById: current?.replacedById,
      idempotencyKey: input.idempotencyKey ?? current?.idempotencyKey,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    return { ...state, plannedSessions: current ? state.plannedSessions.map((session) => session.id === saved!.id ? saved! : session) : [...state.plannedSessions, saved] };
  });
  return saved!;
}

export async function copyTrainingSession(id: string, date: string) {
  const state = await getTrainingState();
  const source = state.plannedSessions.find((session) => session.id === id);
  if (!source) throw new Error("Sessão não encontrada.");
  return scheduleTrainingSession({ ...source, id: undefined, date, idempotencyKey: `copy:${id}:${date}:${Date.now()}`, prescription: source.prescriptionSnapshot });
}

export async function replaceTrainingSession(id: string, input: Omit<ScheduleSessionInput, "id">) {
  let replacement: PlannedSession | undefined;
  await mutate((state, ownerId) => {
    const source = state.plannedSessions.find((session) => session.id === id);
    if (!source) throw new Error("Sessão original não encontrada.");
    const timestamp = new Date().toISOString();
    replacement = {
      id: uid("planned"), ownerId, name: input.name, activityType: input.activityType, date: input.date,
      scheduledTime: input.scheduledTime, estimatedDurationMinutes: input.estimatedDurationMinutes,
      status: "planned", prescriptionSnapshot: clonePrescription(input.prescription ?? createDefaultPrescription(input.activityType)),
      notes: input.notes, sortOrder: source.sortOrder, exceptionOfId: source.id, createdAt: timestamp, updatedAt: timestamp,
    };
    return { ...state, plannedSessions: [...state.plannedSessions.map((session) => session.id === id ? { ...session, replacedById: replacement!.id, updatedAt: timestamp } : session), replacement] };
  });
  return replacement!;
}

export async function setPlannedSessionStatus(id: string, status: PlannedSessionStatus) {
  return mutate((state) => ({ ...state, plannedSessions: state.plannedSessions.map((session) => session.id === id ? { ...session, status, updatedAt: new Date().toISOString() } : session) }));
}

export async function movePlannedSession(id: string, direction: -1 | 1) {
  return mutate((state) => {
    const source = state.plannedSessions.find((session) => session.id === id);
    if (!source) return state;
    const day = state.plannedSessions.filter((session) => session.date === source.date && !session.replacedById).sort((a, b) => a.sortOrder - b.sortOrder);
    const index = day.findIndex((session) => session.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= day.length) return state;
    [day[index], day[target]] = [day[target], day[index]];
    const order = new Map(day.map((session, sortOrder) => [session.id, sortOrder]));
    return { ...state, plannedSessions: state.plannedSessions.map((session) => order.has(session.id) ? { ...session, sortOrder: order.get(session.id)!, updatedAt: new Date().toISOString() } : session) };
  });
}

export async function startTrainingSession(plannedSessionId: string) {
  let started: WorkoutSession | undefined;
  await mutate((state) => {
    const result = beginSession(state, plannedSessionId);
    started = result.session;
    return result.state;
  });
  return started!;
}

export async function saveTrainingDraft(session: WorkoutSession) {
  return mutate((state) => updateSession(state, { ...session, updatedAt: new Date().toISOString() }));
}

export async function pauseTrainingSession(id: string, paused: boolean) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === id);
    if (!session || session.status !== "in_progress") return state;
    return updateSession(state, { ...session, isPaused: paused, pausedAt: paused ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() });
  });
}

export async function updateStrengthSet(sessionId: string, result: StrengthSetResult) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    return updateSession(state, { ...session, result: { ...session.result, strengthSets: session.result.strengthSets.map((set) => set.id === result.id ? result : set) }, updatedAt: new Date().toISOString() });
  });
}

export async function updateMobilityMovement(sessionId: string, movementPlanId: string, completed: boolean) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    const now = new Date().toISOString();
    return updateSession(state, { ...session, result: { ...session.result, mobilityMovements: session.result.mobilityMovements.map((movement) => movement.movementPlanId === movementPlanId ? { ...movement, status: completed ? "completed" : "pending", completedAt: completed ? now : undefined } : movement) }, updatedAt: now });
  });
}

export async function toggleSessionBlock(sessionId: string, blockId: string, completed: boolean) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    const update = (values: string[]) => completed ? Array.from(new Set([...values, blockId])) : values.filter((id) => id !== blockId);
    const result = {
      ...session.result,
      running: session.result.running ? { ...session.result.running, completedBlockIds: update(session.result.running.completedBlockIds) } : undefined,
      cycling: session.result.cycling ? { ...session.result.cycling, completedBlockIds: update(session.result.cycling.completedBlockIds) } : undefined,
      crossfit: session.result.crossfit ? { ...session.result.crossfit, completedBlockIds: update(session.result.crossfit.completedBlockIds) } : undefined,
    };
    return updateSession(state, { ...session, result, updatedAt: new Date().toISOString() });
  });
}

export async function updateRunningResult(sessionId: string, result: RunningResult) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    return updateSession(state, { ...session, result: { ...session.result, running: result }, updatedAt: new Date().toISOString() });
  });
}

export async function updateCyclingResult(sessionId: string, result: CyclingResult) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    return updateSession(state, { ...session, result: { ...session.result, cycling: result }, updatedAt: new Date().toISOString() });
  });
}

export async function updateCrossfitResult(sessionId: string, result: CrossfitResult) {
  return mutate((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    if (!session) throw new Error("Sessão não encontrada.");
    return updateSession(state, { ...session, result: { ...session.result, crossfit: result }, updatedAt: new Date().toISOString() });
  });
}

export async function completeTrainingSession(id: string, status: "completed" | "partial", durationMinutes?: number) {
  return mutate((state) => {
    const finished = finishSession(state, id, status, durationMinutes);
    const session = finished.sessions.find((candidate) => candidate.id === id)!;
    const records = newPersonalRecords(finished, session);
    return records.length ? { ...finished, personalRecords: [...finished.personalRecords, ...records] } : finished;
  }, true);
}

export async function discardTrainingDraft(id: string) {
  return mutate((state) => ({ ...state, sessions: state.sessions.filter((session) => session.id !== id || session.status !== "in_progress") }));
}

export async function addStrengthExerciseToPrescription(
  prescription: WorkoutPrescription,
  exercise: ExerciseDefinition,
) {
  const current = prescription.strength?.exercises ?? [];
  const exercisePlanId = uid("strength-exercise");
  return {
    ...prescription,
    activityType: "strength" as const,
    strength: {
      exercises: [...current, {
        id: exercisePlanId,
        exerciseId: exercise.id,
        exerciseSnapshot: { id: exercise.id, name: exercise.name, primaryMuscle: exercise.primaryMuscle, equipment: exercise.equipment, laterality: exercise.laterality },
        order: current.length,
        sets: [
          { id: uid("set"), kind: "working" as const, plannedRepMin: 8, plannedRepMax: 12, loadUnit: "kg" as const, restSeconds: 90, technique: "normal" as const, toFailure: false },
        ],
      }],
    },
  };
}

export function defaultSessionDate() {
  return localDate();
}
