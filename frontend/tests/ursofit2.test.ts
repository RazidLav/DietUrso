import assert from "node:assert/strict";
import test from "node:test";
import { formatMealCountdown, mealTimeForWeekday, resolveMealScheduleFocus, scheduledMealsForDate } from "../src/nutrition/mealSchedule";
import { createInitialProfileState, sanitizeProfileState } from "../src/profile/rules";
import type { HydrationState } from "../src/hydration/types";
import { createInitialTrainingState } from "../src/training/calculations";
import type { Plan } from "../src/types/plan";
import { computeIntegratedStats } from "../src/utils/integratedStats";

const plan: Plan = { id: "p", name: "Plano", archived: false, createdAt: "2026-10-01T00:00:00Z", meals: [
  { id: "breakfast", type: "cafe", name: "Café", suggestedTime: "08:00", scheduleByWeekday: { 4: "07:30" }, options: [{ id: "o", name: "Padrão", foods: [{ id: "f", name: "Aveia", quantity: 50, unit: "g", kcal: 190, protein: 6, carbs: 32, fats: 4, substitutions: [] }] }] },
  { id: "lunch", type: "almoco", name: "Almoço", suggestedTime: "12:00", options: [{ id: "o2", name: "Padrão", foods: [] }] },
] };

test("agenda alimentar aceita horário específico por dia sem apagar o padrão", () => {
  assert.equal(mealTimeForWeekday(plan.meals[0], 4), "07:30");
  assert.equal(mealTimeForWeekday(plan.meals[0], 5), "08:00");
});

test("próxima refeição distingue próxima, agora, pendente e concluída", () => {
  const before = scheduledMealsForDate(plan, [], "2026-10-22", new Date(2026, 9, 22, 7, 0));
  assert.equal(before[0].state, "next"); assert.equal(resolveMealScheduleFocus(before)?.meal.id, "breakfast");
  const now = scheduledMealsForDate(plan, [], "2026-10-22", new Date(2026, 9, 22, 7, 32));
  assert.equal(now[0].state, "now"); assert.equal(formatMealCountdown(now[0]), "Agora");
  const late = scheduledMealsForDate(plan, [], "2026-10-22", new Date(2026, 9, 22, 10, 0));
  assert.equal(late[0].state, "pending"); assert.equal(resolveMealScheduleFocus(late)?.meal.id, "lunch");
  const completed = scheduledMealsForDate(plan, [{ id: "e", date: "2026-10-22", mealId: "breakfast", status: "as_planned", createdAt: "2026-10-22T10:31:00Z" }], "2026-10-22", new Date(2026, 9, 22, 10, 0));
  assert.equal(completed[0].state, "completed");
});

test("anamnese sanitiza valores e mantém dados sensíveis privados no perfil", () => {
  const state = createInitialProfileState();
  const sanitized = sanitizeProfileState({ ...state, wellness: { activities: ["Corrida"], usualMealTimes: ["07:30", "99:99"], heightCm: 999, physicalConsiderations: "joelho", sensitiveDataConsent: true } });
  assert.equal(sanitized.wellness.heightCm, undefined);
  assert.deepEqual(sanitized.wellness.usualMealTimes, ["07:30"]);
  assert.equal(sanitized.wellness.physicalConsiderations, "joelho");
  assert.equal("physicalConsiderations" in sanitized.profile, false);
});

test("estatísticas usam somente dias registrados e calendário preserva ausência de dados", () => {
  const stamp = "2026-10-22T12:00:00Z";
  const hydration: HydrationState = { version: 1, config: { id: "config", dailyGoalMl: 2500, wakeTime: "07:00", sleepTime: "23:00", timezone: "America/Fortaleza", internalAlertsEnabled: true, alertIntervalMinutes: 120, createdAt: stamp, updatedAt: stamp }, containers: [], records: [], daySnapshots: {}, alertReceipts: {} };
  hydration.records.push({ id: "w", amountMl: 500, occurredAt: "2026-10-22T12:00:00Z", localDate: "2026-10-22", source: "quick", createdAt: "2026-10-22T12:00:00Z", updatedAt: "2026-10-22T12:00:00Z" });
  const result = computeIntegratedStats([{ id: "e", date: "2026-10-22", mealId: "m", status: "modified", manualKcal: 400, manualProtein: 30, createdAt: "2026-10-22T12:00:00Z" }], createInitialTrainingState(), hydration, "month", new Date("2026-10-22T12:00:00Z"));
  assert.equal(result.nutritionDays, 1); assert.equal(result.averageKcal, 400); assert.equal(result.hydrationDays, 1); assert.equal(result.averageWaterMl, 500);
  assert.equal(result.calendar.find((day) => day.date === "2026-10-21")?.status, "none");
  assert.equal(result.calendar.find((day) => day.date === "2026-10-23")?.status, "future");
});
