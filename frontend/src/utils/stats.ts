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
  const totalPerDay = plan?.meals.length ?? 0;

  const byDate = new Map<string, ConsumptionEntry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  const daysActive = byDate.size;
  let daysComplete = 0;
  const completedDates = new Set<string>();
  byDate.forEach((arr, date) => {
    const unique = new Set(arr.map((e) => e.mealId));
    if (totalPerDay > 0 && unique.size >= totalPerDay) {
      daysComplete += 1;
      completedDates.add(date);
    }
  });

  // Streak atual: contar para trás desde hoje enquanto o dia estiver completo.
  // Se hoje ainda não estiver completo, começamos pelo dia anterior.
  let currentStreak = 0;
  const today = new Date();
  for (let i = 0; i < 3650; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = localISO(d);
    if (completedDates.has(iso)) {
      currentStreak += 1;
    } else {
      if (i === 0) continue; // hoje ainda incompleto não zera streak que vem de ontem
      break;
    }
  }

  // Melhor streak
  const sortedDates = Array.from(completedDates).sort();
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
    const uniq = new Set(arr.map((e) => e.mealId));
    last7.push({ date: iso, count: uniq.size, total: totalPerDay });
  }

  return {
    totalMeals: entries.length,
    totalAsPlanned: entries.filter((e) => e.status === "as_planned").length,
    totalModified: entries.filter((e) => e.status === "modified").length,
    daysActive,
    daysComplete,
    currentStreak,
    bestStreak,
    last7,
  };
}

