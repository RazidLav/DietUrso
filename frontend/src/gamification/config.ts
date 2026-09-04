export const XP_REWARDS = {
  mealLogged: 10,
  dayCompleted: 45,
  proteinGoal: 30,
  calorieBalance: 30,
  waterGoal: 25,
} as const;

export const WATER_GOAL_ML = 2500;
export const WATER_STEP_ML = 250;

export const LEVEL_CONFIG = {
  baseXp: 180,
  growthPerLevel: 45,
  maxLevel: 999,
} as const;

const TITLE_MILESTONES = [
  { level: 75, title: "Urso Cósmico" },
  { level: 50, title: "Urso Anabolizado Naturalmente™" },
  { level: 40, title: "Rei da Floresta Proteica" },
  { level: 30, title: "Urso Absolutamente Enorme" },
  { level: 20, title: "Urso Brabo" },
  { level: 15, title: "Urso Parrudo" },
  { level: 10, title: "Urso Maromba" },
  { level: 5, title: "Urso Proteinado" },
  { level: 3, title: "Urso do Lanchinho" },
  { level: 1, title: "Ursinho Recém-Acordado" },
] as const;

export const MASCOT_QUOTES = [
  "Mais um dia alimentando a máquina.",
  "Proteína localizada. Missão cumprida.",
  "O urso respeitou o plano hoje.",
  "A floresta está orgulhosa.",
  "Alimentado, hidratado e perigosamente maromba.",
  "O shape agradece.",
  "O urso não vive só de whey. Mas ajuda.",
] as const;

export const STREAK_MILESTONES = [
  { days: 3, title: "Pegando o Ritmo" },
  { days: 7, title: "Urso Consistente" },
  { days: 14, title: "Firme igual pata de urso" },
  { days: 30, title: "Modo Maromba Ativado" },
  { days: 60, title: "Isso já virou personalidade" },
  { days: 100, title: "Lendário da Floresta" },
] as const;

export function xpForLevel(level: number) {
  return LEVEL_CONFIG.baseXp + Math.max(0, level - 1) * LEVEL_CONFIG.growthPerLevel;
}

export function titleForLevel(level: number) {
  return TITLE_MILESTONES.find((milestone) => level >= milestone.level)?.title ?? TITLE_MILESTONES.at(-1)!.title;
}

export function levelFromXp(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);

  while (level < LEVEL_CONFIG.maxLevel) {
    const required = xpForLevel(level);
    if (remaining < required) break;
    remaining -= required;
    level += 1;
  }

  const required = xpForLevel(level);
  return {
    level,
    title: titleForLevel(level),
    xpIntoLevel: remaining,
    xpForNextLevel: required,
    progress: required > 0 ? Math.min(remaining / required, 1) : 1,
  };
}
