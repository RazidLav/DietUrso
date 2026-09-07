export type Unit = "g" | "ml" | "un" | "porcao";

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  sodium: number;
}

export interface FoodCatalogItem {
  id: string;
  name: string;
  brand?: string;
  category: string;
  referenceQuantity: number;
  referenceUnit: Unit;
  nutrients: Nutrients;
  notes?: string;
  source?: string;
  scope: "global" | "personal";
  ownerId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  id: string;
  foodId: string;
  foodSnapshot: FoodCatalogItem;
  quantity: number;
  unit: Unit;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  ingredients: RecipeIngredient[];
  instructions?: string;
  servings: number;
  yieldQuantity?: number;
  yieldUnit?: Unit;
  notes?: string;
  category: string;
  ownerId?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Substitution {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fats: number | null;
  fiber?: number | null;
  sodium?: number | null;
  foodId?: string;
  recipeId?: string;
  notes?: string;
  rule?: string;
  order?: number;
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
  fiber?: number | null;
  sodium?: number | null;
  foodId?: string;
  recipeId?: string;
  referenceQuantity?: number;
  referenceUnit?: Unit;
  category?: string;
  brand?: string;
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
  archived?: boolean;
  options: MealOption[];
  suggestedTime?: string;
  guidance?: string;
  daysOfWeek?: number[];
  order?: number;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  createdAt: string;
  updatedAt?: string;
  meals: Meal[];
}

export interface ConsumedItemSnapshot {
  id: string;
  kind: "food" | "recipe";
  sourceId?: string;
  name: string;
  quantity: number;
  unit: Unit;
  nutrients: Nutrients;
  originalItemName?: string;
  substitutionId?: string;
  isExtra?: boolean;
}

export interface PlannedMealSnapshot {
  planId: string;
  planName: string;
  mealId: string;
  mealName: string;
  mealType: string;
  suggestedTime?: string;
  optionId?: string;
  optionName?: string;
  items: ConsumedItemSnapshot[];
  nutrients: Nutrients;
}

// Consumption log entry (separate from plan)
export interface ConsumptionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mealId: string; // which meal type
  status: "as_planned" | "modified" | "skipped" | "off_plan";
  chosenOptionId?: string;
  // For modified: user notes and manual macros
  note?: string;
  manualKcal?: number;
  manualProtein?: number;
  manualCarbs?: number;
  manualFats?: number;
  foodNames?: string[];
  isFreeMeal?: boolean;
  mealName?: string;
  mealType?: string;
  actualAt?: string;
  location?: string;
  context?: string;
  consumedItems?: ConsumedItemSnapshot[];
  plannedSnapshot?: PlannedMealSnapshot;
  plannedDayNutrients?: Nutrients;
  plannedMealCount?: number;
  createdAt: string;
  updatedAt?: string;
}
