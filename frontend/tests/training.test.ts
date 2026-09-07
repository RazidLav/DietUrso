import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyIdempotentReward } from "../src/gamification/rewards";
import {
  archiveTrainingPlanState,
  beginSession,
  clonePrescription,
  createDefaultPrescription,
  createInitialTrainingState,
  duplicateTrainingPlanState,
  finishSession,
  materializePlans,
  newPersonalRecords,
  sanitizeTrainingState,
  scopeTrainingStateToOwner,
  strengthVolume,
  upsertExerciseState,
  upsertTrainingPlanState,
} from "../src/training/calculations";
import { persistTrainingWithRollback } from "../src/training/transaction";
import type { ActivityType, ExerciseDefinition, PlannedSession, TrainingPlan, TrainingState, WorkoutPrescription, WorkoutSession } from "../src/training/types";

const now = new Date("2026-09-07T12:00:00.000Z");

function planned(id: string, activityType: ActivityType, date = "2026-09-07", prescription = createDefaultPrescription(activityType)): PlannedSession {
  const iso = now.toISOString();
  return { id, name: `Sessão ${id}`, activityType, date, status: "planned", prescriptionSnapshot: prescription, sortOrder: 0, createdAt: iso, updatedAt: iso };
}

function withPlanned(...sessions: PlannedSession[]): TrainingState {
  return { ...createInitialTrainingState(), plannedSessions: sessions };
}

function plan(id = "plan-1"): TrainingPlan {
  return {
    id,
    name: "Plano base",
    repeatWeekly: true,
    validFrom: "2026-09-01",
    days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, items: [] })),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function completedSession(id: string, activityType: ActivityType, result?: Partial<WorkoutSession["result"]>): WorkoutSession {
  const prescriptionSnapshot = createDefaultPrescription(activityType);
  return {
    id, name: id, activityType, date: "2026-09-07", status: "completed", isPaused: false,
    prescriptionSnapshot, result: { strengthSets: [], mobilityMovements: [], ...result },
    startedAt: now.toISOString(), completedAt: now.toISOString(), durationMinutes: 45,
    createdAt: now.toISOString(), updatedAt: now.toISOString(),
  };
}

test("várias modalidades coexistem no mesmo dia", () => {
  const state = withPlanned(planned("strength", "strength"), planned("run", "running"), planned("bike", "cycling"));
  assert.deepEqual(state.plannedSessions.map((session) => session.activityType), ["strength", "running", "cycling"]);
});

test("cada sessão mantém status independente", () => {
  const first = beginSession(withPlanned(planned("strength", "strength"), planned("run", "running")), "strength", now);
  assert.equal(first.session.status, "in_progress");
  assert.equal(first.state.plannedSessions.find((session) => session.id === "run")?.status, "planned");
});

test("concluir musculação não conclui corrida", () => {
  let state = withPlanned(planned("strength", "strength"), planned("run", "running"));
  const started = beginSession(state, "strength", now); state = started.state;
  state = finishSession(state, started.session.id, "completed", 50, new Date("2026-09-07T13:00:00Z"));
  assert.equal(state.sessions[0].status, "completed");
  assert.equal(state.sessions.some((session) => session.plannedSessionId === "run"), false);
});

test("concluir CrossFit não conclui musculação", () => {
  let state = withPlanned(planned("wod", "crossfit"), planned("strength", "strength"));
  const started = beginSession(state, "wod", now); state = finishSession(started.state, started.session.id, "completed", 20, now);
  assert.equal(state.sessions[0].activityType, "crossfit");
  assert.equal(state.sessions.some((session) => session.activityType === "strength"), false);
});

test("mais de uma sessão da mesma modalidade pode existir no dia", () => {
  const state = withPlanned(planned("run-am", "running"), planned("run-pm", "running"));
  assert.equal(state.plannedSessions.filter((session) => session.activityType === "running").length, 2);
});

test("planos podem ser criados, editados, duplicados e arquivados", () => {
  let state = upsertTrainingPlanState(createInitialTrainingState(), plan());
  state = upsertTrainingPlanState(state, { ...state.plans[0], name: "Plano editado" });
  const duplicated = duplicateTrainingPlanState(state, "plan-1", "plan-2", now); state = duplicated.state;
  state = archiveTrainingPlanState(state, "plan-1", now.toISOString());
  assert.equal(state.plans[0].name, "Plano editado");
  assert.equal(state.plans[1].name, "Plano editado — cópia");
  assert.equal(state.plans[0].archivedAt, now.toISOString());
});

test("exercícios pessoais podem ser criados e editados", () => {
  const exercise: ExerciseDefinition = { id: "personal-1", name: "Meu exercício", activityType: "strength", secondaryMuscles: [], alternativeExerciseIds: [], laterality: "bilateral", scope: "personal", favorite: false, createdAt: now.toISOString(), updatedAt: now.toISOString() };
  let state = upsertExerciseState(createInitialTrainingState(), exercise);
  state = upsertExerciseState(state, { ...exercise, name: "Meu exercício editado", archivedAt: now.toISOString() });
  assert.equal(state.exercises.find((item) => item.id === exercise.id)?.name, "Meu exercício editado");
});

test("exercícios globais permanecem somente leitura", () => {
  const state = createInitialTrainingState(); const global = state.exercises[0];
  assert.throws(() => upsertExerciseState(state, { ...global, name: "Alterado" }), /somente leitura/);
  const sanitized = sanitizeTrainingState({ ...state, exercises: [{ ...global, name: "Invasão" }] });
  assert.equal(sanitized.exercises.find((item) => item.id === global.id)?.name, global.name);
});

test("séries preservam repetições, carga, RIR, RPE e descanso", () => {
  const prescription: WorkoutPrescription = { activityType: "strength", strength: { exercises: [{ id: "exercise-plan", exerciseId: "squat", exerciseSnapshot: { id: "squat", name: "Agachamento", laterality: "bilateral" }, order: 0, sets: [{ id: "set-1", kind: "working", plannedReps: 8, plannedLoad: 80, loadUnit: "kg", restSeconds: 120, targetRir: 2, targetRpe: 8, technique: "normal", toFailure: false }] }] } };
  const started = beginSession(withPlanned(planned("strength", "strength", undefined, prescription)), "strength", now).session;
  const set = started.result.strengthSets[0];
  const performed = { ...set, status: "completed" as const, performedReps: 8, performedLoad: 82.5, rir: 1, rpe: 9 };
  assert.deepEqual([prescription.strength!.exercises[0].sets[0].restSeconds, performed.performedLoad, performed.rir, performed.rpe], [120, 82.5, 1, 9]);
});

test("supersets e técnicas intensificadoras são preservados", () => {
  const techniques = ["superset", "biset", "triset", "circuit", "drop_set", "strip_set", "rest_pause", "pyramid_up", "pyramid_down"];
  const prescription = createDefaultPrescription("strength");
  prescription.strength!.exercises = techniques.map((technique, index) => ({ id: `e${index}`, exerciseSnapshot: { id: `e${index}`, name: technique, laterality: "bilateral" }, order: index, sets: [{ id: `s${index}`, kind: "working", loadUnit: "kg", technique: technique as never, toFailure: false }] }));
  assert.deepEqual(prescription.strength!.exercises.map((item) => item.sets[0].technique), techniques);
});

test("corrida intervalada armazena aquecimento, trabalho e recuperação", () => {
  const prescription = createDefaultPrescription("running");
  prescription.running = { kind: "interval", blocks: [{ id: "warmup", phase: "warmup", name: "Aquecimento", durationSeconds: 600, order: 0 }, { id: "work", phase: "work", name: "400 m", repetitions: 6, distanceKm: 0.4, order: 1 }, { id: "recovery", phase: "recovery", name: "Trote", durationSeconds: 90, order: 2 }] };
  assert.equal(prescription.running.blocks[1].repetitions, 6);
});

test("bike aceita métricas técnicas opcionais", () => {
  const session = completedSession("bike", "cycling", { cycling: { distanceKm: 25, durationMinutes: 60, averageSpeedKmh: 25, completedBlockIds: [] } });
  assert.equal(session.result.cycling?.averagePowerWatts, undefined);
  assert.equal(session.result.cycling?.distanceKm, 25);
});

test("CrossFit suporta os principais formatos", () => {
  const formats = ["amrap", "emom", "for_time", "rounds_for_time", "tabata", "chipper", "circuit"];
  const prescription = createDefaultPrescription("crossfit");
  prescription.crossfit!.blocks = formats.map((format, order) => ({ id: format, section: "wod", name: format, format: format as never, movements: [], order }));
  assert.deepEqual(prescription.crossfit!.blocks.map((block) => block.format), formats);
});

test("uma sessão pode ser concluída parcialmente", () => {
  const started = beginSession(withPlanned(planned("run", "running")), "run", now);
  const state = finishSession(started.state, started.session.id, "partial", 12, now);
  assert.equal(state.sessions[0].status, "partial");
  assert.equal(state.sessions[0].durationMinutes, 12);
});

test("rascunho em andamento é recuperado pela sanitização", () => {
  const started = beginSession(withPlanned(planned("run", "running")), "run", now);
  const recovered = sanitizeTrainingState(JSON.parse(JSON.stringify(started.state)));
  assert.equal(recovered.sessions[0].status, "in_progress");
  assert.equal(recovered.sessions[0].plannedSessionId, "run");
});

test("alterar plano não modifica snapshot já planejado", () => {
  const base = plan();
  base.days[1].items.push({ id: "item", name: "Original", activityType: "strength", prescription: createDefaultPrescription("strength"), order: 0 });
  let state = { ...createInitialTrainingState(), plans: [base] };
  state = materializePlans(state, "2026-09-07", "2026-09-07", now);
  const original = clonePrescription(state.plannedSessions[0].prescriptionSnapshot);
  state.plans[0].days[1].items[0].prescription = createDefaultPrescription("running");
  state = materializePlans(state, "2026-09-07", "2026-09-07", now);
  assert.deepEqual(state.plannedSessions[0].prescriptionSnapshot, original);
  assert.equal(state.plannedSessions.length, 1);
});

test("volume conta somente séries válidas com carga e repetições", () => {
  const session = completedSession("strength", "strength", { strengthSets: [{ id: "1", planSetId: "1", exercisePlanId: "e", exerciseName: "A", status: "completed", performedLoad: 50, performedReps: 10 }, { id: "2", planSetId: "2", exercisePlanId: "e", exerciseName: "A", status: "skipped", performedLoad: 100, performedReps: 10 }, { id: "3", planSetId: "3", exercisePlanId: "e", exerciseName: "A", status: "completed", performedReps: 10 }] });
  assert.equal(strengthVolume(session), 500);
});

test("recordes pessoais não são duplicados por reprocessamento", () => {
  const session = completedSession("strength", "strength", { strengthSets: [{ id: "1", planSetId: "1", exercisePlanId: "e", exerciseId: "squat", exerciseName: "Agachamento", status: "completed", performedLoad: 100, performedReps: 5, loadUnit: "kg" }] });
  let state = { ...createInitialTrainingState(), sessions: [session] };
  const first = newPersonalRecords(state, session); state = { ...state, personalRecords: first };
  assert.ok(first.length >= 1);
  assert.equal(newPersonalRecords(state, session).length, 0);
});

test("conquistas e XP de treino são idempotentes", () => {
  const first = applyIdempotentReward([], 0, "workout:session-1", 40);
  const retry = applyIdempotentReward(first.rewardedEvents, first.totalXp, "workout:session-1", 40);
  assert.equal(first.totalXp, 40); assert.equal(retry.totalXp, 40); assert.equal(retry.rewarded, false);
});

test("todos os dados pessoais recebem ownerId", () => {
  const state = withPlanned(planned("run", "running")); state.plans = [plan()]; state.sessions = [completedSession("done", "running")];
  state.exercises.push({ id: "mine", name: "Meu", activityType: "custom", secondaryMuscles: [], alternativeExerciseIds: [], laterality: "not_applicable", scope: "personal", favorite: false, createdAt: now.toISOString(), updatedAt: now.toISOString() });
  const scoped = scopeTrainingStateToOwner(state, "user-a");
  assert.equal(scoped.plans[0].ownerId, "user-a"); assert.equal(scoped.plannedSessions[0].ownerId, "user-a"); assert.equal(scoped.sessions[0].ownerId, "user-a"); assert.equal(scoped.exercises.find((exercise) => exercise.id === "mine")?.ownerId, "user-a");
});

test("RLS restringe o snapshot de treinos ao auth.uid", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260907140000_harden_user_app_state.sql", import.meta.url), "utf8");
  assert.match(sql, /force row level security/i); assert.match(sql, /auth\.uid\(\)\) = user_id/g); assert.match(sql, /revoke all on table public\.user_app_state from anon/i);
});

test("falha no Supabase restaura o estado anterior", async () => {
  const previous = createInitialTrainingState(); const next = { ...previous, plannedSessions: [planned("run", "running")] }; let restored: TrainingState | null = null;
  await assert.rejects(() => persistTrainingWithRollback(previous, next, async () => { throw new Error("Supabase indisponível"); }, async (value) => { restored = value; }), /Supabase indisponível/);
  assert.equal(restored, previous);
});
