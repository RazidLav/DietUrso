import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareAssessments, goalAwareDirection, trendSummary, cmToIn, inToCm, kgToLb, lbToKg } from "../src/evolution/calculations";
import type { PhysicalAssessment } from "../src/evolution/types";
import { createDefaultPrescription, createInitialTrainingState, deterministicProgressionSuggestion, estimatedOneRepMax, substituteExerciseForSession } from "../src/training/calculations";
import type { ExerciseDefinition, WorkoutSession } from "../src/training/types";

function assessment(id: string, date: string, input: Partial<PhysicalAssessment> = {}): PhysicalAssessment {
  return { id, takenAt: date, unit: "cm", completeness: "partial", measurements: {}, composition: {}, customComposition: [], createdAt: date, updatedAt: date, ...input };
}

test("avaliações parciais com campos ausentes podem ser comparadas", () => {
  const before = assessment("a", "2026-09-01T10:00:00Z", { weightKg: 80, measurements: { waist: 90 } });
  const after = assessment("b", "2026-10-01T10:00:00Z", { weightKg: 79, composition: { body_fat_percent: 20 } });
  const comparison = compareAssessments(before, after);
  assert.equal(comparison.find((item) => item.metric === "weight_kg")?.change, -1);
  assert.equal(comparison.find((item) => item.metric === "waist")?.after, undefined);
  assert.equal(comparison.find((item) => item.metric === "body_fat_percent")?.before, undefined);
});

test("um registro isolado não vira tendência e três registros espaçados viram", () => {
  assert.equal(trendSummary([assessment("a", "2026-09-01T10:00:00Z", { weightKg: 80 })], "weight_kg").enoughData, false);
  const summary = trendSummary([
    assessment("a", "2026-09-01T10:00:00Z", { measurements: { waist: 92 } }),
    assessment("b", "2026-09-08T10:00:00Z", { measurements: { waist: 91 } }),
    assessment("c", "2026-09-16T10:00:00Z", { measurements: { waist: 90 } }),
  ], "waist");
  assert.equal(summary.enoughData, true); assert.equal(summary.absoluteChange, -2); assert.ok((summary.trendPerDay ?? 0) < 0);
});

test("direção de progresso respeita o objetivo e conversões são reversíveis", () => {
  assert.equal(goalAwareDirection("fat_loss", "waist", -2), "toward_goal");
  assert.equal(goalAwareDirection("muscle_gain", "weight_kg", -2), "neutral");
  assert.ok(Math.abs(lbToKg(kgToLb(82.3)) - 82.3) < .0001);
  assert.ok(Math.abs(inToCm(cmToIn(91)) - 91) < .0001);
});

test("progressão é transparente e nunca inventa carga sem execução", () => {
  assert.equal(deterministicProgressionSuggestion({ exerciseId: "x", sessionId: "s", sets: [] }), null);
  const suggestion = deterministicProgressionSuggestion({ exerciseId: "x", sessionId: "s", sets: [{ performedLoad: 80, performedReps: 12, targetRepMax: 12, rir: 2, loadUnit: "kg" }, { performedLoad: 80, performedReps: 12, targetRepMax: 12, rir: 1, loadUnit: "kg" }] });
  assert.equal(suggestion?.action, "increase_load"); assert.equal(suggestion?.suggestedLoad, 82.5);
  assert.equal(estimatedOneRepMax(100, 1), 100); assert.equal(estimatedOneRepMax(0, 10), undefined);
});

test("substituição preserva a prescrição e separa o exercício executado", () => {
  const prescription = createDefaultPrescription("strength");
  prescription.strength!.exercises.push({ id: "planned", exerciseId: "squat", exerciseSnapshot: { id: "squat", name: "Agachamento", laterality: "bilateral" }, order: 0, sets: [{ id: "set", kind: "working", loadUnit: "kg", technique: "normal", toFailure: false }] });
  const session: WorkoutSession = { id: "session", name: "Pernas", activityType: "strength", date: "2026-10-10", status: "in_progress", isPaused: false, prescriptionSnapshot: prescription, result: { strengthSets: [{ id: "result", planSetId: "set", exercisePlanId: "planned", exerciseId: "squat", exerciseName: "Agachamento", status: "pending" }], mobilityMovements: [] }, startedAt: "2026-10-10T10:00:00Z", createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z" };
  const executed: ExerciseDefinition = { id: "leg-press", name: "Leg press", activityType: "strength", secondaryMuscles: [], alternativeExerciseIds: [], laterality: "bilateral", scope: "global", favorite: false, createdAt: session.createdAt, updatedAt: session.updatedAt };
  const next = substituteExerciseForSession(session, "planned", executed);
  assert.equal(next.prescriptionSnapshot.strength?.exercises[0].exerciseId, "squat");
  assert.equal(next.result.strengthSets[0].executedExerciseId, "leg-press");
});

test("migrations protegem evolução, social, Rugidos e placar no banco", () => {
  const evolution = readFileSync("../supabase/migrations/20261010150000_create_physical_evolution.sql", "utf8");
  const community = readFileSync("../supabase/migrations/20261010160000_create_bear_community.sql", "utf8");
  const challenge = readFileSync("../supabase/migrations/20261010170000_create_rugidos_challenges.sql", "utf8");
  assert.match(evolution, /progress-photos/); assert.match(evolution, /public\.physical_assessments enable row level security/); assert.match(evolution, /auth\.uid\(\) = user_id/);
  assert.match(community, /unique\(user_low_id, user_high_id\)/); assert.match(community, /users_are_blocked/); assert.match(community, /can_view_audience/);
  assert.match(challenge, /expires_at.*24 hours/); assert.match(challenge, /submit_challenge_activity/); assert.match(challenge, /challenge_scores/); assert.doesNotMatch(challenge, /create policy[^;]+challenge_scores[^;]+insert/is);
  assert.match(challenge, /record_gamification_event/); assert.match(challenge, /unique\(user_id,idempotency_key\)/);
});

test("as novas modalidades permanecem sessões independentes", () => {
  const state = createInitialTrainingState();
  for (const type of ["pilates", "jiu_jitsu", "muay_thai", "hiit", "cardio"] as const) assert.equal(createDefaultPrescription(type).activityType, type);
  assert.equal(state.sessions.length, 0);
});
