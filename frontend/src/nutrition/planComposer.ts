import { recipeNutrients, scaleNutrients } from "./calculations";
import type { Food, FoodCatalogItem, MealOption, Nutrients, Plan, Recipe, Unit } from "../types/plan";

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type MealOptionTemplate = {
  id: string;
  planId: string;
  planName: string;
  mealId: string;
  mealName: string;
  option: MealOption;
};

export function clonePlanFood(food: Food): Food {
  return {
    ...food,
    id: id("food"),
    substitutions: (food.substitutions ?? []).map((substitution) => ({ ...substitution, id: id("sub") })),
  };
}

export function cloneMealOption(option: MealOption, name = option.name): MealOption {
  return { ...option, id: id("option"), name, foods: option.foods.map(clonePlanFood) };
}

export function optionTemplates(plans: Plan[], excludingOptionId?: string): MealOptionTemplate[] {
  return plans.flatMap((plan) => plan.meals.flatMap((meal) => meal.options
    .filter((option) => option.id !== excludingOptionId && option.foods.length > 0)
    .map((option) => ({
      id: `${plan.id}:${meal.id}:${option.id}`,
      planId: plan.id,
      planName: plan.name,
      mealId: meal.id,
      mealName: meal.name,
      option,
    }))));
}

export function foodFromCatalog(item: FoodCatalogItem): Food {
  return {
    id: id("food"),
    foodId: item.id,
    name: item.name,
    brand: item.brand,
    category: item.category,
    quantity: item.referenceQuantity,
    unit: item.referenceUnit,
    referenceQuantity: item.referenceQuantity,
    referenceUnit: item.referenceUnit,
    kcal: item.nutrients.kcal,
    protein: item.nutrients.protein,
    carbs: item.nutrients.carbs,
    fats: item.nutrients.fats,
    fiber: item.nutrients.fiber,
    sodium: item.nutrients.sodium,
    notes: item.notes,
    substitutions: [],
  };
}

export function foodFromRecipe(recipe: Recipe): Food {
  const nutrients = recipeNutrients(recipe).perServing;
  return {
    id: id("recipe"),
    recipeId: recipe.id,
    name: recipe.name,
    category: recipe.category,
    quantity: 1,
    unit: "porcao",
    referenceQuantity: 1,
    referenceUnit: "porcao",
    kcal: nutrients.kcal,
    protein: nutrients.protein,
    carbs: nutrients.carbs,
    fats: nutrients.fats,
    fiber: nutrients.fiber,
    sodium: nutrients.sodium,
    notes: `1 de ${Math.max(1, recipe.servings)} porções da receita`,
    substitutions: [],
  };
}

function nutrientsFromFood(food: Food): Nutrients {
  return {
    kcal: food.kcal ?? 0,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fats: food.fats ?? 0,
    fiber: food.fiber ?? 0,
    sodium: food.sodium ?? 0,
  };
}

export function resizePlanFood(food: Food, quantity: number, catalog?: FoodCatalogItem, recipe?: Recipe): Food {
  const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
  let nutrients: Nutrients;
  if (catalog && catalog.referenceUnit === food.unit) {
    nutrients = scaleNutrients(catalog.nutrients, catalog.referenceQuantity, safeQuantity);
  } else if (catalog && food.unitEquivalents?.[food.unit]) {
    const equivalentQuantity = safeQuantity * (food.unitEquivalents[food.unit] ?? 0);
    nutrients = scaleNutrients(catalog.nutrients, catalog.referenceQuantity, equivalentQuantity);
  } else if (recipe && food.unit === "porcao") {
    nutrients = scaleNutrients(recipeNutrients(recipe).perServing, 1, safeQuantity);
  } else {
    nutrients = scaleNutrients(nutrientsFromFood(food), food.quantity || 1, safeQuantity);
  }
  return {
    ...food,
    quantity: safeQuantity,
    referenceQuantity: food.referenceQuantity || food.quantity || 1,
    referenceUnit: food.referenceUnit || food.unit,
    ...nutrients,
  };
}

export const UNIT_LABELS: Record<Unit, string> = {
  g: "g",
  ml: "ml",
  un: "un",
  porcao: "porção",
};

/**
 * Unidades compatíveis com a dimensão original do alimento. Não oferecemos,
 * por exemplo, ml para um sólido em gramas, pois isso exigiria uma conversão
 * que o catálogo não conhece.
 */
export function availableFoodUnits(food: Food): Unit[] {
  if (food.recipeId) return ["porcao"];
  const referenceUnit = food.referenceUnit ?? food.unit;
  if (referenceUnit === "g") return ["g", "un", "porcao"];
  if (referenceUnit === "ml") return ["ml", "un", "porcao"];
  if (referenceUnit === "un") return ["un", "porcao"];
  return ["porcao", "un"];
}

/**
 * Troca a forma de medir sem alterar os nutrientes do que já está na opção.
 * Quando uma medida doméstica ainda não possui equivalência, a quantidade
 * atual passa a representar 1 unidade/porção e a relação fica salva no item.
 */
export function changePlanFoodUnit(food: Food, nextUnit: Unit): Food {
  if (food.unit === nextUnit) return food;

  const referenceUnit = food.referenceUnit ?? food.unit;
  const referenceQuantity = food.referenceQuantity || food.quantity || 1;
  const equivalents = { ...(food.unitEquivalents ?? {}) };
  const currentEquivalent = food.unit === referenceUnit
    ? food.quantity
    : (equivalents[food.unit] ?? referenceQuantity) * food.quantity;

  if (nextUnit === referenceUnit) {
    return { ...food, quantity: currentEquivalent, unit: nextUnit, referenceQuantity, referenceUnit, unitEquivalents: equivalents };
  }

  const knownEquivalent = equivalents[nextUnit];
  if (knownEquivalent && knownEquivalent > 0) {
    return { ...food, quantity: currentEquivalent / knownEquivalent, unit: nextUnit, referenceQuantity, referenceUnit, unitEquivalents: equivalents };
  }

  equivalents[nextUnit] = currentEquivalent || referenceQuantity;
  return { ...food, quantity: 1, unit: nextUnit, referenceQuantity, referenceUnit, unitEquivalents: equivalents };
}

export function updatePlanFoodUnitEquivalent(food: Food, equivalentQuantity: number, catalog?: FoodCatalogItem): Food {
  const referenceUnit = food.referenceUnit ?? food.unit;
  if (food.unit === referenceUnit || !Number.isFinite(equivalentQuantity) || equivalentQuantity <= 0) return food;

  const equivalents = { ...(food.unitEquivalents ?? {}) };
  const previousEquivalent = equivalents[food.unit] ?? food.referenceQuantity ?? 1;
  equivalents[food.unit] = equivalentQuantity;
  const nutrients = catalog && catalog.referenceUnit === referenceUnit
    ? scaleNutrients(catalog.nutrients, catalog.referenceQuantity, equivalentQuantity * food.quantity)
    : scaleNutrients(nutrientsFromFood(food), previousEquivalent, equivalentQuantity);

  return { ...food, unitEquivalents: equivalents, ...nutrients };
}

export function mealTypeDefaultName(type: string, labels: Record<string, string>) {
  return labels[type] ?? "Refeição";
}
