import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  appendRecord,
  hydrationClock,
  hydrationSummary,
  isClockInside,
  parseClock,
  replaceRecord,
  scopeHydrationStateToOwner,
  selectHydrationAlert,
  snapshotFromConfig,
  totalForDate,
  withoutRecord,
  zonedDateParts,
} from "../src/hydration/calculations";
import { persistWithRollback } from "../src/hydration/transaction";
import { applyIdempotentReward } from "../src/gamification/rewards";
import type { HydrationConfig, HydrationRecord, HydrationState } from "../src/hydration/types";

const baseConfig: HydrationConfig = {
  id: "config",
  dailyGoalMl: 2500,
  wakeTime: "07:00",
  sleepTime: "23:00",
  timezone: "UTC",
  internalAlertsEnabled: true,
  alertIntervalMinutes: 120,
  quietStart: "23:00",
  quietEnd: "07:00",
  createdAt: "2026-09-07T00:00:00.000Z",
  updatedAt: "2026-09-07T00:00:00.000Z",
};

function state(config = baseConfig): HydrationState {
  return { version: 1, config, containers: [], records: [], daySnapshots: {}, alertReceipts: {} };
}

function record(id: string, amountMl: number, occurredAt = "2026-09-07T12:00:00.000Z", source: HydrationRecord["source"] = "quick"): HydrationRecord {
  return { id, amountMl, occurredAt, localDate: occurredAt.slice(0, 10), source, createdAt: occurredAt, updatedAt: occurredAt };
}

test("valida relógios no formato HH:MM", () => {
  assert.equal(parseClock("07:30"), 450);
  assert.equal(parseClock("24:00"), null);
  assert.equal(parseClock("7:30"), null);
});

test("meta esperada é zero antes de acordar", () => {
  const clock = hydrationClock(new Date("2026-09-07T06:00:00.000Z"), baseConfig);
  assert.equal(clock.date, "2026-09-07");
  assert.equal(clock.progress, 0);
  assert.equal(clock.expectedMl, 0);
  assert.equal(clock.isActive, false);
});

test("meta esperada é proporcional no meio da janela", () => {
  const clock = hydrationClock(new Date("2026-09-07T15:00:00.000Z"), baseConfig);
  assert.equal(clock.progress, 0.5);
  assert.equal(clock.expectedMl, 1250);
  assert.equal(clock.isActive, true);
});

test("meta esperada chega a 100% ao dormir e não passa disso", () => {
  assert.equal(hydrationClock(new Date("2026-09-07T23:00:00.000Z"), baseConfig).expectedMl, 2500);
  assert.equal(hydrationClock(new Date("2026-09-07T23:59:00.000Z"), baseConfig).expectedMl, 2500);
});

test("janela que cruza meia-noite pertence ao dia de hidratação correto", () => {
  const config = { ...baseConfig, wakeTime: "22:00", sleepTime: "06:00" };
  const beforeMidnight = hydrationClock(new Date("2026-09-07T23:00:00.000Z"), config);
  const afterMidnight = hydrationClock(new Date("2026-09-08T02:00:00.000Z"), config);
  assert.equal(beforeMidnight.date, "2026-09-07");
  assert.equal(beforeMidnight.progress, 0.125);
  assert.equal(afterMidnight.date, "2026-09-07");
  assert.equal(afterMidnight.progress, 0.5);
});

test("fuso horário determina data e hora locais sem depender do aparelho", () => {
  const parts = zonedDateParts(new Date("2026-09-08T02:30:00.000Z"), "America/Fortaleza");
  assert.deepEqual(parts, { date: "2026-09-07", minutes: 23 * 60 + 30 });
});

test("resumo classifica ritmo com tolerância e preserva percentual acima de 100%", () => {
  const hydrated = state();
  hydrated.records = [record("r1", 3000)];
  const summary = hydrationSummary(hydrated, new Date("2026-09-07T15:00:00.000Z"));
  assert.equal(summary.consumedMl, 3000);
  assert.equal(summary.percentage, 120);
  assert.equal(summary.remainingMl, 0);
  assert.equal(summary.pace, "ahead");
  assert.equal(summary.toleranceMl, 125);
});

test("snapshot diário mantém a meta antiga após alterar a configuração", () => {
  const hydrated = state({ ...baseConfig, dailyGoalMl: 3000 });
  hydrated.daySnapshots["2026-09-07"] = snapshotFromConfig({ ...baseConfig, dailyGoalMl: 2000 }, "2026-09-07");
  hydrated.records = [record("r1", 2000)];
  const summary = hydrationSummary(hydrated, new Date("2026-09-07T23:00:00.000Z"));
  assert.equal(summary.goalMl, 2000);
  assert.equal(summary.percentage, 100);
});

test("os seis atalhos acumulam exatamente seus volumes", () => {
  const amounts = [100, 200, 250, 300, 500, 1000];
  const result = amounts.reduce((current, amount, index) => appendRecord(current, record(`r${index}`, amount)), state());
  assert.equal(totalForDate(result.records, "2026-09-07"), 2350);
  assert.deepEqual(result.records.map((item) => item.amountMl), amounts);
});

test("registros manual e de recipiente mantêm origem e snapshot", () => {
  const manual = record("manual", 350, undefined, "manual");
  const container = { ...record("bottle", 750, undefined, "container"), containerId: "b1", containerSnapshot: { name: "Garrafa", volumeMl: 750 } };
  const result = appendRecord(appendRecord(state(), manual), container);
  assert.equal(result.records[0].source, "manual");
  assert.equal(result.records[1].containerSnapshot?.name, "Garrafa");
});

test("idempotencyKey impede registro duplicado em toque ou reenvio", () => {
  const first = { ...record("r1", 250), idempotencyKey: "tap-1" };
  const duplicate = { ...record("r2", 250), idempotencyKey: "tap-1" };
  const once = appendRecord(state(), first);
  assert.equal(appendRecord(once, duplicate), once);
  assert.equal(once.records.length, 1);
});

test("editar recalcula o total sem mutar o estado anterior", () => {
  const original = appendRecord(state(), record("r1", 250));
  const updated = replaceRecord(original, { ...original.records[0], amountMl: 500 });
  assert.equal(totalForDate(original.records, "2026-09-07"), 250);
  assert.equal(totalForDate(updated.records, "2026-09-07"), 500);
});

test("excluir e desfazer removem somente o registro alvo", () => {
  const original = appendRecord(appendRecord(state(), record("r1", 250)), record("r2", 500));
  const deleted = withoutRecord(original, "r1");
  const undone = withoutRecord(original, original.records.at(-1)!.id);
  assert.deepEqual(deleted.records.map((item) => item.id), ["r2"]);
  assert.deepEqual(undone.records.map((item) => item.id), ["r1"]);
});

test("período silencioso funciona também ao cruzar a meia-noite", () => {
  assert.equal(isClockInside(23 * 60 + 30, 22 * 60, 7 * 60), true);
  assert.equal(isClockInside(6 * 60, 22 * 60, 7 * 60), true);
  assert.equal(isClockInside(12 * 60, 22 * 60, 7 * 60), false);
});

test("alerta interno não aparece durante período silencioso", () => {
  const hydrated = state({ ...baseConfig, quietStart: "14:00", quietEnd: "16:00" });
  const summary = hydrationSummary(hydrated, new Date("2026-09-07T15:00:00.000Z"));
  assert.equal(selectHydrationAlert(hydrated, summary, new Date("2026-09-07T15:00:00.000Z")), null);
});

test("alerta interno respeita o período acordado", () => {
  const hydrated = state({ ...baseConfig, quietStart: undefined, quietEnd: undefined });
  const beforeWake = new Date("2026-09-07T06:00:00.000Z");
  const afterSleep = new Date("2026-09-07T23:30:00.000Z");
  assert.equal(selectHydrationAlert(hydrated, hydrationSummary(hydrated, beforeWake), beforeWake), null);
  assert.equal(selectHydrationAlert(hydrated, hydrationSummary(hydrated, afterSleep), afterSleep), null);
});

test("alerta de ritmo atrasado tem chave deduplicável", () => {
  const hydrated = state({ ...baseConfig, quietStart: undefined, quietEnd: undefined });
  const now = new Date("2026-09-07T15:00:00.000Z");
  const summary = hydrationSummary(hydrated, now);
  const alert = selectHydrationAlert(hydrated, summary, now);
  assert.equal(alert?.type, "behind");
  assert.match(alert?.key ?? "", /^2026-09-07:behind:/);
  hydrated.alertReceipts[alert!.key] = { key: alert!.key, type: "behind", date: "2026-09-07", lastShownAt: now.toISOString() };
  assert.equal(selectHydrationAlert(hydrated, summary, new Date(now.getTime() + 30 * 60000)), null);
});

test("alerta dispensado ou adiado não reaparece", () => {
  const hydrated = state({ ...baseConfig, quietStart: undefined, quietEnd: undefined });
  const now = new Date("2026-09-07T15:00:00.000Z");
  const summary = hydrationSummary(hydrated, now);
  const alert = selectHydrationAlert(hydrated, summary, now)!;
  hydrated.alertReceipts[alert.key] = { key: alert.key, type: alert.type, date: summary.date, lastShownAt: "2026-09-07T10:00:00.000Z", snoozedUntil: "2026-09-07T16:00:00.000Z" };
  assert.equal(selectHydrationAlert(hydrated, summary, now), null);
  hydrated.alertReceipts[alert.key] = { ...hydrated.alertReceipts[alert.key], snoozedUntil: undefined, dismissedAt: "2026-09-07T14:00:00.000Z" };
  assert.equal(selectHydrationAlert(hydrated, summary, now), null);
});

test("mesmo tipo de alerta não reaparece imediatamente em outra faixa de progresso", () => {
  const hydrated = state({ ...baseConfig, quietStart: undefined, quietEnd: undefined });
  hydrated.records = [record("r1", 250)];
  hydrated.alertReceipts["2026-09-07:behind:0"] = { key: "2026-09-07:behind:0", type: "behind", date: "2026-09-07", lastShownAt: "2026-09-07T14:30:00.000Z" };
  const now = new Date("2026-09-07T15:00:00.000Z");
  const summary = hydrationSummary(hydrated, now);
  assert.equal(summary.pace, "behind");
  assert.equal(selectHydrationAlert(hydrated, summary, now), null);
});

test("falha de persistência restaura o estado anterior", async () => {
  const previous = appendRecord(state(), record("r1", 250));
  const next = appendRecord(previous, record("r2", 500));
  let restored: HydrationState | null = null;
  let restoredRecordCount = 0;
  await assert.rejects(() => persistWithRollback(previous, next, async () => { throw new Error("Supabase indisponível"); }, async (value) => { restored = value; restoredRecordCount = value.records.length; }), /Supabase indisponível/);
  assert.equal(restored, previous);
  assert.equal(restoredRecordCount, 1);
});

test("persistência bem-sucedida não aciona rollback", async () => {
  const previous = state();
  const next = appendRecord(previous, record("r1", 250));
  let persisted: HydrationState | null = null;
  let rolledBack = false;
  const result = await persistWithRollback(previous, next, async (value) => { persisted = value; }, async () => { rolledBack = true; });
  assert.equal(result, next);
  assert.equal(persisted, next);
  assert.equal(rolledBack, false);
});

test("hidratação autenticada recebe o vínculo do proprietário em todos os dados", () => {
  const hydrated = state();
  hydrated.containers = [{ id: "c1", name: "Garrafa", volumeMl: 500, isFavorite: true, sortOrder: 0, createdAt: baseConfig.createdAt, updatedAt: baseConfig.updatedAt }];
  hydrated.records = [record("r1", 500)];
  const scoped = scopeHydrationStateToOwner(hydrated, "user-a");
  assert.equal(scoped.config.ownerId, "user-a");
  assert.equal(scoped.containers[0].ownerId, "user-a");
  assert.equal(scoped.records[0].ownerId, "user-a");
});

test("RLS restringe o snapshot ao auth.uid do usuário", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20260907140000_harden_user_app_state.sql", import.meta.url), "utf8");
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\)\) = user_id/g);
  assert.match(sql, /revoke all on table public\.user_app_state from anon/i);
});

test("recompensa de hidratação é idempotente por chave de evento", () => {
  const first = applyIdempotentReward([], 100, "water:2026-09-07", 25);
  const retry = applyIdempotentReward(first.rewardedEvents, first.totalXp, "water:2026-09-07", 25);
  assert.equal(first.totalXp, 125);
  assert.equal(first.rewarded, true);
  assert.equal(retry.totalXp, 125);
  assert.equal(retry.rewarded, false);
});
