export type AchievementRarity =
  | "Comum"
  | "Rara"
  | "Épica"
  | "Lendária"
  | "Urso Mítico";

export type AchievementCategory =
  | "Primeiros passos"
  | "Proteína"
  | "Alimentação"
  | "Água"
  | "Secretas";

export interface GamificationContext {
  totalMeals: number;
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  completedDays: number;
  proteinGoalDays: number;
  calorieBalanceDays: number;
  waterGoalDays: number;
  waterCurrentStreak: number;
  waterBestStreak: number;
  wheyMeals: number;
  chickenMeals: number;
  cheeseMeals: number;
  coffeeMeals: number;
  garlicMeals: number;
  variedFoodDays: number;
  freeMeals: number;
  controlledHighCalorieDays: number;
  veryHighCalorieMeals: number;
  overGoalDays: number;
  returnedAfterOverGoal: boolean;
  sixEggDays: number;
  bananaWheyMeals: number;
  bigBreakfasts: number;
  midnightMeals: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  lockedHint: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  hidden?: boolean;
  xpReward: number;
  unlockMessage: string;
  condition: (context: GamificationContext) => boolean;
}

export interface GamificationState {
  version: 1;
  totalXp: number;
  rewardedEvents: string[];
  unlockedAt: Record<string, string>;
  unseenUnlockIds: string[];
  initialized: boolean;
}

export interface GamificationSummary {
  state: GamificationState;
  context: GamificationContext;
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
  unlockedCount: number;
  totalAchievements: number;
}

export function createInitialGamificationState(): GamificationState {
  return {
    version: 1,
    totalXp: 0,
    rewardedEvents: [],
    unlockedAt: {},
    unseenUnlockIds: [],
    initialized: false,
  };
}
