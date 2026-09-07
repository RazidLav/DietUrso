import assert from "node:assert/strict";
import test from "node:test";
import { addNutrients, catalogItemNutrients, recipeNutrients, scaleNutrients, validPositive, ZERO_NUTRIENTS } from "../src/nutrition/calculations";
import { createPlanConsumption, createPlannedDaySnapshot, entryNutrients, resolvePlanFood } from "../src/nutrition/records";
import { generateShoppingList } from "../src/nutrition/shopping";
import type { FoodCatalogItem, Plan, Recipe } from "../src/types/plan";

const now = "2026-09-07T12:00:00.000Z";
const closeTo = (actual: number, expected: number, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} deveria ser aproximadamente ${expected}`);
const rice: FoodCatalogItem = {
  id: "rice", name: "Arroz cozido", category: "Carboidratos", referenceQuantity: 100, referenceUnit: "g",
  nutrients: { kcal: 130, protein: 2.5, carbs: 28, fats: 0.3, fiber: 1.6, sodium: 1 },
  scope: "global", archived: false, createdAt: now, updatedAt: now,
};
const chicken: FoodCatalogItem = {
  id: "chicken", name: "Frango cozido", category: "Proteínas", referenceQuantity: 100, referenceUnit: "g",
  nutrients: { kcal: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0, sodium: 74 },
  scope: "global", archived: false, createdAt: now, updatedAt: now,
};

test("calcula nutrientes proporcionalmente e mantém precisão interna", () => {
  const result = scaleNutrients(rice.nutrients, 100, 35);
  assert.equal(result.kcal, 45.5);
  closeTo(result.carbs, 9.8);
  closeTo(result.fiber, 0.56);
});

test("bloqueia referência zero, quantidade negativa e valores inválidos", () => {
  assert.equal(validPositive(0), null);
  assert.equal(validPositive(-2), null);
  assert.deepEqual(scaleNutrients(rice.nutrients, 0, 35), ZERO_NUTRIENTS);
  assert.deepEqual(scaleNutrients(rice.nutrients, 100, -1), ZERO_NUTRIENTS);
});

test("soma calorias e todos os macronutrientes sem arredondar antes da exibição", () => {
  const result = addNutrients(catalogItemNutrients(rice, 130, "g"), catalogItemNutrients(chicken, 90, "g"));
  assert.equal(result.kcal, 317.5);
  closeTo(result.protein, 31.15);
  closeTo(result.fiber, 2.08);
});

test("calcula receita inteira e por porção", () => {
  const recipe: Recipe = {
    id: "recipe", name: "Arroz com frango", ingredients: [
      { id: "i1", foodId: rice.id, foodSnapshot: rice, quantity: 200, unit: "g" },
      { id: "i2", foodId: chicken.id, foodSnapshot: chicken, quantity: 200, unit: "g" },
    ], servings: 2, category: "Refeições", archived: false, createdAt: now, updatedAt: now,
  };
  const result = recipeNutrients(recipe);
  assert.equal(result.total.kcal, 590);
  assert.equal(result.perServing.kcal, 295);
  assert.equal(result.perServing.protein, 33.5);
});

test("snapshot do consumo preserva o plano e registra substituição e quantidade real", () => {
  const plan: Plan = {
    id: "p1", name: "Plano", archived: false, createdAt: now,
    meals: [{ id: "lunch", type: "almoco", name: "Almoço", options: [{ id: "o1", name: "Principal", foods: [{
      id: "planned-rice", foodId: rice.id, name: rice.name, quantity: 100, unit: "g", kcal: 130, protein: 2.5, carbs: 28, fats: 0.3, fiber: 1.6, sodium: 1,
      substitutions: [{ id: "sweet-potato", name: "Batata-doce", quantity: 120, unit: "g", kcal: 103, protein: 1.9, carbs: 24, fats: 0.1 }],
    }] }] }],
  };
  const originalPlan = JSON.stringify(plan);
  const entry = createPlanConsumption({ plan, meal: plan.meals[0], option: plan.meals[0].options[0], date: "2026-09-07", substitutions: { "planned-rice": "sweet-potato" }, quantities: { "planned-rice": 60 } });
  assert.equal(entry.status, "modified");
  assert.equal(entry.consumedItems?.[0].name, "Batata-doce");
  assert.equal(entry.consumedItems?.[0].originalItemName, "Arroz cozido");
  assert.equal(entry.consumedItems?.[0].nutrients.kcal, 51.5);
  assert.equal(JSON.stringify(plan), originalPlan);
  plan.meals[0].options[0].foods[0].kcal = 999;
  assert.equal(entry.plannedDayNutrients?.kcal, 130);
});

test("substituição antiga resolve nutrientes pelo catálogo persistente", () => {
  const bread: FoodCatalogItem = {
    id: "bread", name: "Pão francês", category: "Carboidratos", referenceQuantity: 100, referenceUnit: "g",
    nutrients: { kcal: 275, protein: 7.5, carbs: 55, fats: 2.5, fiber: 2.3, sodium: 648 },
    scope: "global", archived: false, createdAt: now, updatedAt: now,
  };
  const planned = {
    id: "toast", name: "Torradas", quantity: 37.5, unit: "g" as const,
    kcal: 148, protein: 3, carbs: 30, fats: 2, substitutions: [
      { id: "bread-sub", name: "Pão francês", quantity: 40, unit: "g" as const, kcal: null, protein: null, carbs: null, fats: null },
    ],
  };
  const resolved = resolvePlanFood(planned, "bread-sub", [bread]);
  assert.equal(resolved.kcal, 110);
  assert.equal(resolved.protein, 3);
  closeTo(resolved.fiber ?? 0, 0.92);
  assert.equal(resolved.foodId, bread.id);
});

test("meta diária respeita dias programados e ignora refeições arquivadas", () => {
  const baseFood = { id: "f", name: "Arroz", quantity: 100, unit: "g" as const, kcal: 130, protein: 2.5, carbs: 28, fats: 0.3, substitutions: [] };
  const plan: Plan = {
    id: "scheduled", name: "Programado", archived: false, createdAt: now,
    meals: [
      { id: "monday", name: "Segunda", type: "almoco", daysOfWeek: [1], options: [{ id: "o1", name: "A", foods: [baseFood] }] },
      { id: "archived", name: "Arquivada", type: "jantar", archived: true, options: [{ id: "o2", name: "B", foods: [{ ...baseFood, id: "f2" }] }] },
    ],
  };
  assert.deepEqual(createPlannedDaySnapshot(plan, "2026-09-07"), {
    mealCount: 1,
    nutrients: { kcal: 130, protein: 2.5, carbs: 28, fats: 0.3, fiber: 0, sodium: 0 },
  });
  assert.equal(createPlannedDaySnapshot(plan, "2026-09-06").mealCount, 0);
});

test("histórico usa nutrientes do snapshot mesmo se o plano mudar depois", () => {
  const originalNutrients = { ...rice.nutrients };
  const entry = {
    id: "e1", date: "2026-09-07", mealId: "lunch", status: "modified" as const, createdAt: now,
    consumedItems: [{ id: "c1", kind: "food" as const, name: "Arroz", quantity: 100, unit: "g" as const, nutrients: originalNutrients }],
  };
  rice.nutrients.kcal = 999;
  assert.equal(entryNutrients(entry).kcal, 130);
  rice.nutrients = originalNutrients;
});

test("lista de compras consolida itens iguais e respeita período", () => {
  const plan: Plan = {
    id: "p", name: "Plano", archived: false, createdAt: now,
    meals: [
      { id: "m1", type: "almoco", name: "Almoço", options: [{ id: "o1", name: "A", foods: [{ id: "f1", name: "Arroz cozido", quantity: 100, unit: "g", kcal: 130, protein: 2.5, carbs: 28, fats: 0.3, substitutions: [] }] }] },
      { id: "m2", type: "jantar", name: "Jantar", options: [{ id: "o2", name: "B", foods: [{ id: "f2", name: "Arroz cozido", quantity: 50, unit: "g", kcal: 65, protein: 1.25, carbs: 14, fats: 0.15, substitutions: [] }] }] },
    ],
  };
  const result = generateShoppingList(plan, [], "2026-09-07", 3);
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 450);
});

test("lista expande receita sem somar alternativas simultaneamente", () => {
  const recipe: Recipe = { id: "r", name: "Frango preparado", ingredients: [{ id: "i", foodId: chicken.id, foodSnapshot: { ...chicken, nutrients: { ...chicken.nutrients } }, quantity: 200, unit: "g" }], servings: 2, category: "Proteínas", archived: false, createdAt: now, updatedAt: now };
  const plan: Plan = { id: "p", name: "Plano", archived: false, createdAt: now, meals: [{ id: "m", type: "almoco", name: "Almoço", options: [{ id: "o", name: "A", foods: [{ id: "f", recipeId: "r", name: "Frango preparado", quantity: 1, unit: "porcao", kcal: 165, protein: 31, carbs: 0, fats: 3.6, substitutions: [{ id: "alt", name: "Ovos", quantity: 2, unit: "un", kcal: 144, protein: 12, carbs: 0, fats: 10 }] }] }] }] };
  const primary = generateShoppingList(plan, [recipe], "2026-09-07", 1);
  assert.equal(primary[0].name, "Frango cozido");
  assert.equal(primary[0].quantity, 200);
  const alternative = generateShoppingList(plan, [recipe], "2026-09-07", 1, { f: "alt" });
  assert.equal(alternative.length, 1);
  assert.equal(alternative[0].name, "Ovos");
});
