import type { CosmeticKind } from "../gamification/cosmetics";

export type ProfilePrivacy = "private" | "future_public";
export type SocialVisibility = "private" | "friends" | "public";
export type ProfileContentArea = "workouts" | "nutrition" | "hydration" | "achievements" | "evolution" | "photos" | "rugidos" | "challenges";

export interface UserProfile {
  displayName: string;
  username: string | null;
  bio: string;
  photoPath: string | null;
  photoUrl: string | null;
  avatarMode: "bear" | "photo";
  privacy: ProfilePrivacy;
  profileVisibility: SocialVisibility;
  contentVisibility: Record<ProfileContentArea, SocialVisibility>;
  showProgressStats: boolean;
  showStreakStats: boolean;
  joinedAt: string;
}

export type WellnessGoal = "weight_loss" | "hypertrophy" | "conditioning" | "performance" | "maintenance" | "wellbeing" | "custom";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export interface WellnessProfile {
  completedAt?: string;
  skippedAt?: string;
  birthDate?: string;
  heightCm?: number;
  currentWeightKg?: number;
  targetWeightKg?: number;
  primaryGoal?: WellnessGoal;
  customGoal?: string;
  experienceLevel?: ExperienceLevel;
  activities: string[];
  trainingDaysPerWeek?: number;
  sessionMinutes?: number;
  trainingGoal?: string;
  physicalConsiderations?: string;
  nutritionGoal?: string;
  mealsPerDay?: number;
  dietaryPreferences?: string;
  usualMealTimes: string[];
  followsProfessionalPlan?: boolean;
  usualWaterLiters?: number;
  hydrationGoalLiters?: number;
  hydrationReminders?: boolean;
  sleepTime?: string;
  wakeTime?: string;
  desiredSleepHours?: number;
  variableSchedule?: boolean;
  preferredTrainingPeriod?: "morning" | "afternoon" | "evening" | "varies";
  sensitiveDataConsent: boolean;
  updatedAt?: string;
}

export interface ProfileFeaturedItem {
  id: string;
  type: "achievement" | "trophy" | "relic";
}

export interface ProfileState {
  version: 1;
  profile: UserProfile;
  wellness: WellnessProfile;
  unlockedCosmetics: Record<string, string>;
  equipped: Partial<Record<CosmeticKind, string>>;
  featured: ProfileFeaturedItem[];
  favoriteCollections: string[];
  updatedAt: string;
}
