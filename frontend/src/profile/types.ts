import type { CosmeticKind } from "../gamification/cosmetics";

export type ProfilePrivacy = "private" | "future_public";

export interface UserProfile {
  displayName: string;
  username: string | null;
  bio: string;
  photoPath: string | null;
  photoUrl: string | null;
  avatarMode: "bear" | "photo";
  privacy: ProfilePrivacy;
  showProgressStats: boolean;
  showStreakStats: boolean;
  joinedAt: string;
}

export interface ProfileFeaturedItem {
  id: string;
  type: "achievement" | "trophy" | "relic";
}

export interface ProfileState {
  version: 1;
  profile: UserProfile;
  unlockedCosmetics: Record<string, string>;
  equipped: Partial<Record<CosmeticKind, string>>;
  featured: ProfileFeaturedItem[];
  favoriteCollections: string[];
  updatedAt: string;
}
