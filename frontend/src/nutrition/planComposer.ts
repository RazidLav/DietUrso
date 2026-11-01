import { recipeNutrients, scaleNutrients } from "./calculations";
import type { Food, FoodCatalogItem, MealOption, Nutrients, Plan, Recipe } from "../types/plan";

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

export function mealTypeDefaultName(type: string, labels: Record<string, string>) {
  return labels[type] ?? "Refeição";
}
