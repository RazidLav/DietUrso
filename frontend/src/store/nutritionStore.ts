import AsyncStorage from "@react-native-async-storage/async-storage";
import { markLocalChange } from "../cloud/cloudSync";
import { scaleNutrients, normalizeNutrients, validPositive } from "../nutrition/calculations";
import type { Food, FoodCatalogItem, Plan, Recipe, RecipeIngredient, Unit } from "../types/plan";
import { categorizeFood } from "../utils/categories";
import {
  FOOD_LIBRARY_KEY,
  NUTRITION_SEED_KEY,
  PLANS_KEY,
  RECIPES_KEY,
  SHOPPING_CONFIG_KEY,
} from "./storageKeys";

export interface ManualShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: string;
  checked: boolean;
}

export interface ShoppingConfig {
  periodDays: number;
  preferredSubstitutions: Record<string, string>;
  quantityOverrides: Record<string, number>;
  manualItems: ManualShoppingItem[];
}

const EMPTY_SHOPPING_CONFIG: ShoppingConfig = {
  periodDays: 7,
  preferredSubstitutions: {},
  quantityOverrides: {},
  manualItems: [],
};

export const createId = (prefix = "item") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  await markLocalChange();
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function slug(value: string) {
  return normalizeName(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function catalogFromPlanFood(food: Food): FoodCatalogItem | null {
  const quantity = validPositive(food.quantity);
  if (!quantity || !food.name.trim()) return null;
  const referenceQuantity = food.unit === "g" || food.unit === "ml" ? 100 : 1;
  const now = new Date().toISOString();
  const sourceNutrients = normalizeNutrients({
    kcal: food.kcal ?? 0,
    protein: food.protein ?? 0,
    carbs: food.carbs ?? 0,
    fats: food.fats ?? 0,
    fiber: food.fiber ?? 0,
    sodium: food.sodium ?? 0,
  });
  return {
    id: `global-${slug(food.name)}-${food.unit}`,
    name: food.name.trim(),
    brand: food.brand,
    category: food.category ?? categorizeFood(food.name),
    referenceQuantity,
    referenceUnit: food.unit,
    nutrients: scaleNutrients(sourceNutrients, quantity, referenceQuantity),
    notes: food.notes,
    source: "Plano original do DietUrso",
    scope: "global",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
}

export async function ensureNutritionSeed(): Promise<void> {
  if (await AsyncStorage.getItem(NUTRITION_SEED_KEY)) return;
  const plans = await readJson<Plan[]>(PLANS_KEY, []);
  const items = new Map<string, FoodCatalogItem>();
  plans.forEach((plan) =>
    plan.meals.forEach((meal) =>
      meal.options.forEach((option) =>
        option.foods.forEach((food) => {
          const item = catalogFromPlanFood(food);
          if (item && !items.has(item.id)) items.set(item.id, item);
        })
      )
    )
  );
  await AsyncStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(Array.from(items.values())));
  await AsyncStorage.setItem(RECIPES_KEY, JSON.stringify([]));
  await AsyncStorage.setItem(SHOPPING_CONFIG_KEY, JSON.stringify(EMPTY_SHOPPING_CONFIG));
  await AsyncStorage.setItem(NUTRITION_SEED_KEY, "1");
}

export async function listFoodCatalog(includeArchived = false): Promise<FoodCatalogItem[]> {
  await ensureNutritionSeed();
  const items = await readJson<FoodCatalogItem[]>(FOOD_LIBRARY_KEY, []);
  return items
    .filter((item) => includeArchived || !item.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function saveFoodCatalog(items: FoodCatalogItem[]) {
  await writeJson(FOOD_LIBRARY_KEY, items);
}

export async function createPersonalFood(
  input: Omit<FoodCatalogItem, "id" | "scope" | "archived" | "createdAt" | "updatedAt">
): Promise<FoodCatalogItem> {
  const quantity = validPositive(input.referenceQuantity);
  if (!input.name.trim() || !quantity) throw new Error("Informe nome e quantidade de referência válida.");
  const now = new Date().toISOString();
  const item: FoodCatalogItem = {
    ...input,
    id: createId("food"),
    name: input.name.trim(),
    referenceQuantity: quantity,
    nutrients: normalizeNutrients(input.nutrients),
    scope: "personal",
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  const items = await listFoodCatalog(true);
  items.push(item);
  await saveFoodCatalog(items);
  return item;
}

export async function updatePersonalFood(updated: FoodCatalogItem): Promise<void> {
  if (updated.scope !== "personal") throw new Error("Alimentos globais devem ser duplicados antes da edição.");
  const quantity = validPositive(updated.referenceQuantity);
  if (!updated.name.trim() || !quantity) throw new Error("Informe nome e quantidade de referência válida.");
  const items = await listFoodCatalog(true);
  const index = items.findIndex((item) => item.id === updated.id);
  if (index < 0) throw new Error("Alimento não encontrado.");
  items[index] = {
    ...updated,
    name: updated.name.trim(),
    referenceQuantity: quantity,
    nutrients: normalizeNutrients(updated.nutrients),
    updatedAt: new Date().toISOString(),
  };
  await saveFoodCatalog(items);
}

export async function duplicateFood(id: string, ownerId?: string): Promise<FoodCatalogItem> {
  const source = (await listFoodCatalog(true)).find((item) => item.id === id);
  if (!source) throw new Error("Alimento não encontrado.");
  return createPersonalFood({
    name: `${source.name} — cópia`,
    brand: source.brand,
    category: source.category,
    referenceQuantity: source.referenceQuantity,
    referenceUnit: source.referenceUnit,
    nutrients: source.nutrients,
    notes: source.notes,
    source: source.source,
    ownerId: ownerId ?? source.ownerId,
  });
}

export async function setFoodArchived(id: string, archived: boolean): Promise<void> {
  const items = await listFoodCatalog(true);
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error("Alimento não encontrado.");
  if (item.scope === "global") throw new Error("O catálogo global é somente leitura.");
  item.archived = archived;
  item.updatedAt = new Date().toISOString();
  await saveFoodCatalog(items);
}

export async function listRecipes(includeArchived = false): Promise<Recipe[]> {
  await ensureNutritionSeed();
  const recipes = await readJson<Recipe[]>(RECIPES_KEY, []);
  return recipes
    .filter((recipe) => includeArchived || !recipe.archived)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  if (!recipe.name.trim()) throw new Error("Informe o nome da receita.");
  if (!validPositive(recipe.servings)) throw new Error("O número de porções deve ser maior que zero.");
  const recipes = await listRecipes(true);
  const index = recipes.findIndex((candidate) => candidate.id === recipe.id);
  const now = new Date().toISOString();
  const next = { ...recipe, name: recipe.name.trim(), updatedAt: now };
  if (index >= 0) recipes[index] = next;
  else recipes.push({ ...next, createdAt: recipe.createdAt || now });
  await writeJson(RECIPES_KEY, recipes);
}

export async function createRecipe(name = "Nova receita", ownerId?: string): Promise<Recipe> {
  const now = new Date().toISOString();
  const recipe: Recipe = {
    id: createId("recipe"),
    name,
    description: "",
    ingredients: [],
    instructions: "",
    servings: 1,
    notes: "",
    category: "Outros",
    ownerId,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await saveRecipe(recipe);
  return recipe;
}

export async function duplicateRecipe(id: string, ownerId?: string): Promise<Recipe> {
  const source = (await listRecipes(true)).find((recipe) => recipe.id === id);
  if (!source) throw new Error("Receita não encontrada.");
  const now = new Date().toISOString();
  const recipe: Recipe = {
    ...source,
    id: createId("recipe"),
    name: `${source.name} — cópia`,
    ownerId: ownerId ?? source.ownerId,
    ingredients: source.ingredients.map((ingredient) => ({
      ...ingredient,
      id: createId("ingredient"),
      foodSnapshot: { ...ingredient.foodSnapshot, nutrients: { ...ingredient.foodSnapshot.nutrients } },
    })),
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await saveRecipe(recipe);
  return recipe;
}

export async function setRecipeArchived(id: string, archived: boolean): Promise<void> {
  const recipes = await listRecipes(true);
  const recipe = recipes.find((candidate) => candidate.id === id);
  if (!recipe) throw new Error("Receita não encontrada.");
  recipe.archived = archived;
  recipe.updatedAt = new Date().toISOString();
  await writeJson(RECIPES_KEY, recipes);
}

export function createRecipeIngredient(food: FoodCatalogItem, quantity = food.referenceQuantity): RecipeIngredient {
  return {
    id: createId("ingredient"),
    foodId: food.id,
    foodSnapshot: { ...food, nutrients: { ...food.nutrients } },
    quantity,
    unit: food.referenceUnit,
  };
}

export async function getShoppingConfig(): Promise<ShoppingConfig> {
  await ensureNutritionSeed();
  const stored = await readJson<ShoppingConfig>(SHOPPING_CONFIG_KEY, EMPTY_SHOPPING_CONFIG);
  const storedPeriod = Number(stored.periodDays);
  return {
    periodDays: Number.isInteger(storedPeriod) && storedPeriod >= 1 && storedPeriod <= 60 ? storedPeriod : 7,
    preferredSubstitutions: stored.preferredSubstitutions ?? {},
    quantityOverrides: stored.quantityOverrides ?? {},
    manualItems: Array.isArray(stored.manualItems) ? stored.manualItems : [],
  };
}

export async function saveShoppingConfig(config: ShoppingConfig): Promise<void> {
  await writeJson(SHOPPING_CONFIG_KEY, config);
}

export async function readNutritionSnapshot() {
  const [foodLibrary, recipes, shoppingConfig] = await Promise.all([
    listFoodCatalog(true),
    listRecipes(true),
    getShoppingConfig(),
  ]);
  return { foodLibrary, recipes, shoppingConfig };
}

export async function applyNutritionSnapshot(snapshot: {
  foodLibrary?: FoodCatalogItem[];
  recipes?: Recipe[];
  shoppingConfig?: ShoppingConfig;
}) {
  await Promise.all([
    AsyncStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(snapshot.foodLibrary ?? [])),
    AsyncStorage.setItem(RECIPES_KEY, JSON.stringify(snapshot.recipes ?? [])),
    AsyncStorage.setItem(SHOPPING_CONFIG_KEY, JSON.stringify(snapshot.shoppingConfig ?? EMPTY_SHOPPING_CONFIG)),
    AsyncStorage.setItem(NUTRITION_SEED_KEY, "1"),
  ]);
}
