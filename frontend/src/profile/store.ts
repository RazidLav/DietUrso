import AsyncStorage from "@react-native-async-storage/async-storage";
import { markLocalChange } from "../cloud/cloudSync";
import { PROFILE_STATE_KEY } from "../store/storageKeys";
import type { ProfileState } from "./types";
import { createInitialProfileState, sanitizeProfileState, validateUsername } from "./rules";

export * from "./rules";

export async function getProfileState() {
  const raw = await AsyncStorage.getItem(PROFILE_STATE_KEY);
  if (!raw) return createInitialProfileState();
  try { return sanitizeProfileState(JSON.parse(raw)); } catch { return createInitialProfileState(); }
}

export async function saveProfileState(next: ProfileState) {
  const username = next.profile.username ? validateUsername(next.profile.username) : null;
  if (username && !username.valid) throw new Error(username.message ?? "Username inválido.");
  const value = sanitizeProfileState({
    ...next,
    profile: { ...next.profile, username: username?.normalized || null },
    updatedAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(PROFILE_STATE_KEY, JSON.stringify(value));
  await markLocalChange();
  return value;
}
