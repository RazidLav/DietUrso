import type { ConsumptionEntry, Plan } from "../types/plan";

export interface Stats {
  totalMeals: number;
  totalAsPlanned: number;
  totalModified: number;
  daysActive: number;
  daysComplete: number;
  currentStreak: number;
  bestStreak: number;
  last7: { date: string; count: number; total: number }[];
}

function localISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeStats(entries: ConsumptionEntry[], plan: Plan | null): Stats {
  const activeMeals = (plan?.meals ?? []).filter((meal) => !meal.archived);
  const mealsForDate = (iso: string) => {
    const weekday = new Date(`${iso}T12:00:00`).getDay();
    return activeMeals.filter((meal) => !meal.daysOfWeek?.length || meal.daysOfWeek.includes(weekday));
  };
  const loggedEntries = entries.filter((entry) => entry.status !== "skipped");

  const byDate = new Map<string, ConsumptionEntry[]>();
  for (const e of loggedEntries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  const daysActive = byDate.size;
  let daysComplete = 0;
  const completedDates = new Set<string>();
  byDate.forEach((arr, date) => {
    const expected = new Set(mealsForDate(date).map((meal) => meal.id));
    const unique = new Set(arr.filter((entry) => expected.has(entry.mealId)).map((e) => e.mealId));
    const totalPerDay = expected.size;
    if (totalPerDay > 0 && unique.size >= totalPerDay) {
      daysComplete += 1;
      completedDates.add(date);
    }
  });

  // A sequência recompensa dias com ao menos um registro, não perfeição.
  // Se hoje ainda não tiver registro, preservamos a sequência que vem de ontem.
  const activeDates = new Set(byDate.keys());
  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < 3650; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = localISO(d);
    if (activeDates.has(iso)) {
      currentStreak += 1;
    } else {
      if (i === 0) continue; // hoje ainda incompleto não zera streak que vem de ontem
      break;
    }
  }

  // Melhor streak
  const sortedDates = Array.from(activeDates).sort();
  let bestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const iso of sortedDates) {
    const d = new Date(iso + "T00:00:00");
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prev = d;
  }

  const last7: { date: string; count: number; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = localISO(d);
    const arr = byDate.get(iso) ?? [];
    const dailyMeals = mealsForDate(iso);
    const dailyIds = new Set(dailyMeals.map((meal) => meal.id));
    const uniq = new Set(arr.filter((entry) => dailyIds.has(entry.mealId)).map((e) => e.mealId));
    const totalPerDay = dailyMeals.length;
    last7.push({ date: iso, count: uniq.size, total: totalPerDay });
  }

  return {
    totalMeals: loggedEntries.length,
    totalAsPlanned: loggedEntries.filter((e) => e.status === "as_planned").length,
    totalModified: loggedEntries.filter((e) => e.status === "modified" || e.status === "off_plan").length,
    daysActive,
    daysComplete,
    currentStreak,
    bestStreak,
    last7,
  };
}
