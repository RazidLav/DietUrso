import AsyncStorage from "@react-native-async-storage/async-storage";
import { markLocalChange } from "../cloud/cloudSync";
import {
  ACTIVE_PLAN_KEY,
  CHOSEN_OPTIONS_KEY,
  CONSUMPTION_KEY,
  FOOD_LIBRARY_KEY,
  GAMIFICATION_KEY,
  HYDRATION_STATE_KEY,
  TRAINING_STATE_KEY,
  PLANS_KEY,
  RECIPES_KEY,
  WATER_KEY,
} from "../store/storageKeys";
import type { ConsumptionEntry, FoodCatalogItem, MealOption, Plan, Recipe } from "../types/plan";
import type { HydrationState } from "../hydration/types";
import type { TrainingState } from "../training/types";
import { entryNutrients } from "../nutrition/records";
import { categorizeFood } from "../utils/categories";
import { ACHIEVEMENTS, findAchievement } from "./achievements";
import { levelFromXp, WATER_GOAL_ML, XP_REWARDS } from "./config";
import { applyIdempotentReward } from "./rewards";
import {
  createInitialGamificationState,
  type GamificationContext,
  type GamificationState,
  type GamificationSummary,
} from "./types";

type ChosenOptions = Record<string, Record<string, string>>;
type WaterByDate = Record<string, number>;

interface ResolvedEntry {
  entry: ConsumptionEntry;
  kcal: number;
  protein: number;
  foodNames: string[];
  searchText: string;
  mealType: string;
  option: MealOption | null;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dayDiff(previous: string, current: string) {
  const a = Date.parse(`${previous}T12:00:00Z`);
  const b = Date.parse(`${current}T12:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function isoForOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function streaks(dates: Iterable<string>) {
  const sorted = Array.from(new Set(dates)).sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of sorted) {
    run = previous && dayDiff(previous, date) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  const available = new Set(sorted);
  let cursor = available.has(isoForOffset(0)) ? isoForOffset(0) : isoForOffset(-1);
  let current = 0;
  while (available.has(cursor)) {
    current += 1;
    const date = new Date(`${cursor}T12:00:00`);
    date.setDate(date.getDate() - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    cursor = `${year}-${month}-${day}`;
  }

  return { current, best };
}

function optionMacros(option: MealOption | null) {
  return (option?.foods ?? []).reduce(
    (total, food) => ({
      kcal: total.kcal + (food.kcal ?? 0),
      protein: total.protein + (food.protein ?? 0),
    }),
    { kcal: 0, protein: 0 }
  );
}

function planMealsForDate(plan: Plan | null, date: string) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return (plan?.meals ?? []).filter((meal) => !meal.archived && (!meal.daysOfWeek?.length || meal.daysOfWeek.includes(weekday)));
}

function planTargets(plan: Plan | null, date: string) {
  return planMealsForDate(plan, date).reduce(
    (total, meal) => {
      const macros = optionMacros(meal.options[0] ?? null);
      return {
        kcal: total.kcal + macros.kcal,
        protein: total.protein + macros.protein,
      };
    },
    { kcal: 0, protein: 0 }
  );
}

function resolveEntry(entry: ConsumptionEntry, plan: Plan | null, chosen: ChosenOptions): ResolvedEntry {
  const meal = plan?.meals.find((candidate) => candidate.id === entry.mealId);
  const optionId = entry.chosenOptionId ?? chosen[entry.date]?.[entry.mealId];
  const option = meal?.options.find((candidate) => candidate.id === optionId) ?? meal?.options[0] ?? null;
  const planned = optionMacros(option);
  const foodNames = entry.consumedItems?.map((item) => item.name)
    ?? entry.foodNames
    ?? (entry.status === "modified" || entry.status === "off_plan" ? [entry.note ?? ""] : (option?.foods ?? []).map((food) => food.name));
  const recorded = entryNutrients(entry);

  return {
    entry,
    kcal: entry.consumedItems?.length || entry.status === "modified" || entry.status === "off_plan" ? recorded.kcal : planned.kcal,
    protein: entry.consumedItems?.length || entry.status === "modified" || entry.status === "off_plan" ? recorded.protein : planned.protein,
    foodNames,
    searchText: normalize(foodNames.join(" ")),
    mealType: entry.mealType ?? meal?.type ?? "custom",
    option,
  };
}

function buildContext(
  entries: ConsumptionEntry[],
  plan: Plan | null,
  chosen: ChosenOptions,
  water: WaterByDate,
  hydration: HydrationState | undefined,
  training: TrainingState | undefined,
  personalFoods = 0,
  recipes = 0
): { context: GamificationContext; completedDates: string[]; proteinDates: string[]; balanceDates: string[]; waterDates: string[] } {
  const resolved = entries.filter((entry) => entry.status !== "skipped").map((entry) => resolveEntry(entry, plan, chosen));
  const byDate = new Map<string, ResolvedEntry[]>();
  resolved.forEach((item) => byDate.set(item.entry.date, [...(byDate.get(item.entry.date) ?? []), item]));
  const activeDates = Array.from(byDate.keys());
  const activeStreak = streaks(activeDates);
  const completedDates: string[] = [];
  const proteinDates: string[] = [];
  const balanceDates: string[] = [];
  const overDates: string[] = [];
  let variedFoodDays = 0;
  let controlledHighCalorieDays = 0;
  let sixEggDays = 0;

  byDate.forEach((items, date) => {
    const plannedMeals = planMealsForDate(plan, date);
    const plannedIds = new Set(plannedMeals.map((meal) => meal.id));
    const uniqueMeals = new Set(items.filter((item) => plannedIds.has(item.entry.mealId)).map((item) => item.entry.mealId));
    if (plannedMeals.length > 0 && uniqueMeals.size >= plannedMeals.length) completedDates.push(date);

    const targets = planTargets(plan, date);
    const dailyKcal = items.reduce((sum, item) => sum + item.kcal, 0);
    const dailyProtein = items.reduce((sum, item) => sum + item.protein, 0);
    if (targets.protein > 0 && dailyProtein >= targets.protein) proteinDates.push(date);
    if (targets.kcal > 0 && Math.abs(dailyKcal - targets.kcal) / targets.kcal <= 0.05) balanceDates.push(date);
    if (targets.kcal > 0 && dailyKcal > targets.kcal) overDates.push(date);
    if (targets.kcal > 0 && Math.abs(dailyKcal - targets.kcal) / targets.kcal <= 0.05 && items.some((item) => item.kcal >= 700)) {
      controlledHighCalorieDays += 1;
    }

    const categories = new Set<string>();
    items.forEach((item) => item.foodNames.filter(Boolean).forEach((name) => categories.add(categorizeFood(name))));
    if (categories.size >= 5) variedFoodDays += 1;

    const eggCount = items.reduce((sum, item) => {
      if (item.entry.status === "modified") {
        const match = item.searchText.match(/(\d+)\s*ovos?/);
        return sum + (match ? Number(match[1]) : 0);
      }
      return sum + (item.option?.foods ?? [])
        .filter((food) => normalize(food.name).includes("ovo"))
        .reduce((subtotal, food) => subtotal + (food.unit === "un" ? food.quantity : 1), 0);
    }, 0);
    if (eggCount >= 6) sixEggDays += 1;
  });

  const waterDates = Object.entries(water)
    .filter(([date, amount]) => amount >= (hydration?.daySnapshots[date]?.dailyGoalMl ?? hydration?.config.dailyGoalMl ?? WATER_GOAL_ML))
    .map(([date]) => date);
  const waterStreak = streaks(waterDates);
  const completedWorkouts = training?.sessions.filter((session) => session.status === "completed") ?? [];
  const workoutDates = Array.from(new Set(completedWorkouts.map((session) => session.date)));
  const workoutStreak = streaks(workoutDates);
  const modalityDays = new Map<string, Set<string>>();
  completedWorkouts.forEach((session) => modalityDays.set(session.date, new Set([...(modalityDays.get(session.date) ?? []), session.activityType])));
  const weekDays = new Map<string, Set<string>>();
  workoutDates.forEach((date) => {
    const value = new Date(`${date}T12:00:00`);
    const monday = new Date(value);
    monday.setDate(value.getDate() - ((value.getDay() + 6) % 7));
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    weekDays.set(key, new Set([...(weekDays.get(key) ?? []), date]));
  });
  const activeSet = new Set(activeDates);
  const returnedAfterOverGoal = overDates.some((date) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    return activeSet.has(nextIso);
  });
  const offPlanEntries = entries.filter((entry) => entry.status === "off_plan" || entry.isFreeMeal);
  const returnedToPlanAfterOffPlan = offPlanEntries.some((offPlan) =>
    entries.some((entry) =>
      entry.status === "as_planned" &&
      (entry.date > offPlan.date || (entry.date === offPlan.date && entry.createdAt > offPlan.createdAt))
    )
  );

  const contains = (item: ResolvedEntry, pattern: RegExp) => pattern.test(item.searchText);
  const context: GamificationContext = {
    totalMeals: resolved.length,
    activeDays: activeDates.length,
    currentStreak: activeStreak.current,
    bestStreak: activeStreak.best,
    completedDays: completedDates.length,
    proteinGoalDays: proteinDates.length,
    calorieBalanceDays: balanceDates.length,
    waterGoalDays: waterDates.length,
    waterCurrentStreak: waterStreak.current,
    waterBestStreak: waterStreak.best,
    waterRecords: hydration?.records.filter((record) => record.source !== "legacy").length ?? 0,
    customContainerUses: hydration?.records.filter((record) => record.source === "container").length ?? 0,
    workoutSessions: completedWorkouts.length,
    strengthSessions: completedWorkouts.filter((session) => session.activityType === "strength").length,
    mobilitySessions: completedWorkouts.filter((session) => session.activityType === "mobility").length,
    runningSessions: completedWorkouts.filter((session) => session.activityType === "running").length,
    cyclingSessions: completedWorkouts.filter((session) => session.activityType === "cycling").length,
    crossfitSessions: completedWorkouts.filter((session) => session.activityType === "crossfit").length,
    customSessions: completedWorkouts.filter((session) => session.activityType === "custom").length,
    workoutCurrentStreak: workoutStreak.current,
    workoutBestStreak: workoutStreak.best,
    completeTrainingWeeks: Array.from(weekDays.values()).filter((dates) => dates.size >= 3).length,
    personalRecords: training?.personalRecords.length ?? 0,
    fiveKmRuns: completedWorkouts.filter((session) => (session.result.running?.distanceKm ?? 0) >= 5).length,
    tenKmRuns: completedWorkouts.filter((session) => (session.result.running?.distanceKm ?? 0) >= 10).length,
    multiModalityDays: Array.from(modalityDays.values()).filter((types) => types.size >= 2).length,
    wheyMeals: resolved.filter((item) => contains(item, /\bwhey\b/)).length,
    chickenMeals: resolved.filter((item) => contains(item, /\bfrango\b/)).length,
    cheeseMeals: resolved.filter((item) => contains(item, /queijo|mucarela|requeijao|coalho/)).length,
    coffeeMeals: resolved.filter((item) => contains(item, /\bcafe\b/)).length,
    garlicMeals: resolved.filter((item) => contains(item, /\balho\b/)).length,
    variedFoodDays,
    freeMeals: resolved.filter((item) => item.entry.isFreeMeal || (item.entry.status === "modified" && /refeicao livre|comida livre|dia livre/.test(item.searchText))).length,
    controlledHighCalorieDays,
    veryHighCalorieMeals: resolved.filter((item) => item.kcal > 1000).length,
    overGoalDays: overDates.length,
    returnedAfterOverGoal,
    sixEggDays,
    bananaWheyMeals: resolved.filter((item) => contains(item, /banana/) && contains(item, /\bwhey\b/)).length,
    bigBreakfasts: resolved.filter((item) => /cafe|pos_treino/.test(item.mealType) && item.kcal >= 700).length,
    midnightMeals: entries.filter((entry) => {
      const hour = new Date(entry.createdAt).getHours();
      return hour >= 0 && hour < 5;
    }).length,
    personalFoods,
    recipes,
    offPlanMeals: offPlanEntries.length,
    returnedToPlanAfterOffPlan,
  };

  return { context, completedDates, proteinDates, balanceDates, waterDates };
}

function sanitizeState(value: GamificationState): GamificationState {
  const initial = createInitialGamificationState();
  if (!value || typeof value !== "object") return initial;
  return {
    version: 1,
    totalXp: Number.isFinite(value.totalXp) ? Math.max(0, value.totalXp) : 0,
    rewardedEvents: Array.isArray(value.rewardedEvents) ? value.rewardedEvents : [],
    unlockedAt: value.unlockedAt && typeof value.unlockedAt === "object" ? value.unlockedAt : {},
    unseenUnlockIds: Array.isArray(value.unseenUnlockIds) ? value.unseenUnlockIds : [],
    initialized: Boolean(value.initialized),
  };
}

export async function evaluateGamification(): Promise<GamificationSummary> {
  const [plans, activePlanId, entries, chosen, water, storedState, foods, recipes, hydration, training] = await Promise.all([
    readJson<Plan[]>(PLANS_KEY, []),
    AsyncStorage.getItem(ACTIVE_PLAN_KEY),
    readJson<ConsumptionEntry[]>(CONSUMPTION_KEY, []),
    readJson<ChosenOptions>(CHOSEN_OPTIONS_KEY, {}),
    readJson<WaterByDate>(WATER_KEY, {}),
    readJson<GamificationState>(GAMIFICATION_KEY, createInitialGamificationState()),
    readJson<FoodCatalogItem[]>(FOOD_LIBRARY_KEY, []),
    readJson<Recipe[]>(RECIPES_KEY, []),
    readJson<HydrationState | undefined>(HYDRATION_STATE_KEY, undefined),
    readJson<TrainingState | undefined>(TRAINING_STATE_KEY, undefined),
  ]);
  const plan = plans.find((candidate) => candidate.id === activePlanId) ?? plans.find((candidate) => !candidate.archived) ?? null;
  const state = sanitizeState(storedState);
  const { context, completedDates, proteinDates, balanceDates, waterDates } = buildContext(
    entries,
    plan,
    chosen,
    water,
    hydration,
    training,
    foods.filter((food) => food.scope === "personal").length,
    recipes.filter((recipe) => !recipe.archived).length
  );
  const rewarded = new Set(state.rewardedEvents);
  let totalXp = state.totalXp;
  let changed = false;

  const reward = (eventId: string, amount: number) => {
    const result = applyIdempotentReward(rewarded, totalXp, eventId, amount);
    if (!result.rewarded) return;
    rewarded.add(eventId);
    totalXp = result.totalXp;
    changed = true;
  };

  entries.forEach((entry) => reward(`meal:${entry.date}:${entry.mealId}`, XP_REWARDS.mealLogged));
  completedDates.forEach((date) => reward(`complete:${date}`, XP_REWARDS.dayCompleted));
  proteinDates.forEach((date) => reward(`protein:${date}`, XP_REWARDS.proteinGoal));
  balanceDates.forEach((date) => reward(`balance:${date}`, XP_REWARDS.calorieBalance));
  waterDates.forEach((date) => reward(`water:${date}`, XP_REWARDS.waterGoal));
  training?.sessions.filter((session) => session.status === "completed").forEach((session) => reward(`workout:${session.id}`, XP_REWARDS.workoutCompleted));
  training?.personalRecords.forEach((record) => reward(record.dedupeKey, XP_REWARDS.personalRecord));
  foods.filter((food) => food.scope === "personal").forEach((food) => reward(`food-created:${food.id}`, XP_REWARDS.foodCreated));
  recipes.forEach((recipe) => reward(`recipe-created:${recipe.id}`, XP_REWARDS.recipeCreated));
  entries.filter((entry) => entry.status === "off_plan").forEach((entry) => reward(`off-plan:${entry.id}`, XP_REWARDS.offPlanLogged));

  const unlockedAt = { ...state.unlockedAt };
  const newlyUnlocked: string[] = [];
  const now = new Date().toISOString();
  ACHIEVEMENTS.forEach((achievement) => {
    if (!unlockedAt[achievement.id] && achievement.condition(context)) {
      unlockedAt[achievement.id] = now;
      newlyUnlocked.push(achievement.id);
      totalXp += achievement.xpReward;
      changed = true;
    }
  });

  const unseenUnlockIds = state.initialized
    ? Array.from(new Set([...state.unseenUnlockIds, ...newlyUnlocked]))
    : newlyUnlocked.slice(-1);
  const nextState: GamificationState = {
    version: 1,
    totalXp,
    rewardedEvents: Array.from(rewarded),
    unlockedAt,
    unseenUnlockIds,
    initialized: true,
  };

  const meaningfulChange = changed || unseenUnlockIds.length !== state.unseenUnlockIds.length;
  if (!state.initialized || meaningfulChange) {
    await AsyncStorage.setItem(GAMIFICATION_KEY, JSON.stringify(nextState));
    if (meaningfulChange) await markLocalChange();
  }

  const level = levelFromXp(totalXp);
  return {
    state: nextState,
    context,
    ...level,
    unlockedCount: Object.keys(unlockedAt).length,
    totalAchievements: ACHIEVEMENTS.length,
  };
}

export async function dismissAchievement(id: string) {
  const state = sanitizeState(await readJson<GamificationState>(GAMIFICATION_KEY, createInitialGamificationState()));
  if (!state.unseenUnlockIds.includes(id)) return;
  state.unseenUnlockIds = state.unseenUnlockIds.filter((candidate) => candidate !== id);
  await AsyncStorage.setItem(GAMIFICATION_KEY, JSON.stringify(state));
  await markLocalChange();
}

export async function getPendingAchievement() {
  const state = sanitizeState(await readJson<GamificationState>(GAMIFICATION_KEY, createInitialGamificationState()));
  return state.unseenUnlockIds.length ? findAchievement(state.unseenUnlockIds[0]) : null;
}
