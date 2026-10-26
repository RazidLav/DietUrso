import assert from "node:assert/strict";
import test from "node:test";
import { inferredMealFocusTime, prioritizeCurrentTimelineItem, resolveCurrentTimelineId } from "../src/home/timeline";

test("Home infere faixas coerentes sem alterar o horário salvo da refeição", () => {
  assert.equal(inferredMealFocusTime("cafe"), "08:00");
  assert.equal(inferredMealFocusTime("almoco"), "12:30");
  assert.equal(inferredMealFocusTime("lanche"), "16:00");
  assert.equal(inferredMealFocusTime("jantar"), "19:30");
  assert.equal(inferredMealFocusTime("custom"), undefined);
});

test("AGORA acompanha a atividade mais próxima do horário real", () => {
  const items = [
    { id: "cafe", completed: false, focusTime: "08:00" },
    { id: "almoco", completed: false, focusTime: "12:30" },
    { id: "lanche", completed: false, focusTime: "16:00" },
    { id: "jantar", completed: false, focusTime: "19:30" },
  ];
  assert.equal(resolveCurrentTimelineId(items, true, new Date(2026, 9, 25, 16, 32)), "lanche");
  assert.equal(resolveCurrentTimelineId(items, true, new Date(2026, 9, 25, 19, 10)), "jantar");
});

test("sessão em andamento vence o relógio e AGORA não aparece em outro dia", () => {
  const items = [
    { id: "lanche", completed: false, focusTime: "16:00" },
    { id: "treino", completed: false, active: true, focusTime: "18:00" },
  ];
  assert.equal(resolveCurrentTimelineId(items, true, new Date(2026, 9, 25, 16, 32)), "treino");
  assert.equal(resolveCurrentTimelineId(items.map((item) => ({ ...item, active: false })), false), undefined);
});

test("AGORA vira a primeira linha e o restante continua em ordem circular", () => {
  const items = [{ id: "cafe" }, { id: "almoco" }, { id: "lanche" }, { id: "jantar" }];
  assert.deepEqual(prioritizeCurrentTimelineItem(items, "lanche").map((item) => item.id), ["lanche", "jantar", "cafe", "almoco"]);
  assert.deepEqual(prioritizeCurrentTimelineItem(items, undefined), items);
});
