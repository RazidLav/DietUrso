import type {
  ConsumedItemSnapshot,
  Food,
  FoodCatalogItem,
  Nutrients,
  Recipe,
  RecipeIngredient,
  Unit,
} from "../types/plan";

export const ZERO_NUTRIENTS: Nutrients = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  fiber: 0,
  sodium: 0,
};

export function finiteNonNegative(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function validPositive(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeNutrients(value: Partial<Nutrients> | null | undefined): Nutrients {
  return {
    kcal: finiteNonNegative(value?.kcal),
    protein: finiteNonNegative(value?.protein),
    carbs: finiteNonNegative(value?.carbs),
    fats: finiteNonNegative(value?.fats),
    fiber: finiteNonNegative(value?.fiber),
    sodium: finiteNonNegative(value?.sodium),
  };
}

export function addNutrients(...values: (Partial<Nutrients> | null | undefined)[]): Nutrients {
  return values.reduce<Nutrients>((total, value) => {
    const next = normalizeNutrients(value);
    return {
      kcal: total.kcal + next.kcal,
      protein: total.protein + next.protein,
      carbs: total.carbs + next.carbs,
      fats: total.fats + next.fats,
      fiber: total.fiber + next.fiber,
      sodium: total.sodium + next.sodium,
    };
  }, { ...ZERO_NUTRIENTS });
}

export function scaleNutrients(
  nutrients: Partial<Nutrients>,
  referenceQuantity: number,
  quantity: number
): Nutrients {
  const reference = validPositive(referenceQuantity);
  const amount = finiteNonNegative(quantity);
  if (!reference || amount === 0) return { ...ZERO_NUTRIENTS };
  const ratio = amount / reference;
  const base = normalizeNutrients(nutrients);
  return {
    kcal: base.kcal * ratio,
    protein: base.protein * ratio,
    carbs: base.carbs * ratio,
    fats: base.fats * ratio,
    fiber: base.fiber * ratio,
    sodium: base.sodium * ratio,
  };
}

export function foodNutrients(food: Food): Nutrients {
  return normalizeNutrients({
    kcal: food.kcal ?? 0,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fats: food.fats ?? 0,
    fiber: food.fiber ?? 0,
    sodium: food.sodium ?? 0,
  });
}

export function catalogItemNutrients(item: FoodCatalogItem, quantity: number, unit: Unit): Nutrients {
  if (unit !== item.referenceUnit) return { ...ZERO_NUTRIENTS };
  return scaleNutrients(item.nutrients, item.referenceQuantity, quantity);
}

export function ingredientNutrients(ingredient: RecipeIngredient): Nutrients {
  return catalogItemNutrients(ingredient.foodSnapshot, ingredient.quantity, ingredient.unit);
}

export function recipeNutrients(recipe: Recipe): { total: Nutrients; perServing: Nutrients } {
  const total = addNutrients(...recipe.ingredients.map(ingredientNutrients));
  const servings = validPositive(recipe.servings) ?? 1;
  return {
    total,
    perServing: scaleNutrients(total, servings, 1),
  };
}

export function consumedItemsNutrients(items: ConsumedItemSnapshot[]): Nutrients {
  return addNutrients(...items.map((item) => item.nutrients));
}

export function roundNutrients(value: Nutrients, digits = 1): Nutrients {
  const factor = 10 ** digits;
  const round = (number: number) => Math.round(number * factor) / factor;
  return {
    kcal: round(value.kcal),
    protein: round(value.protein),
    carbs: round(value.carbs),
    fats: round(value.fats),
    fiber: round(value.fiber),
    sodium: round(value.sodium),
  };
}

export function sameDimension(a: Unit, b: Unit) {
  return a === b;
}
