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
  | "Treinos"
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
  waterRecords: number;
  customContainerUses: number;
  workoutSessions: number;
  strengthSessions: number;
  mobilitySessions: number;
  runningSessions: number;
  cyclingSessions: number;
  crossfitSessions: number;
  customSessions: number;
  workoutCurrentStreak: number;
  workoutBestStreak: number;
  completeTrainingWeeks: number;
  personalRecords: number;
  fiveKmRuns: number;
  tenKmRuns: number;
  multiModalityDays: number;
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
  personalFoods: number;
  recipes: number;
  offPlanMeals: number;
  returnedToPlanAfterOffPlan: boolean;
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
  version: 1 | 2;
  totalXp: number;
  rewardedEvents: string[];
  unlockedAt: Record<string, string>;
  unseenUnlockIds: string[];
  initialized: boolean;
  legacyLevelFloor: number;
  chapterCompletions: Record<number, string>;
}

export interface GamificationSummary {
  state: GamificationState;
  context: GamificationContext;
  level: number;
  narrativeLevel: number;
  legacyLevel: number;
  legacyFloorApplied: boolean;
  title: string;
  chapterNumber: number;
  chapterTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
  isMaxLevel: boolean;
  overflowXp: number;
  unlockedCount: number;
  totalAchievements: number;
}

export function createInitialGamificationState(): GamificationState {
  return {
    version: 2,
    totalXp: 0,
    rewardedEvents: [],
    unlockedAt: {},
    unseenUnlockIds: [],
    initialized: false,
    legacyLevelFloor: 1,
    chapterCompletions: {},
  };
}
