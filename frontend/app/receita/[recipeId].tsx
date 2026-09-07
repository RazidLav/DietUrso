import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { recipeNutrients } from "../../src/nutrition/calculations";
import { createId, createRecipeIngredient, listFoodCatalog, listRecipes, saveRecipe } from "../../src/store/nutritionStore";
import { getActivePlan, upsertFood } from "../../src/store/planStore";
import { colors, radius, spacing } from "../../src/theme";
import type { Food, FoodCatalogItem, Plan, Recipe } from "../../src/types/plan";

const parse = (value: string) => Number(value.replace(",", "."));

export default function RecipeEditorScreen() {
  const { recipeId } = useLocalSearchParams<{ recipeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [foods, setFoods] = useState<FoodCatalogItem[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [picker, setPicker] = useState<"food" | "plan" | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [recipes, catalog, activePlan] = await Promise.all([listRecipes(true), listFoodCatalog(), getActivePlan()]);
    setRecipe(recipes.find((item) => item.id === recipeId) ?? null);
    setFoods(catalog);
    setPlan(activePlan);
  }, [recipeId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const nutrition = useMemo(() => recipe ? recipeNutrients(recipe) : null, [recipe]);
  const filteredFoods = useMemo(() => foods.filter((food) => !query.trim() || `${food.name} ${food.brand ?? ""}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))), [foods, query]);

  if (!recipe) return <View style={styles.loading}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.muted}>Carregando receita...</Text></View>;

  const patchRecipe = (patch: Partial<Recipe>) => setRecipe((current) => current ? { ...current, ...patch } : current);
  const addIngredient = (food: FoodCatalogItem) => {
    patchRecipe({ ingredients: [...recipe.ingredients, createRecipeIngredient(food)] });
    setPicker(null); setQuery("");
  };
  const updateIngredientQuantity = (id: string, value: string) => patchRecipe({ ingredients: recipe.ingredients.map((ingredient) => ingredient.id === id ? { ...ingredient, quantity: Math.max(0, parse(value) || 0) } : ingredient) });
  const removeIngredient = (id: string) => patchRecipe({ ingredients: recipe.ingredients.filter((ingredient) => ingredient.id !== id) });
  const save = async () => {
    setSaving(true); setMessage(null);
    try { await saveRecipe(recipe); setMessage("Receita salva."); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };
  const addToPlan = async (mealId: string, optionId: string) => {
    if (!plan || !nutrition) return;
    const food: Food = {
      id: createId(`recipe-${recipe.id}`),
      recipeId: recipe.id,
      name: recipe.name,
      quantity: 1,
      unit: "porcao",
      kcal: nutrition.perServing.kcal,
      protein: nutrition.perServing.protein,
      carbs: nutrition.perServing.carbs,
      fats: nutrition.perServing.fats,
      fiber: nutrition.perServing.fiber,
      sodium: nutrition.perServing.sodium,
      category: recipe.category,
      notes: `1 de ${recipe.servings} porções da receita`,
      substitutions: [],
    };
    await upsertFood(plan.id, mealId, optionId, food);
    setPicker(null); setMessage("Receita adicionada ao plano sem alterar o histórico.");
  };

  return (
    <View style={styles.screen} testID="recipe-editor-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><Pressable style={styles.iconBtn} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>RECEITA</Text><Text style={styles.title} numberOfLines={1}>{recipe.name}</Text></View><Pressable style={styles.saveTop} onPress={() => void save()} disabled={saving} testID="save-recipe-btn"><Text style={styles.saveTopText}>{saving ? "..." : "Salvar"}</Text></Pressable></View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Field label="Nome *" value={recipe.name} onChangeText={(name) => patchRecipe({ name })} />
        <Field label="Descrição" value={recipe.description ?? ""} onChangeText={(description) => patchRecipe({ description })} multiline />
        <View style={styles.row}><View style={{ flex: 1 }}><Field label="Categoria" value={recipe.category} onChangeText={(category) => patchRecipe({ category })} /></View><View style={{ flex: 1 }}><Field label="Número de porções *" value={String(recipe.servings)} onChangeText={(value) => patchRecipe({ servings: Math.max(0, parse(value) || 0) })} numeric /></View></View>
        <View style={styles.nutritionCard}>
          <Text style={styles.sectionLabel}>CÁLCULO AUTOMÁTICO</Text>
          <NutritionRow label="Receita inteira" value={nutrition!.total} />
          <View style={styles.divider} />
          <NutritionRow label="Por porção" value={nutrition!.perServing} accent />
        </View>
        <View style={styles.sectionHeader}><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>Ingredientes</Text><Text style={styles.muted}>Os dados ficam em snapshot: editar o alimento depois não muda esta versão.</Text></View><Pressable style={styles.smallPrimary} onPress={() => setPicker("food")} testID="add-recipe-ingredient"><MaterialDesignIcons name="plus" size={18} color={colors.onBrandPrimary} /><Text style={styles.smallPrimaryText}>Adicionar</Text></Pressable></View>
        {recipe.ingredients.map((ingredient) => <View key={ingredient.id} style={styles.ingredient}>
          <View style={{ flex: 1 }}><Text style={styles.ingredientName}>{ingredient.foodSnapshot.name}</Text><Text style={styles.muted}>{ingredient.foodSnapshot.brand || ingredient.foodSnapshot.category}</Text></View>
          <TextInput value={String(ingredient.quantity)} onChangeText={(value) => updateIngredientQuantity(ingredient.id, value)} keyboardType="decimal-pad" style={styles.qtyInput} />
          <Text style={styles.unit}>{ingredient.unit}</Text>
          <Pressable onPress={() => removeIngredient(ingredient.id)}><MaterialDesignIcons name="close" size={21} color={colors.error} /></Pressable>
        </View>)}
        {!recipe.ingredients.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>Adicione os ingredientes</Text><Text style={styles.muted}>A receita será calculada automaticamente conforme as quantidades.</Text></View> : null}
        <Field label="Modo de preparo" value={recipe.instructions ?? ""} onChangeText={(instructions) => patchRecipe({ instructions })} multiline />
        <Field label="Observações" value={recipe.notes ?? ""} onChangeText={(notes) => patchRecipe({ notes })} multiline />
        {message ? <Text style={[styles.message, message.includes("salva") || message.includes("adicionada") ? styles.success : styles.error]}>{message}</Text> : null}
        <View style={styles.bottomActions}><Pressable style={styles.secondaryBtn} onPress={() => setPicker("plan")} disabled={!plan || !recipe.ingredients.length}><MaterialDesignIcons name="calendar-plus" size={18} color={colors.onSurface} /><Text style={styles.secondaryText}>Adicionar ao plano</Text></Pressable><Pressable style={styles.primaryBtn} onPress={() => router.push(`/fora-do-plano?recipeId=${recipe.id}`)} disabled={!recipe.ingredients.length}><MaterialDesignIcons name="silverware" size={18} color={colors.onBrandPrimary} /><Text style={styles.primaryText}>Registrar consumo</Text></Pressable></View>
      </ScrollView>

      <PickerModal visible={picker === "food"} title="Adicionar ingrediente" onClose={() => setPicker(null)}>
        <View style={styles.searchWrap}><MaterialDesignIcons name="magnify" size={19} color={colors.onSurfaceTertiary} /><TextInput value={query} onChangeText={setQuery} placeholder="Pesquisar alimento" placeholderTextColor={colors.onSurfaceTertiary} style={styles.search} /></View>
        {filteredFoods.map((food) => <Pressable key={food.id} style={styles.pickRow} onPress={() => addIngredient(food)}><View style={{ flex: 1 }}><Text style={styles.ingredientName}>{food.name}</Text><Text style={styles.muted}>{food.referenceQuantity} {food.referenceUnit} · {Math.round(food.nutrients.kcal)} kcal</Text></View><MaterialDesignIcons name="plus-circle" size={23} color={colors.brandPrimary} /></Pressable>)}
      </PickerModal>
      <PickerModal visible={picker === "plan"} title="Adicionar ao plano ativo" onClose={() => setPicker(null)}>
        {(plan?.meals ?? []).filter((meal) => !meal.archived).map((meal) => <View key={meal.id}><Text style={styles.pickMeal}>{meal.name}</Text>{meal.options.map((option) => <Pressable key={option.id} style={styles.pickRow} onPress={() => void addToPlan(meal.id, option.id)}><Text style={[styles.ingredientName, { flex: 1 }]}>{option.name}</Text><MaterialDesignIcons name="plus-circle" size={23} color={colors.brandPrimary} /></Pressable>)}</View>)}
        {!plan ? <Text style={styles.muted}>Nenhum plano ativo.</Text> : null}
      </PickerModal>
    </View>
  );
}

function PickerModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) { return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onClose}><MaterialDesignIcons name="close" size={24} color={colors.onSurface} /></Pressable></View><ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}>{children}</ScrollView></View></View></Modal>; }
function Field({ label, value, onChangeText, multiline, numeric }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; numeric?: boolean }) { return <View><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} keyboardType={numeric ? "decimal-pad" : "default"} style={[styles.input, multiline && { minHeight: 82, textAlignVertical: "top" }]} /></View>; }
function NutritionRow({ label, value, accent }: { label: string; value: ReturnType<typeof recipeNutrients>["total"]; accent?: boolean }) { return <View><Text style={[styles.nutritionLabel, accent && { color: colors.brandPrimary }]}>{label}</Text><Text style={styles.nutritionValue}>{Math.round(value.kcal)} kcal · P {value.protein.toFixed(1)}g · C {value.carbs.toFixed(1)}g · G {value.fats.toFixed(1)}g · Fibras {value.fiber.toFixed(1)}g</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.md }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" }, saveTop: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, saveTopText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  label: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700", marginBottom: 6 }, input: { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md }, row: { flexDirection: "row", gap: spacing.sm }, nutritionCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }, sectionLabel: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, nutritionLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" }, nutritionValue: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginTop: 4 }, divider: { height: 1, backgroundColor: colors.border },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm }, sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" }, muted: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16 }, smallPrimary: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, smallPrimaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "800" },
  ingredient: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, ingredientName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" }, qtyInput: { width: 72, color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, padding: spacing.sm, textAlign: "right" }, unit: { color: colors.onSurfaceTertiary, fontSize: 12, minWidth: 28 }, empty: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, message: { fontSize: 12, fontWeight: "700" }, success: { color: colors.success }, error: { color: colors.error },
  bottomActions: { flexDirection: "row", gap: spacing.sm }, secondaryBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }, secondaryText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" }, primaryBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md }, primaryText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" }, modal: { maxHeight: "82%", width: "100%", maxWidth: 720, alignSelf: "center", backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }, modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" }, searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm }, search: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md }, pickRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, pickMeal: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.sm },
});
