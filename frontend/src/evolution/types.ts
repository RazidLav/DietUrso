export type PhysicalGoalType = "fat_loss" | "muscle_gain" | "recomposition" | "maintenance" | "performance" | "custom";
export type MeasurementUnit = "cm" | "in";
export type ProgressPhotoView = "front" | "back" | "left" | "right" | "free" | "additional";

export type BodyMeasurementKey =
  | "neck" | "shoulders" | "chest" | "right_arm" | "left_arm"
  | "right_forearm" | "left_forearm" | "waist" | "abdomen" | "hips"
  | "right_thigh" | "left_thigh" | "right_calf" | "left_calf";

export type BodyCompositionKey =
  | "body_fat_percent" | "fat_mass_kg" | "muscle_mass_kg" | "lean_mass_kg"
  | "bone_mass_kg" | "body_water_percent" | "visceral_fat" | "basal_metabolism_kcal"
  | "metabolic_age" | "bmi";

export interface PhysicalGoal {
  type: PhysicalGoalType;
  customLabel?: string;
  startedAt: string;
}

export interface PhysicalAssessment {
  id: string;
  takenAt: string;
  weightKg?: number;
  heightCm?: number;
  notes?: string;
  source?: string;
  method?: string;
  unit: MeasurementUnit;
  equipment?: string;
  completeness: "partial" | "complete";
  measurements: Partial<Record<BodyMeasurementKey, number>>;
  composition: Partial<Record<BodyCompositionKey, number>>;
  customComposition: { id: string; label: string; value: number; unit: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgressPhoto {
  id: string;
  assessmentId?: string;
  view: ProgressPhotoView;
  capturedAt: string;
  storagePath: string;
  thumbnailPath?: string;
  notes?: string;
  createdAt: string;
}

export interface EvolutionState {
  version: 1;
  goal: PhysicalGoal;
  assessments: PhysicalAssessment[];
  photos: ProgressPhoto[];
  comparisonEvents: string[];
}

export type EvolutionMetric = "weight_kg" | BodyMeasurementKey | BodyCompositionKey;

export interface TrendSummary {
  metric: EvolutionMetric;
  count: number;
  first?: number;
  current?: number;
  absoluteChange?: number;
  percentChange?: number;
  average?: number;
  trendPerDay?: number;
  enoughData: boolean;
}
