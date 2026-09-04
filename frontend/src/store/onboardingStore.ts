import AsyncStorage from "@react-native-async-storage/async-storage";
import { markLocalChange } from "../cloud/cloudSync";
import { ONBOARDING_COMPLETE_KEY } from "./storageKeys";

export async function isOnboardingComplete() {
  return (await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)) === "1";
}

export async function completeOnboarding() {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
  await markLocalChange();
}
