import type { ActivityType, ExerciseDefinition } from "./types";

const CREATED_AT = "2026-09-07T00:00:00.000Z";

function globalExercise(
  id: string,
  name: string,
  activityType: ActivityType,
  primaryMuscle: string,
  equipment: string,
  instructions: string,
  laterality: ExerciseDefinition["laterality"] = "bilateral",
): ExerciseDefinition {
  return {
    id: `global-${id}`,
    name,
    activityType,
    primaryMuscle,
    secondaryMuscles: [],
    equipment,
    instructions,
    alternativeExerciseIds: [],
    laterality,
    scope: "global",
    favorite: false,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

export const GLOBAL_EXERCISES: ExerciseDefinition[] = [
  globalExercise("agachamento-livre", "Agachamento livre", "strength", "Quadríceps", "Barra", "Mantenha o tronco firme e desça apenas na amplitude controlada."),
  globalExercise("supino-reto", "Supino reto", "strength", "Peitoral", "Barra ou halteres", "Retraia as escápulas e mantenha os pés apoiados."),
  globalExercise("remada-baixa", "Remada baixa", "strength", "Costas", "Polia", "Puxe sem projetar os ombros e controle o retorno."),
  globalExercise("levantamento-terra", "Levantamento terra", "strength", "Posterior de coxa", "Barra", "Mantenha a coluna neutra e a carga próxima ao corpo."),
  globalExercise("desenvolvimento", "Desenvolvimento de ombros", "strength", "Ombros", "Halteres", "Evite compensar com hiperextensão lombar."),
  globalExercise("rosca-direta", "Rosca direta", "strength", "Bíceps", "Barra ou halteres", "Mantenha os cotovelos estáveis e controle a descida."),
  globalExercise("triceps-polia", "Tríceps na polia", "strength", "Tríceps", "Polia", "Estenda os cotovelos sem movimentar os ombros."),
  globalExercise("alongamento-flexor-quadril", "Alongamento do flexor do quadril", "mobility", "Quadril", "Peso corporal", "Mantenha a pelve neutra e avance suavemente.", "unilateral"),
  globalExercise("mobilidade-tornozelo", "Mobilidade de tornozelo", "mobility", "Tornozelo", "Peso corporal", "Leve o joelho à frente mantendo o calcanhar apoiado.", "unilateral"),
  globalExercise("rotacao-toracica", "Rotação torácica", "mobility", "Coluna torácica", "Peso corporal", "Gire com controle sem forçar a lombar.", "unilateral"),
  globalExercise("corrida", "Corrida", "running", "Cardiorrespiratório", "Rua, pista ou esteira", "Ajuste o esforço ao treino prescrito.", "not_applicable"),
  globalExercise("bike", "Ciclismo", "cycling", "Cardiorrespiratório", "Bicicleta", "Ajuste selim e resistência para pedalar sem dor.", "not_applicable"),
  globalExercise("burpee", "Burpee", "crossfit", "Corpo inteiro", "Peso corporal", "Priorize consistência e controle da aterrissagem."),
  globalExercise("box-jump", "Box jump", "crossfit", "Pernas", "Caixa", "Aterrisse de forma estável e desça com segurança."),
  globalExercise("thruster", "Thruster", "crossfit", "Corpo inteiro", "Barra ou halteres", "Integre o agachamento ao empurrar acima da cabeça."),
];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  mobility: "Alongamento",
  strength: "Musculação",
  crossfit: "CrossFit",
  running: "Corrida",
  cycling: "Bike",
  custom: "Outra atividade",
};

export const ACTIVITY_ICONS: Record<ActivityType, string> = {
  mobility: "human-handsup",
  strength: "dumbbell",
  crossfit: "weight-lifter",
  running: "run-fast",
  cycling: "bike-fast",
  custom: "star-outline",
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  mobility: "#AF52DE",
  strength: "#34C759",
  crossfit: "#FF9F0A",
  running: "#0A84FF",
  cycling: "#5AC8FA",
  custom: "#FF375F",
};
