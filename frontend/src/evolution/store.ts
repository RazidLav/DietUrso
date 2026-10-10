import AsyncStorage from "@react-native-async-storage/async-storage";
import { markLocalChange, syncCloudNow, getSignedInUser } from "../cloud/cloudSync";
import { EVOLUTION_STATE_KEY } from "../store/storageKeys";
import type { EvolutionState, PhysicalAssessment, PhysicalGoal, ProgressPhoto } from "./types";

const initialState = (): EvolutionState => ({
  version: 1,
  goal: { type: "recomposition", startedAt: new Date().toISOString() },
  assessments: [], photos: [], comparisonEvents: [],
});

export function sanitizeEvolutionState(value: unknown): EvolutionState {
  if (!value || typeof value !== "object") return initialState();
  const candidate = value as Partial<EvolutionState>;
  return {
    version: 1,
    goal: candidate.goal?.type ? candidate.goal : initialState().goal,
    assessments: Array.isArray(candidate.assessments) ? candidate.assessments.filter((item) => item && typeof item.id === "string") : [],
    photos: Array.isArray(candidate.photos) ? candidate.photos : [],
    comparisonEvents: Array.isArray(candidate.comparisonEvents) ? candidate.comparisonEvents : [],
  };
}

export async function getEvolutionState() {
  const raw = await AsyncStorage.getItem(EVOLUTION_STATE_KEY);
  if (!raw) return initialState();
  try { return sanitizeEvolutionState(JSON.parse(raw)); } catch { return initialState(); }
}

async function commit(state: EvolutionState) {
  await AsyncStorage.setItem(EVOLUTION_STATE_KEY, JSON.stringify(state));
  await markLocalChange();
  if (await getSignedInUser()) await syncCloudNow();
  return state;
}

export async function setPhysicalGoal(goal: Omit<PhysicalGoal, "startedAt">) {
  const state = await getEvolutionState();
  return commit({ ...state, goal: { ...goal, startedAt: new Date().toISOString() } });
}

export interface SaveAssessmentInput extends Omit<PhysicalAssessment, "id" | "createdAt" | "updatedAt"> { id?: string }

export async function saveAssessment(input: SaveAssessmentInput) {
  const state = await getEvolutionState();
  const current = input.id ? state.assessments.find((item) => item.id === input.id) : undefined;
  const now = new Date().toISOString();
  const assessment: PhysicalAssessment = {
    ...input,
    id: current?.id ?? `assessment-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  if (!assessment.weightKg && !Object.keys(assessment.measurements).length && !Object.keys(assessment.composition).length) throw new Error("Informe ao menos um dado da avaliação.");
  await commit({ ...state, assessments: current ? state.assessments.map((item) => item.id === assessment.id ? assessment : item) : [...state.assessments, assessment] });
  return assessment;
}

export async function deleteAssessment(id: string) {
  const state = await getEvolutionState();
  return commit({ ...state, assessments: state.assessments.filter((item) => item.id !== id), photos: state.photos.map((photo) => photo.assessmentId === id ? { ...photo, assessmentId: undefined } : photo) });
}

export async function registerComparison(leftId: string, rightId: string) {
  const state = await getEvolutionState();
  const key = [leftId, rightId].sort().join(":");
  if (state.comparisonEvents.includes(key)) return state;
  return commit({ ...state, comparisonEvents: [...state.comparisonEvents, key] });
}

export async function addProgressPhoto(photo: ProgressPhoto) {
  const state = await getEvolutionState();
  return commit({ ...state, photos: [...state.photos.filter((item) => item.id !== photo.id), photo] });
}

export async function removeProgressPhoto(id: string) {
  const state = await getEvolutionState();
  return commit({ ...state, photos: state.photos.filter((item) => item.id !== id) });
}
