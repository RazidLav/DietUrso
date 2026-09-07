import type {
  ConsumedItemSnapshot,
  ConsumptionEntry,
  Food,
  FoodCatalogItem,
  Meal,
  MealOption,
  Nutrients,
  Plan,
  Substitution,
} from "../types/plan";
import { addNutrients, foodNutrients, normalizeNutrients, sameDimension, scaleNutrients, ZERO_NUTRIENTS } from "./calculations";

export type SubstitutionSelection = Record<string, string>;
export type QuantityOverrides = Record<string, number>;

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function substitutionNutrients(substitution: Substitution): Nutrients {
  return normalizeNutrients({
    kcal: substitution.kcal ?? 0,
    protein: substitution.protein ?? 0,
    carbs: substitution.carbs ?? 0,
    fats: substitution.fats ?? 0,
    fiber: substitution.fiber ?? 0,
    sodium: substitution.sodium ?? 0,
  });
}

function normalizedName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function catalogMatch(substitution: Substitution, catalog: FoodCatalogItem[]) {
  return catalog.find((item) => item.id === substitution.foodId)
    ?? catalog.find((item) => normalizedName(item.name) === normalizedName(substitution.name)
      && sameDimension(item.referenceUnit, substitution.unit));
}

export function resolvePlanFood(
  food: Food,
  selectedSubstitution?: string,
  catalog: FoodCatalogItem[] = []
): Food {
  const substitution = selectedSubstitution && selectedSubstitution !== "original"
    ? food.substitutions.find((candidate) => candidate.id === selectedSubstitution)
    : undefined;
  if (!substitution) return food;

  const item = catalogMatch(substitution, catalog);
  const hasStoredNutrients = [
    substitution.kcal,
    substitution.protein,
    substitution.carbs,
    substitution.fats,
    substitution.fiber,
    substitution.sodium,
  ].some((value) => value !== null && value !== undefined);
  const nutrients = item
    ? scaleNutrients(item.nutrients, item.referenceQuantity, substitution.quantity)
    : hasStoredNutrients
      ? substitutionNutrients(substitution)
      : food.quantity > 0 && sameDimension(food.unit, substitution.unit)
        ? scaleNutrients(foodNutrients(food), food.quantity, substitution.quantity)
        : foodNutrients(food);

  return {
    ...food,
    foodId: substitution.foodId ?? item?.id,
    recipeId: substitution.recipeId,
    name: substitution.name,
    quantity: substitution.quantity,
    unit: substitution.unit,
    kcal: nutrients.kcal,
    protein: nutrients.protein,
    carbs: nutrients.carbs,
    fats: nutrients.fats,
    fiber: nutrients.fiber,
    sodium: nutrients.sodium,
  };
}

export function snapshotPlanFood(
  food: Food,
  selectedSubstitution?: string,
  actualQuantity?: number,
  catalog: FoodCatalogItem[] = []
): ConsumedItemSnapshot {
  const substitution = selectedSubstitution && selectedSubstitution !== "original"
    ? food.substitutions.find((candidate) => candidate.id === selectedSubstitution)
    : undefined;
  const resolved = resolvePlanFood(food, selectedSubstitution, catalog);
  const baseQuantity = resolved.quantity;
  const quantity = Number.isFinite(actualQuantity) && (actualQuantity ?? 0) >= 0
    ? actualQuantity as number
    : baseQuantity;
  const baseNutrients = foodNutrients(resolved);
  return {
    id: makeId("consumed"),
    kind: substitution?.recipeId || food.recipeId ? "recipe" : "food",
    sourceId: resolved.foodId ?? resolved.recipeId ?? food.foodId ?? food.recipeId,
    name: resolved.name,
    quantity,
    unit: resolved.unit,
    nutrients: baseQuantity > 0 ? scaleNutrients(baseNutrients, baseQuantity, quantity) : { ...ZERO_NUTRIENTS },
    originalItemName: substitution ? food.name : undefined,
    substitutionId: substitution?.id,
  };
}

export function createPlannedMealSnapshot(plan: Plan, meal: Meal, option: MealOption) {
  const items = option.foods.map((food) => snapshotPlanFood(food));
  return {
    planId: plan.id,
    planName: plan.name,
    mealId: meal.id,
    mealName: meal.name,
    mealType: meal.type,
    suggestedTime: meal.suggestedTime,
    optionId: option.id,
    optionName: option.name,
    items,
    nutrients: addNutrients(...items.map((item) => item.nutrients)),
  };
}

export function createPlannedDaySnapshot(
  plan: Plan,
  date: string,
  currentMealId?: string,
  currentOption?: MealOption
) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const meals = plan.meals.filter((meal) => !meal.archived && (!meal.daysOfWeek?.length || meal.daysOfWeek.includes(weekday)));
  return {
    mealCount: meals.length,
    nutrients: addNutrients(...meals.map((meal) => {
      const option = meal.id === currentMealId && currentOption ? currentOption : meal.options[0];
      return option
        ? addNutrients(...option.foods.map((food) => foodNutrients(food)))
        : ZERO_NUTRIENTS;
    })),
  };
}

export function createPlanConsumption(input: {
  plan: Plan;
  meal: Meal;
  option: MealOption;
  date: string;
  substitutions?: SubstitutionSelection;
  quantities?: QuantityOverrides;
  extras?: ConsumedItemSnapshot[];
  note?: string;
  actualAt?: string;
  isFreeMeal?: boolean;
  catalog?: FoodCatalogItem[];
}): Omit<ConsumptionEntry, "id" | "createdAt"> {
  const plannedSnapshot = createPlannedMealSnapshot(input.plan, input.meal, input.option);
  const plannedDay = createPlannedDaySnapshot(input.plan, input.date, input.meal.id, input.option);
  const consumedItems = input.option.foods.map((food) =>
    snapshotPlanFood(food, input.substitutions?.[food.id], input.quantities?.[food.id], input.catalog)
  );
  (input.extras ?? []).forEach((item) => consumedItems.push({ ...item, isExtra: true }));
  const nutrients = addNutrients(...consumedItems.map((item) => item.nutrients));
  const changed = consumedItems.some((item, index) => {
    const planned = plannedSnapshot.items[index];
    return !planned || item.substitutionId || item.isExtra || item.quantity !== planned.quantity;
  });
  return {
    date: input.date,
    mealId: input.meal.id,
    status: changed || input.note || input.isFreeMeal ? "modified" : "as_planned",
    chosenOptionId: input.option.id,
    note: input.note,
    isFreeMeal: input.isFreeMeal,
    mealName: input.meal.name,
    mealType: input.meal.type,
    actualAt: input.actualAt,
    consumedItems,
    plannedSnapshot,
    plannedDayNutrients: plannedDay.nutrients,
    plannedMealCount: plannedDay.mealCount,
    foodNames: consumedItems.map((item) => item.name),
    manualKcal: nutrients.kcal,
    manualProtein: nutrients.protein,
    manualCarbs: nutrients.carbs,
    manualFats: nutrients.fats,
  };
}

export function entryNutrients(entry: ConsumptionEntry): Nutrients {
  if (entry.status === "skipped") return { ...ZERO_NUTRIENTS };
  if (entry.consumedItems?.length) {
    return addNutrients(...entry.consumedItems.map((item) => item.nutrients));
  }
  return normalizeNutrients({
    kcal: entry.manualKcal ?? 0,
    protein: entry.manualProtein ?? 0,
    carbs: entry.manualCarbs ?? 0,
    fats: entry.manualFats ?? 0,
  });
}

export function dayConsumedNutrients(entries: ConsumptionEntry[], date: string): Nutrients {
  return addNutrients(
    ...entries.filter((entry) => entry.date === date).map(entryNutrients)
  );
}

export function entryPlannedNutrients(entry: ConsumptionEntry): Nutrients {
  return entry.plannedSnapshot?.nutrients ?? { ...ZERO_NUTRIENTS };
}

export function adherenceForDay(entries: ConsumptionEntry[], plannedMealCount: number): number {
  if (plannedMealCount <= 0) return 0;
  const followed = entries.filter((entry) => entry.status === "as_planned").length;
  const modified = entries.filter((entry) => entry.status === "modified" && !entry.isFreeMeal).length;
  return Math.min(100, ((followed + modified * 0.6) / plannedMealCount) * 100);
}
