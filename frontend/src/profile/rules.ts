import { COSMETIC_DEFINITIONS, findCosmetic, type CosmeticKind } from "../gamification/cosmetics";
import type { GamificationSummary } from "../gamification/types";
import type { ProfileFeaturedItem, ProfileState, WellnessProfile } from "./types";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
const RESERVED_USERNAMES = new Set(["admin", "administrator", "api", "app", "auth", "moderador", "moderator", "suporte", "support", "ursofit", "dieturso", "root", "system"]);

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!normalized) return { valid: true, normalized: "", message: null };
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) return { valid: false, normalized, message: `Use entre ${USERNAME_MIN} e ${USERNAME_MAX} caracteres.` };
  if (!/^[a-z0-9_]+$/.test(normalized)) return { valid: false, normalized, message: "Use somente letras minúsculas, números e sublinhado." };
  if (RESERVED_USERNAMES.has(normalized)) return { valid: false, normalized, message: "Este username é reservado pelo UrsoFit." };
  return { valid: true, normalized, message: null };
}

export function createInitialProfileState(now = new Date().toISOString()): ProfileState {
  return {
    version: 1,
    profile: {
      displayName: "Amigo do Urso", username: null, bio: "", photoPath: null, photoUrl: null,
      avatarMode: "bear", privacy: "private", showProgressStats: false, showStreakStats: false, joinedAt: now,
      profileVisibility: "private",
      contentVisibility: { workouts: "friends", nutrition: "private", hydration: "private", achievements: "friends", evolution: "private", photos: "private", rugidos: "friends", challenges: "friends" },
    },
    wellness: { activities: [], usualMealTimes: [], sensitiveDataConsent: false },
    unlockedCosmetics: { "avatar-01": now, "frame-classic": now, "banner-cave": now, "title-legacy-1": now },
    equipped: { avatar: "avatar-01", frame: "frame-classic", banner: "banner-cave", title: "title-legacy-1" },
    featured: [], favoriteCollections: [], updatedAt: now,
  };
}

export function sanitizeProfileState(value: unknown): ProfileState {
  const initial = createInitialProfileState();
  if (!value || typeof value !== "object") return initial;
  const candidate = value as Partial<ProfileState>;
  const profile = candidate.profile && typeof candidate.profile === "object" ? candidate.profile : initial.profile;
  const username = typeof profile.username === "string" ? validateUsername(profile.username) : null;
  const wellness = candidate.wellness && typeof candidate.wellness === "object" ? candidate.wellness as Partial<WellnessProfile> : {};
  const number = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
  return {
    version: 1,
    profile: {
      displayName: typeof profile.displayName === "string" && profile.displayName.trim() ? profile.displayName.trim().slice(0, 50) : initial.profile.displayName,
      username: username?.valid && username.normalized ? username.normalized : null,
      bio: typeof profile.bio === "string" ? profile.bio.slice(0, 160) : "",
      photoPath: typeof profile.photoPath === "string" ? profile.photoPath : null,
      photoUrl: typeof profile.photoUrl === "string" ? profile.photoUrl : null,
      avatarMode: profile.avatarMode === "photo" ? "photo" : "bear",
      privacy: profile.privacy === "future_public" ? "future_public" : "private",
      profileVisibility: profile.profileVisibility === "public" || profile.profileVisibility === "friends" ? profile.profileVisibility : "private",
      contentVisibility: { ...initial.profile.contentVisibility, ...(profile.contentVisibility && typeof profile.contentVisibility === "object" ? profile.contentVisibility : {}) },
      showProgressStats: Boolean(profile.showProgressStats),
      showStreakStats: Boolean(profile.showStreakStats),
      joinedAt: typeof profile.joinedAt === "string" ? profile.joinedAt : initial.profile.joinedAt,
    },
    wellness: {
      completedAt: typeof wellness.completedAt === "string" ? wellness.completedAt : undefined,
      skippedAt: typeof wellness.skippedAt === "string" ? wellness.skippedAt : undefined,
      birthDate: typeof wellness.birthDate === "string" ? wellness.birthDate : undefined,
      heightCm: number(wellness.heightCm, 80, 250), currentWeightKg: number(wellness.currentWeightKg, 20, 500), targetWeightKg: number(wellness.targetWeightKg, 20, 500),
      primaryGoal: ["weight_loss", "hypertrophy", "conditioning", "performance", "maintenance", "wellbeing", "custom"].includes(String(wellness.primaryGoal)) ? wellness.primaryGoal : undefined,
      customGoal: typeof wellness.customGoal === "string" ? wellness.customGoal.slice(0, 120) : undefined,
      experienceLevel: ["beginner", "intermediate", "advanced"].includes(String(wellness.experienceLevel)) ? wellness.experienceLevel : undefined,
      activities: Array.isArray(wellness.activities) ? wellness.activities.filter((item): item is string => typeof item === "string").slice(0, 20) : [],
      trainingDaysPerWeek: number(wellness.trainingDaysPerWeek, 0, 7), sessionMinutes: number(wellness.sessionMinutes, 5, 360), trainingGoal: typeof wellness.trainingGoal === "string" ? wellness.trainingGoal.slice(0, 160) : undefined,
      physicalConsiderations: typeof wellness.physicalConsiderations === "string" ? wellness.physicalConsiderations.slice(0, 500) : undefined,
      nutritionGoal: typeof wellness.nutritionGoal === "string" ? wellness.nutritionGoal.slice(0, 120) : undefined, mealsPerDay: number(wellness.mealsPerDay, 1, 12), dietaryPreferences: typeof wellness.dietaryPreferences === "string" ? wellness.dietaryPreferences.slice(0, 500) : undefined,
      usualMealTimes: Array.isArray(wellness.usualMealTimes) ? wellness.usualMealTimes.filter((item): item is string => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(item))).slice(0, 12) : [],
      followsProfessionalPlan: typeof wellness.followsProfessionalPlan === "boolean" ? wellness.followsProfessionalPlan : undefined,
      usualWaterLiters: number(wellness.usualWaterLiters, 0, 15), hydrationGoalLiters: number(wellness.hydrationGoalLiters, 0.1, 15), hydrationReminders: typeof wellness.hydrationReminders === "boolean" ? wellness.hydrationReminders : undefined,
      sleepTime: typeof wellness.sleepTime === "string" ? wellness.sleepTime : undefined, wakeTime: typeof wellness.wakeTime === "string" ? wellness.wakeTime : undefined, desiredSleepHours: number(wellness.desiredSleepHours, 1, 16), variableSchedule: typeof wellness.variableSchedule === "boolean" ? wellness.variableSchedule : undefined,
      preferredTrainingPeriod: ["morning", "afternoon", "evening", "varies"].includes(String(wellness.preferredTrainingPeriod)) ? wellness.preferredTrainingPeriod : undefined,
      sensitiveDataConsent: Boolean(wellness.sensitiveDataConsent), updatedAt: typeof wellness.updatedAt === "string" ? wellness.updatedAt : undefined,
    },
    unlockedCosmetics: candidate.unlockedCosmetics && typeof candidate.unlockedCosmetics === "object" ? candidate.unlockedCosmetics : initial.unlockedCosmetics,
    equipped: candidate.equipped && typeof candidate.equipped === "object" ? candidate.equipped : initial.equipped,
    featured: Array.isArray(candidate.featured) ? candidate.featured.filter((item): item is ProfileFeaturedItem => Boolean(item && typeof item.id === "string" && ["achievement", "trophy", "relic"].includes(item.type))).slice(0, 3) : [],
    favoriteCollections: Array.isArray(candidate.favoriteCollections) ? candidate.favoriteCollections.filter((item): item is string => typeof item === "string").slice(0, 5) : [],
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : initial.updatedAt,
  };
}

export function unlockEligibleCosmetics(state: ProfileState, summary: GamificationSummary) {
  const unlocked = { ...state.unlockedCosmetics };
  const now = new Date().toISOString();
  for (const item of COSMETIC_DEFINITIONS) {
    const condition = item.unlock;
    const eligible = condition.type === "default"
      || (condition.type === "level" && summary.legacyLevel >= Number(condition.value))
      || (condition.type === "streak" && summary.context.bestStreak >= Number(condition.value))
      || (condition.type === "achievement" && Boolean(summary.state.unlockedAt[String(condition.value)]))
      || (condition.type === "chapter" && Boolean(summary.state.chapterCompletions[Number(condition.value)]));
    if (eligible && !unlocked[item.id]) unlocked[item.id] = now;
  }
  return { ...state, unlockedCosmetics: unlocked };
}

export function equipCosmetic(state: ProfileState, kind: CosmeticKind, id: string) {
  const definition = findCosmetic(id);
  if (!definition || definition.kind !== kind || !state.unlockedCosmetics[id]) throw new Error("Este item ainda não foi desbloqueado.");
  return { ...state, equipped: { ...state.equipped, [kind]: id }, updatedAt: new Date().toISOString() };
}

export function setFeaturedItems(state: ProfileState, items: ProfileFeaturedItem[], unlockedAchievementIds: Iterable<string>) {
  const unlocked = new Set(unlockedAchievementIds);
  const unique = Array.from(new Map(items.map((item) => [`${item.type}:${item.id}`, item])).values());
  if (unique.length > 3) throw new Error("Escolha no máximo três destaques.");
  if (unique.some((item) => item.type === "achievement" && !unlocked.has(item.id))) throw new Error("Só é possível destacar conquistas desbloqueadas.");
  return { ...state, featured: unique, updatedAt: new Date().toISOString() };
}

export function safeFeaturedItems(state: ProfileState, validAchievementIds: Iterable<string>) {
  const valid = new Set(validAchievementIds);
  return state.featured.filter((item) => item.type !== "achievement" || valid.has(item.id)).slice(0, 3);
}
