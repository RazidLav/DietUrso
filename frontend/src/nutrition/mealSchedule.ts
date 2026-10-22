import type { ConsumptionEntry, Meal, MealOption, Plan } from "../types/plan";
import { addNutrients, foodNutrients } from "./calculations";

export type MealScheduleState = "next" | "now" | "pending" | "completed" | "unscheduled";

export interface ScheduledMealView {
  meal: Meal;
  option?: MealOption;
  plannedTime?: string;
  plannedAt?: Date;
  state: MealScheduleState;
  minutesDifference?: number;
  kcal: number;
  entry?: ConsumptionEntry;
}

export function mealTimeForWeekday(meal: Meal, weekday: number) {
  const override = meal.scheduleByWeekday?.[weekday];
  return validTime(override) ? override : validTime(meal.suggestedTime) ? meal.suggestedTime : undefined;
}

export function isValidMealTime(value?: string): value is string {
  return validTime(value);
}

function validTime(value?: string): value is string {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

function dateAtTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function scheduledMealsForDate(
  plan: Plan,
  entries: ConsumptionEntry[],
  date: string,
  now = new Date(),
  chosenOptions: Record<string, string> = {},
): ScheduledMealView[] {
  const localDate = dateAtTime(date, "12:00");
  const weekday = localDate.getDay();
  return plan.meals
    .filter((meal) => !meal.archived && (!meal.daysOfWeek?.length || meal.daysOfWeek.includes(weekday)))
    .map((meal) => {
      const plannedTime = mealTimeForWeekday(meal, weekday);
      const plannedAt = plannedTime ? dateAtTime(date, plannedTime) : undefined;
      const entry = entries.find((candidate) => candidate.date === date && candidate.mealId === meal.id && candidate.status !== "off_plan");
      const option = meal.options.find((candidate) => candidate.id === chosenOptions[meal.id]) ?? meal.options[0];
      const minutesDifference = plannedAt ? Math.round((plannedAt.getTime() - now.getTime()) / 60000) : undefined;
      const state: MealScheduleState = entry
        ? "completed"
        : !plannedAt
          ? "unscheduled"
          : minutesDifference! > 15
            ? "next"
            : minutesDifference! >= -30
              ? "now"
              : "pending";
      return { meal, option, plannedTime, plannedAt, state, minutesDifference, kcal: option ? addNutrients(...option.foods.map(foodNutrients)).kcal : 0, entry };
    })
    .sort((a, b) => {
      if (a.plannedAt && b.plannedAt) return a.plannedAt.getTime() - b.plannedAt.getTime();
      if (a.plannedAt) return -1;
      if (b.plannedAt) return 1;
      return (a.meal.order ?? 0) - (b.meal.order ?? 0);
    });
}

export function resolveMealScheduleFocus(items: ScheduledMealView[]) {
  const current = items.find((item) => item.state === "now");
  if (current) return current;
  const next = items.find((item) => item.state === "next");
  if (next) return next;
  const pending = items.filter((item) => item.state === "pending").at(-1);
  return pending ?? items.find((item) => item.state === "unscheduled");
}

export function formatMealCountdown(item: ScheduledMealView) {
  if (item.state === "completed") return "Concluída";
  if (item.state === "unscheduled") return "Sem horário fixo";
  const minutes = Math.abs(item.minutesDifference ?? 0);
  if (item.state === "now") return minutes <= 5 ? "Agora" : item.minutesDifference! > 0 ? `Em ${minutes} min` : `Há ${minutes} min`;
  if (item.state === "pending") return `Pendente há ${minutes} min`;
  if (minutes < 60) return `Em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `Em ${hours}h ${rest}min` : `Em ${hours}h`;
}
