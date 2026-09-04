export type Unit = "g" | "ml" | "un";

export interface Substitution {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
}

export interface Food {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  notes?: string;
  substitutions: Substitution[];
}

export interface MealOption {
  id: string;
  name: string;
  approxKcal?: number;
  notes?: string;
  foods: Food[];
}

export interface Meal {
  id: string;
  type: string; // pre_treino | cafe | almoco | lanche | jantar | ceia | pos_treino | custom
  name: string;
  options: MealOption[];
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  createdAt: string;
  meals: Meal[];
}

// Consumption log entry (separate from plan)
export interface ConsumptionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealId: string; // which meal type
  status: "as_planned" | "modified";
  chosenOptionId?: string;
  // For modified: user notes and manual macros
  note?: string;
  manualKcal?: number;
  manualProtein?: number;
  manualCarbs?: number;
  manualFats?: number;
  foodNames?: string[];
  isFreeMeal?: boolean;
  createdAt: string;
}
