import AsyncStorage from "@react-native-async-storage/async-storage";
import { INITIAL_PLAN } from "../data/dietData";
import { ConsumptionEntry, Food, Meal, MealOption, Plan } from "../types/plan";
import { markLocalChange } from "../cloud/cloudSync";
import {
  ACTIVE_PLAN_KEY,
  CHOSEN_OPTIONS_KEY,
  CONSUMPTION_KEY,
  PLANS_KEY,
  SEED_KEY,
  SHOPPING_STATE_KEY,
} from "./storageKeys";

// --------- helpers ---------
const uuid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
async function writeJson(key: string, value: any, trackChange = true) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  if (trackChange) await markLocalChange();
}

// --------- seed ---------
export async function ensureSeed(): Promise<void> {
  const seeded = await AsyncStorage.getItem(SEED_KEY);
  if (seeded) return;
  await writeJson(PLANS_KEY, [INITIAL_PLAN], false);
  await AsyncStorage.setItem(ACTIVE_PLAN_KEY, INITIAL_PLAN.id);
  await AsyncStorage.setItem(SEED_KEY, "1");
}

// --------- plans ---------
export async function listPlans(): Promise<Plan[]> {
  return readJson<Plan[]>(PLANS_KEY, []);
}
export async function savePlans(plans: Plan[]): Promise<void> {
  await writeJson(PLANS_KEY, plans);
}
export async function getActivePlanId(): Promise<string | null> {
  return AsyncStorage.getItem(ACTIVE_PLAN_KEY);
}
export async function setActivePlanId(id: string): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_PLAN_KEY, id);
  await markLocalChange();
}
export async function getActivePlan(): Promise<Plan | null> {
  const id = await getActivePlanId();
  const plans = await listPlans();
  if (!id) return plans.find((p) => !p.archived) ?? null;
  return plans.find((p) => p.id === id) ?? null;
}
export async function updatePlan(updated: Plan): Promise<void> {
  const plans = await listPlans();
  const idx = plans.findIndex((p) => p.id === updated.id);
  if (idx >= 0) plans[idx] = updated;
  else plans.push(updated);
  await savePlans(plans);
}
export async function createEmptyPlan(name: string): Promise<Plan> {
  const plan: Plan = {
    id: uuid(),
    name,
    description: "",
    archived: false,
    createdAt: new Date().toISOString(),
    meals: [],
  };
  const plans = await listPlans();
  plans.push(plan);
  await savePlans(plans);
  return plan;
}
export async function deletePlan(id: string): Promise<void> {
  const plans = await listPlans();
  const next = plans.filter((p) => p.id !== id);
  await savePlans(next);
  const activeId = await getActivePlanId();
  if (activeId === id) {
    const first = next.find((p) => !p.archived);
    if (first) await setActivePlanId(first.id);
    else {
      await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
      await markLocalChange();
    }
  }
}
export async function toggleArchivePlan(id: string): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === id);
  if (!plan) return;
  plan.archived = !plan.archived;
  await savePlans(plans);
}

// --------- meals/options/foods editing ---------
export async function upsertMeal(planId: string, meal: Meal): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  const idx = plan.meals.findIndex((m) => m.id === meal.id);
  if (idx >= 0) plan.meals[idx] = meal;
  else plan.meals.push(meal);
  await savePlans(plans);
}
export async function deleteMeal(planId: string, mealId: string): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return;
  plan.meals = plan.meals.filter((m) => m.id !== mealId);
  await savePlans(plans);
}
export async function upsertOption(
  planId: string,
  mealId: string,
  option: MealOption
): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  const meal = plan?.meals.find((m) => m.id === mealId);
  if (!plan || !meal) return;
  const idx = meal.options.findIndex((o) => o.id === option.id);
  if (idx >= 0) meal.options[idx] = option;
  else meal.options.push(option);
  await savePlans(plans);
}
export async function deleteOption(
  planId: string,
  mealId: string,
  optionId: string
): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  const meal = plan?.meals.find((m) => m.id === mealId);
  if (!plan || !meal) return;
  meal.options = meal.options.filter((o) => o.id !== optionId);
  await savePlans(plans);
}
export async function upsertFood(
  planId: string,
  mealId: string,
  optionId: string,
  food: Food
): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  const meal = plan?.meals.find((m) => m.id === mealId);
  const option = meal?.options.find((o) => o.id === optionId);
  if (!option) return;
  const idx = option.foods.findIndex((fd) => fd.id === food.id);
  if (idx >= 0) option.foods[idx] = food;
  else option.foods.push(food);
  await savePlans(plans);
}
export async function deleteFood(
  planId: string,
  mealId: string,
  optionId: string,
  foodId: string
): Promise<void> {
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === planId);
  const meal = plan?.meals.find((m) => m.id === mealId);
  const option = meal?.options.find((o) => o.id === optionId);
  if (!option) return;
  option.foods = option.foods.filter((f) => f.id !== foodId);
  await savePlans(plans);
}

// --------- consumption log ---------
export async function listConsumption(): Promise<ConsumptionEntry[]> {
  return readJson<ConsumptionEntry[]>(CONSUMPTION_KEY, []);
}
export async function addConsumption(entry: Omit<ConsumptionEntry, "id" | "createdAt">): Promise<void> {
  const all = await listConsumption();
  all.push({ ...entry, id: uuid(), createdAt: new Date().toISOString() });
  await writeJson(CONSUMPTION_KEY, all);
}
export async function removeConsumptionForDayMeal(date: string, mealId: string): Promise<void> {
  const all = await listConsumption();
  const filtered = all.filter((e) => !(e.date === date && e.mealId === mealId));
  await writeJson(CONSUMPTION_KEY, filtered);
}

// --------- chosen options per date ---------
type ChosenMap = Record<string, Record<string, string>>; // date -> mealId -> optionId
export async function getChosenOption(date: string, mealId: string): Promise<string | null> {
  const map = await readJson<ChosenMap>(CHOSEN_OPTIONS_KEY, {});
  return map[date]?.[mealId] ?? null;
}
export async function setChosenOption(date: string, mealId: string, optionId: string): Promise<void> {
  const map = await readJson<ChosenMap>(CHOSEN_OPTIONS_KEY, {});
  if (!map[date]) map[date] = {};
  map[date][mealId] = optionId;
  await writeJson(CHOSEN_OPTIONS_KEY, map);
}

// --------- shopping state ---------
type ShoppingState = Record<string, boolean>;
export async function getShoppingChecked(): Promise<ShoppingState> {
  return readJson<ShoppingState>(SHOPPING_STATE_KEY, {});
}
export async function setShoppingChecked(map: ShoppingState): Promise<void> {
  await writeJson(SHOPPING_STATE_KEY, map);
}

// --------- macro helpers ---------
export function foodMacros(food: Food) {
  return {
    kcal: food.kcal ?? 0,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fats: food.fats ?? 0,
  };
}
export function optionMacros(opt: MealOption) {
  return opt.foods.reduce(
    (a, f) => {
      const m = foodMacros(f);
      return {
        kcal: a.kcal + m.kcal,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fats: a.fats + m.fats,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fats: 0 }
  );
}
// Default day macros = sum of option 1 of each meal
export function dayMacrosDefault(plan: Plan) {
  return plan.meals.reduce(
    (a, meal) => {
      const opt = meal.options[0];
      if (!opt) return a;
      const m = optionMacros(opt);
      return {
        kcal: a.kcal + m.kcal,
        protein: a.protein + m.protein,
        carbs: a.carbs + m.carbs,
        fats: a.fats + m.fats,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fats: 0 }
  );
}
