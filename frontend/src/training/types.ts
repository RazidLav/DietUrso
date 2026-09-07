export type ActivityType = "mobility" | "strength" | "crossfit" | "running" | "cycling" | "custom";

export type PlannedSessionStatus = "planned" | "skipped" | "canceled";
export type WorkoutSessionStatus = "in_progress" | "completed" | "partial";
export type LoadUnit = "kg" | "lb";
export type ExerciseScope = "global" | "personal";
export type SetStatus = "pending" | "completed" | "skipped";
export type StrengthTechnique =
  | "normal"
  | "superset"
  | "biset"
  | "triset"
  | "circuit"
  | "drop_set"
  | "strip_set"
  | "rest_pause"
  | "pyramid_up"
  | "pyramid_down";
export type RunningKind = "easy" | "recovery" | "interval" | "tempo" | "progressive" | "long" | "custom";
export type CyclingKind = "indoor" | "road" | "recovery" | "interval" | "custom";
export type CrossfitFormat = "amrap" | "emom" | "for_time" | "rounds_for_time" | "tabata" | "chipper" | "circuit";

export interface ExerciseDefinition {
  id: string;
  ownerId?: string;
  name: string;
  activityType: ActivityType;
  primaryMuscle?: string;
  secondaryMuscles: string[];
  equipment?: string;
  instructions?: string;
  cautions?: string;
  mediaUrl?: string;
  alternativeExerciseIds: string[];
  laterality: "bilateral" | "unilateral" | "not_applicable";
  scope: ExerciseScope;
  favorite: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrengthSetPlan {
  id: string;
  kind: "warmup" | "preparatory" | "working";
  plannedReps?: number;
  plannedRepMin?: number;
  plannedRepMax?: number;
  plannedLoad?: number;
  loadUnit: LoadUnit;
  restSeconds?: number;
  targetRir?: number;
  targetRpe?: number;
  tempo?: string;
  technique: StrengthTechnique;
  toFailure: boolean;
  notes?: string;
}

export interface StrengthExercisePlan {
  id: string;
  exerciseId?: string;
  exerciseSnapshot: Pick<ExerciseDefinition, "id" | "name" | "primaryMuscle" | "equipment" | "laterality">;
  order: number;
  groupId?: string;
  groupTechnique?: StrengthTechnique;
  executionNotes?: string;
  alternativeExerciseId?: string;
  sets: StrengthSetPlan[];
}

export interface MobilityMovementPlan {
  id: string;
  exerciseId?: string;
  name: string;
  bodyRegion?: string;
  durationSeconds?: number;
  sets?: number;
  repetitions?: number;
  sides: "both" | "right" | "left" | "not_applicable";
  instructions?: string;
  notes?: string;
  order: number;
}

export interface CardioBlock {
  id: string;
  phase: "warmup" | "work" | "recovery" | "cooldown" | "custom";
  name: string;
  repetitions?: number;
  durationSeconds?: number;
  distanceKm?: number;
  targetPaceSecondsPerKm?: number;
  targetSpeedKmh?: number;
  targetInclinePercent?: number;
  targetCadenceRpm?: number;
  targetPowerWatts?: number;
  notes?: string;
  order: number;
}

export interface RunningPrescription {
  kind: RunningKind;
  plannedDistanceKm?: number;
  plannedDurationMinutes?: number;
  location?: "street" | "track" | "treadmill";
  inclinePercent?: number;
  warmup?: string;
  cooldown?: string;
  blocks: CardioBlock[];
}

export interface CyclingPrescription {
  kind: CyclingKind;
  plannedDistanceKm?: number;
  plannedDurationMinutes?: number;
  resistanceLevel?: number;
  blocks: CardioBlock[];
}

export interface CrossfitMovementPlan {
  id: string;
  exerciseId?: string;
  name: string;
  repetitions?: number;
  load?: number;
  loadUnit?: LoadUnit;
  order: number;
}

export interface CrossfitBlock {
  id: string;
  section: "warmup" | "skill" | "strength" | "wod" | "mobility" | "cooldown";
  name: string;
  format?: CrossfitFormat;
  movements: CrossfitMovementPlan[];
  rounds?: number;
  timeCapMinutes?: number;
  workSeconds?: number;
  restSeconds?: number;
  notes?: string;
  order: number;
}

export interface WorkoutPrescription {
  activityType: ActivityType;
  strength?: { exercises: StrengthExercisePlan[] };
  mobility?: { movements: MobilityMovementPlan[]; plannedTotalMinutes?: number };
  running?: RunningPrescription;
  cycling?: CyclingPrescription;
  crossfit?: { blocks: CrossfitBlock[]; scale?: "rx" | "scaled" | "custom"; customScale?: string };
  custom?: { fields: { id: string; label: string; value: string }[] };
}

export interface WorkoutTemplate {
  id: string;
  ownerId?: string;
  name: string;
  activityType: ActivityType;
  description?: string;
  estimatedDurationMinutes?: number;
  prescription: WorkoutPrescription;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingPlanItem {
  id: string;
  templateId?: string;
  name: string;
  activityType: ActivityType;
  scheduledTime?: string;
  estimatedDurationMinutes?: number;
  prescription: WorkoutPrescription;
  order: number;
}

export interface TrainingPlanDay {
  weekday: number;
  items: TrainingPlanItem[];
}

export interface TrainingPlan {
  id: string;
  ownerId?: string;
  name: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  repeatWeekly: boolean;
  days: TrainingPlanDay[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedSession {
  id: string;
  ownerId?: string;
  planId?: string;
  planItemId?: string;
  templateId?: string;
  name: string;
  activityType: ActivityType;
  date: string;
  scheduledTime?: string;
  estimatedDurationMinutes?: number;
  status: PlannedSessionStatus;
  prescriptionSnapshot: WorkoutPrescription;
  notes?: string;
  sortOrder: number;
  exceptionOfId?: string;
  replacedById?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrengthSetResult {
  id: string;
  planSetId: string;
  exercisePlanId: string;
  exerciseId?: string;
  exerciseName: string;
  status: SetStatus;
  performedReps?: number;
  performedLoad?: number;
  loadUnit?: LoadUnit;
  rir?: number;
  rpe?: number;
  notes?: string;
  completedAt?: string;
}

export interface MobilityMovementResult {
  id: string;
  movementPlanId: string;
  status: SetStatus;
  performedDurationSeconds?: number;
  performedRepetitions?: number;
  rightCompleted?: boolean;
  leftCompleted?: boolean;
  notes?: string;
  completedAt?: string;
}

export interface RunningResult {
  distanceKm?: number;
  durationMinutes?: number;
  averagePaceSecondsPerKm?: number;
  averageSpeedKmh?: number;
  inclinePercent?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  rpe?: number;
  calories?: number;
  location?: "street" | "track" | "treadmill";
  painOrDiscomfort?: string;
  completedBlockIds: string[];
}

export interface CyclingResult {
  distanceKm?: number;
  durationMinutes?: number;
  averageSpeedKmh?: number;
  maxSpeedKmh?: number;
  averageCadenceRpm?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  averagePowerWatts?: number;
  maxPowerWatts?: number;
  resistanceLevel?: number;
  rpe?: number;
  calories?: number;
  completedBlockIds: string[];
}

export interface CrossfitResult {
  finalTimeSeconds?: number;
  rounds?: number;
  repetitions?: number;
  scale?: "rx" | "scaled" | "custom";
  customScale?: string;
  rpe?: number;
  completedBlockIds: string[];
}

export interface WorkoutResult {
  strengthSets: StrengthSetResult[];
  mobilityMovements: MobilityMovementResult[];
  running?: RunningResult;
  cycling?: CyclingResult;
  crossfit?: CrossfitResult;
  customFields?: { id: string; label: string; value: string }[];
}

export interface WorkoutSession {
  id: string;
  ownerId?: string;
  plannedSessionId?: string;
  name: string;
  activityType: ActivityType;
  date: string;
  scheduledTime?: string;
  status: WorkoutSessionStatus;
  isPaused: boolean;
  prescriptionSnapshot: WorkoutPrescription;
  result: WorkoutResult;
  notes?: string;
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalRecord {
  id: string;
  ownerId?: string;
  sessionId: string;
  exerciseId?: string;
  exerciseName?: string;
  metric: "max_load" | "max_reps" | "set_volume" | "fastest_5k" | "fastest_10k" | "cycling_distance";
  value: number;
  unit: string;
  achievedAt: string;
  dedupeKey: string;
}

export interface TrainingState {
  version: 1;
  activePlanId?: string;
  plans: TrainingPlan[];
  templates: WorkoutTemplate[];
  exercises: ExerciseDefinition[];
  plannedSessions: PlannedSession[];
  sessions: WorkoutSession[];
  personalRecords: PersonalRecord[];
}

export interface TrainingDayEntry {
  planned: PlannedSession;
  execution?: WorkoutSession;
  status: PlannedSessionStatus | WorkoutSessionStatus;
  progress: number;
}

export interface TrainingHistoryFilters {
  from?: string;
  to?: string;
  activityType?: ActivityType;
  planId?: string;
  exerciseId?: string;
  status?: WorkoutSessionStatus | PlannedSessionStatus;
}

export interface TrainingHistorySummary {
  planned: number;
  completed: number;
  partial: number;
  totalDurationMinutes: number;
  strengthVolume: number;
  runningDistanceKm: number;
  cyclingDistanceKm: number;
  mobilityMinutes: number;
  weeklyFrequency: number;
}
