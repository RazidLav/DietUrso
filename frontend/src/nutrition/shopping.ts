import type { Food, Plan, Recipe, Substitution, Unit } from "../types/plan";
import { categorizeFood } from "../utils/categories";

export interface ShoppingLine {
  key: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: string;
  source: "plan" | "manual";
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function addLine(map: Map<string, ShoppingLine>, name: string, quantity: number, unit: Unit, category?: string) {
  if (!name.trim() || !Number.isFinite(quantity) || quantity <= 0) return;
  const key = `${normalize(name)}:${unit}`;
  const current = map.get(key);
  if (current) current.quantity += quantity;
  else map.set(key, { key, name: name.trim(), quantity, unit, category: category ?? categorizeFood(name), source: "plan" });
}

function selectedFood(food: Food, preferredSubstitutions: Record<string, string>): Food | Substitution {
  const substitutionId = preferredSubstitutions[food.id];
  return food.substitutions.find((substitution) => substitution.id === substitutionId) ?? food;
}

export function generateShoppingList(
  plan: Plan | null,
  recipes: Recipe[],
  startDate: string,
  periodDays: number,
  preferredSubstitutions: Record<string, string> = {}
): ShoppingLine[] {
  if (!plan || !Number.isFinite(periodDays) || periodDays <= 0) return [];
  const map = new Map<string, ShoppingLine>();
  const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const days = Array.from({ length: Math.floor(periodDays) }, (_, offset) => {
    const date = new Date(`${startDate}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return date.getDay();
  });

  days.forEach((weekday) => {
    plan.meals
      .filter((meal) => !meal.archived)
      .filter((meal) => !meal.daysOfWeek?.length || meal.daysOfWeek.includes(weekday))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((meal) => {
        const option = meal.options[0];
        if (!option) return;
        option.foods.forEach((food) => {
          const chosen = selectedFood(food, preferredSubstitutions);
          const recipeId = chosen.recipeId;
          const recipe = recipeId ? recipeMap.get(recipeId) : undefined;
          if (recipe) {
            const portionMultiplier = chosen.quantity || 1;
            recipe.ingredients.forEach((ingredient) =>
              addLine(map, ingredient.foodSnapshot.name, ingredient.quantity * portionMultiplier, ingredient.unit, ingredient.foodSnapshot.category)
            );
          } else {
            addLine(map, chosen.name, chosen.quantity, chosen.unit, "category" in chosen ? chosen.category : food.category);
          }
        });
      });
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function formatShoppingQuantity(quantity: number, unit: Unit) {
  if ((unit === "g" || unit === "ml") && quantity >= 1000) {
    return `${(quantity / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${unit === "g" ? "kg" : "L"}`;
  }
  return `${quantity.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unit === "porcao" ? "porção" : unit}`;
}
