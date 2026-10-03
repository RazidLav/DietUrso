import { getLevelDefinition, levelFromXp, XP_CURVE, xpForLevel } from "./journey";

export const XP_REWARDS = {
  mealLogged: 10,
  dayCompleted: 45,
  proteinGoal: 30,
  calorieBalance: 30,
  waterGoal: 25,
  workoutCompleted: 40,
  personalRecord: 30,
  foodCreated: 15,
  recipeCreated: 25,
  offPlanLogged: 10,
} as const;

export const WATER_GOAL_ML = 2500;
export const WATER_STEP_ML = 250;

export const LEVEL_CONFIG = XP_CURVE;

export const LEGACY_TITLE_MILESTONES = [
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

export function titleForLevel(level: number) {
  return getLevelDefinition(level).title;
}

export { levelFromXp, xpForLevel };
