import AsyncStorage from "@react-native-async-storage/async-storage";
import { markLocalChange } from "../cloud/cloudSync";
import { evaluateGamification } from "../gamification/engine";
import { WATER_KEY } from "./storageKeys";

type WaterByDate = Record<string, number>;

async function readWater(): Promise<WaterByDate> {
  const raw = await AsyncStorage.getItem(WATER_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as WaterByDate;
  } catch {
    return {};
  }
}

export async function getWater(date: string) {
  const water = await readWater();
  return water[date] ?? 0;
}

export async function changeWater(date: string, delta: number) {
  const water = await readWater();
  water[date] = Math.max(0, Math.min(10000, (water[date] ?? 0) + delta));
  await AsyncStorage.setItem(WATER_KEY, JSON.stringify(water));
  await markLocalChange();
  await evaluateGamification();
  return water[date];
}
