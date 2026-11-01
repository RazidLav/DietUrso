import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cloneMealOption, foodFromCatalog, foodFromRecipe, optionTemplates, resizePlanFood } from "../src/nutrition/planComposer";
import type { FoodCatalogItem, MealOption, Plan, Recipe } from "../src/types/plan";

const catalogFood: FoodCatalogItem = {
  id: "bread", name: "Torrada", category: "Pães", referenceQuantity: 30, referenceUnit: "g",
  nutrients: { kcal: 120, protein: 4, carbs: 22, fats: 2, fiber: 2, sodium: 150 },
  scope: "global", archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01",
};

test("alimento cadastrado entra na opção com snapshot nutricional e escala a quantidade", () => {
  const food = foodFromCatalog(catalogFood);
  assert.equal(food.foodId, "bread");
  assert.equal(food.referenceQuantity, 30);
  const doubled = resizePlanFood(food, 60, catalogFood);
  assert.deepEqual({ kcal: doubled.kcal, protein: doubled.protein, carbs: doubled.carbs }, { kcal: 240, protein: 8, carbs: 44 });
});

test("alimento manual pode ter a quantidade editada mais de uma vez sem acumular escala", () => {
  const manual = { ...foodFromCatalog(catalogFood), foodId: undefined };
  const doubled = resizePlanFood(manual, 60);
  const tripled = resizePlanFood(doubled, 90);
  assert.equal(tripled.kcal, 360);
  assert.equal(tripled.protein, 12);
});

test("receita entra por porção e contribui para os macros da opção", () => {
  const recipe: Recipe = { id: "coffee", name: "Café com leite", category: "Bebidas", servings: 2, archived: false, createdAt: "2026-01-01", updatedAt: "2026-01-01", ingredients: [{ id: "i", foodId: catalogFood.id, foodSnapshot: catalogFood, quantity: 60, unit: "g" }] };
  const recipeFood = foodFromRecipe(recipe);
  assert.equal(recipeFood.unit, "porcao");
  assert.equal(recipeFood.kcal, 120);
  assert.equal(recipeFood.protein, 4);
});

test("usar opção como base gera novos ids e preserva os alimentos", () => {
  const option: MealOption = { id: "original", name: "Torradas e café", foods: [foodFromCatalog(catalogFood)] };
  const copy = cloneMealOption(option);
  assert.notEqual(copy.id, option.id);
  assert.notEqual(copy.foods[0].id, option.foods[0].id);
  assert.equal(copy.foods[0].name, "Torrada");
});

test("opções preenchidas de todos os planos ficam disponíveis como base", () => {
  const option: MealOption = { id: "original", name: "Torradas e café", foods: [foodFromCatalog(catalogFood)] };
  const plan: Plan = { id: "p", name: "Plano", archived: false, createdAt: "2026-01-01", meals: [{ id: "m", type: "pre_treino", name: "Pré-treino", options: [option] }] };
  assert.equal(optionTemplates([plan]).length, 1);
  assert.equal(optionTemplates([plan], option.id).length, 0);
});

test("gestão e edição de planos permanecem dentro do contexto Dieta", async () => {
  const [hub, settings, editor, composer] = await Promise.all([
    readFile(new URL("../app/(tabs)/alimentacao.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(tabs)/ajustes.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editor/[planId].tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/MealOptionComposer.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(hub, /Planos alimentares/);
  assert.doesNotMatch(settings, /new-plan-btn/);
  assert.match(editor, /MealOptionComposer/);
  assert.match(editor, /MacroSummary/);
  for (const capability of ["option-add-food", "option-add-recipe", "option-use-template", "option-live-macros"]) assert.match(composer, new RegExp(capability));
});
