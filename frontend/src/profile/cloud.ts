import { getSignedInUser } from "../cloud/cloudSync";
import { supabase } from "../cloud/supabase";
import type { UserProfile } from "./types";

export async function saveRemoteProfile(profile: UserProfile) {
  if (!supabase) return;
  const user = await getSignedInUser();
  if (!user) return;
  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    display_name: profile.displayName,
    username: profile.username,
    bio: profile.bio,
    photo_path: profile.photoPath,
    avatar_mode: profile.avatarMode,
    privacy: profile.privacy,
    profile_visibility: profile.profileVisibility,
    content_visibility: profile.contentVisibility,
    show_progress_stats: profile.showProgressStats,
    show_streak_stats: profile.showStreakStats,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error?.code === "23505") throw new Error("Esse username já está em uso.");
  if (error) throw error;
}
