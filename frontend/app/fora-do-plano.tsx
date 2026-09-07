import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addNutrients, catalogItemNutrients, recipeNutrients, scaleNutrients } from "../src/nutrition/calculations";
import { createPlannedDaySnapshot } from "../src/nutrition/records";
import { createId, listFoodCatalog, listRecipes } from "../src/store/nutritionStore";
import { addConsumption, getActivePlan, listConsumption, upsertConsumption } from "../src/store/planStore";
import { colors, radius, spacing } from "../src/theme";
import type { ConsumedItemSnapshot, ConsumptionEntry, FoodCatalogItem, Recipe } from "../src/types/plan";
import { todayISO } from "../src/utils/date";

const timeNow = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
const parse = (value: string) => Number(value.replace(",", "."));

export default function OffPlanScreen() {
  const { recipeId, entryId, date: dateParam } = useLocalSearchParams<{ recipeId?: string; entryId?: string; date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [foods, setFoods] = useState<FoodCatalogItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [existing, setExisting] = useState<ConsumptionEntry | null>(null);
  const [name, setName] = useState("Refeição fora do plano");
  const [date, setDate] = useState(dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayISO());
  const [time, setTime] = useState(timeNow());
  const [type, setType] = useState("custom");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("");
  const [context, setContext] = useState("");
  const [items, setItems] = useState<ConsumedItemSnapshot[]>([]);
  const [picker, setPicker] = useState(false);
  const [pickerType, setPickerType] = useState<"food" | "recipe">("food");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([listFoodCatalog(), listRecipes(), listConsumption()]).then(([catalog, savedRecipes, entries]) => {
      setFoods(catalog); setRecipes(savedRecipes);
      const entry = entryId ? entries.find((candidate) => candidate.id === entryId && candidate.status === "off_plan") ?? null : null;
      if (entry) {
        setExisting(entry); setName(entry.mealName ?? "Refeição fora do plano"); setDate(entry.date); setType(entry.mealType ?? "custom");
        setNotes(entry.note ?? ""); setLocation(entry.location ?? ""); setContext(entry.context ?? ""); setItems(entry.consumedItems ?? []);
        if (entry.actualAt) setTime(new Date(entry.actualAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }));
      } else if (recipeId) {
        const recipe = savedRecipes.find((candidate) => candidate.id === recipeId);
        if (recipe) { setName(recipe.name); setItems([recipeItem(recipe)]); }
      }
    });
  }, [entryId, recipeId]);

  const totals = useMemo(() => addNutrients(...items.map((item) => item.nutrients)), [items]);
  const filteredFoods = foods.filter((food) => !query.trim() || food.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const filteredRecipes = recipes.filter((recipe) => !query.trim() || recipe.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));

  const addFood = (food: FoodCatalogItem) => {
    setItems((current) => [...current, {
      id: createId("consumed"), kind: "food", sourceId: food.id, name: food.name,
      quantity: food.referenceQuantity, unit: food.referenceUnit,
      nutrients: catalogItemNutrients(food, food.referenceQuantity, food.referenceUnit), isExtra: true,
    }]); setPicker(false); setQuery("");
  };
  const addRecipe = (recipe: Recipe) => { setItems((current) => [...current, recipeItem(recipe)]); setPicker(false); setQuery(""); };
  const changeQuantity = (item: ConsumedItemSnapshot, value: string) => {
    const nextQuantity = Math.max(0, parse(value) || 0);
    setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, quantity: nextQuantity, nutrients: scaleNutrients(candidate.nutrients, candidate.quantity || 1, nextQuantity) } : candidate));
  };
  const save = async () => {
    if (!name.trim() || !items.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Informe nome, data válida e ao menos um item."); return; }
    setSaving(true); setError(null);
    try {
      const actualAt = new Date(`${date}T${/^\d{2}:\d{2}$/.test(time) ? time : "12:00"}:00`).toISOString();
      const activePlan = existing ? null : await getActivePlan();
      const plannedDay = activePlan ? createPlannedDaySnapshot(activePlan, date) : null;
      const payload = {
        date, mealId: existing?.mealId ?? `off-plan-${createId("meal")}`, status: "off_plan" as const,
        mealName: name.trim(), mealType: type, note: notes.trim() || undefined, actualAt,
        location: location.trim() || undefined, context: context.trim() || undefined, isFreeMeal: true,
        consumedItems: items, foodNames: items.map((item) => item.name),
        manualKcal: totals.kcal, manualProtein: totals.protein, manualCarbs: totals.carbs, manualFats: totals.fats,
        plannedDayNutrients: existing?.plannedDayNutrients ?? plannedDay?.nutrients,
        plannedMealCount: existing?.plannedMealCount ?? plannedDay?.mealCount,
      };
      if (existing) await upsertConsumption({ ...existing, ...payload });
      else await addConsumption(payload);
      router.replace(`/historico-alimentar?date=${date}`);
    } catch { setError("Não foi possível salvar agora. Seus outros dados continuam seguros."); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.screen} testID="off-plan-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><Pressable style={styles.iconBtn} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>VIDA REAL</Text><Text style={styles.title}>{existing ? "Editar registro" : "Fora do plano"}</Text></View></View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <View style={styles.kindness}><MaterialDesignIcons name="heart-outline" size={22} color={colors.brandTertiary} /><Text style={styles.kindnessText}>Uma refeição diferente não apaga seu progresso. Registrar ajuda você a seguir com clareza na próxima.</Text></View>
        <Field label="Nome da refeição *" value={name} onChangeText={setName} />
        <View style={styles.row}><View style={{ flex: 1 }}><Field label="Data (AAAA-MM-DD) *" value={date} onChangeText={setDate} /></View><View style={{ width: 105 }}><Field label="Horário" value={time} onChangeText={setTime} /></View></View>
        <Text style={styles.label}>Tipo</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{[["cafe", "Café"], ["almoco", "Almoço"], ["lanche", "Lanche"], ["jantar", "Jantar"], ["ceia", "Ceia"], ["custom", "Outro"]].map(([value, label]) => <Pressable key={value} onPress={() => setType(value)} style={[styles.chip, type === value && styles.chipOn]}><Text style={[styles.chipText, type === value && styles.chipTextOn]}>{label}</Text></Pressable>)}</ScrollView>
        <View style={styles.totalCard}><Text style={styles.totalLabel}>TOTAL CONSUMIDO</Text><Text style={styles.totalKcal}>{Math.round(totals.kcal)} <Text style={styles.totalUnit}>kcal</Text></Text><Text style={styles.totalMacros}>P {totals.protein.toFixed(1)}g  ·  C {totals.carbs.toFixed(1)}g  ·  G {totals.fats.toFixed(1)}g  ·  Fibras {totals.fiber.toFixed(1)}g</Text></View>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Itens consumidos</Text><Pressable style={styles.addBtn} onPress={() => setPicker(true)} testID="off-plan-add-item"><MaterialDesignIcons name="plus" size={18} color={colors.onBrandPrimary} /><Text style={styles.addText}>Adicionar</Text></Pressable></View>
        {items.map((item) => <View key={item.id} style={styles.itemRow}><View style={{ flex: 1 }}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.muted}>{Math.round(item.nutrients.kcal)} kcal · {item.kind === "recipe" ? "receita" : "alimento"}</Text></View><TextInput value={String(item.quantity)} onChangeText={(value) => changeQuantity(item, value)} keyboardType="decimal-pad" style={styles.qty} /><Text style={styles.unit}>{item.unit}</Text><Pressable onPress={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}><MaterialDesignIcons name="close" size={21} color={colors.error} /></Pressable></View>)}
        {!items.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>O que você consumiu?</Text><Text style={styles.muted}>Adicione alimentos ou receitas para calcular o total.</Text></View> : null}
        <Field label="Observações" value={notes} onChangeText={setNotes} multiline />
        <View style={styles.row}><View style={{ flex: 1 }}><Field label="Local (opcional)" value={location} onChangeText={setLocation} /></View><View style={{ flex: 1 }}><Field label="Contexto (opcional)" value={context} onChangeText={setContext} /></View></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving} testID="save-off-plan"><Text style={styles.saveText}>{saving ? "Salvando..." : "Salvar no diário"}</Text></Pressable>
      </ScrollView>

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Adicionar item</Text><Pressable onPress={() => setPicker(false)}><MaterialDesignIcons name="close" size={24} color={colors.onSurface} /></Pressable></View><View style={styles.pickerTabs}><Pressable onPress={() => setPickerType("food")} style={[styles.chip, pickerType === "food" && styles.chipOn]}><Text style={[styles.chipText, pickerType === "food" && styles.chipTextOn]}>Alimentos</Text></Pressable><Pressable onPress={() => setPickerType("recipe")} style={[styles.chip, pickerType === "recipe" && styles.chipOn]}><Text style={[styles.chipText, pickerType === "recipe" && styles.chipTextOn]}>Receitas</Text></Pressable></View><View style={styles.searchWrap}><MaterialDesignIcons name="magnify" size={19} color={colors.onSurfaceTertiary} /><TextInput value={query} onChangeText={setQuery} placeholder="Pesquisar" placeholderTextColor={colors.onSurfaceTertiary} style={styles.search} /></View><ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}>{pickerType === "food" ? filteredFoods.map((food) => <Pressable key={food.id} style={styles.pick} onPress={() => addFood(food)}><View style={{ flex: 1 }}><Text style={styles.itemName}>{food.name}</Text><Text style={styles.muted}>{food.referenceQuantity} {food.referenceUnit} · {Math.round(food.nutrients.kcal)} kcal</Text></View><MaterialDesignIcons name="plus-circle" size={23} color={colors.brandPrimary} /></Pressable>) : filteredRecipes.map((recipe) => { const nutrition = recipeNutrients(recipe); return <Pressable key={recipe.id} style={styles.pick} onPress={() => addRecipe(recipe)}><View style={{ flex: 1 }}><Text style={styles.itemName}>{recipe.name}</Text><Text style={styles.muted}>1 porção · {Math.round(nutrition.perServing.kcal)} kcal</Text></View><MaterialDesignIcons name="plus-circle" size={23} color={colors.brandPrimary} /></Pressable>; })}</ScrollView></View></View></Modal>
    </View>
  );
}

function recipeItem(recipe: Recipe): ConsumedItemSnapshot { const nutrition = recipeNutrients(recipe); return { id: createId("consumed"), kind: "recipe", sourceId: recipe.id, name: recipe.name, quantity: 1, unit: "porcao", nutrients: nutrition.perServing, isExtra: true }; }
function Field({ label, value, onChangeText, multiline }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean }) { return <View><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && { minHeight: 76, textAlignVertical: "top" }]} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.onSurface, fontSize: 21, fontWeight: "800" },
  kindness: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.brandTertiary + "18", borderWidth: 1, borderColor: colors.brandTertiary + "55", borderRadius: radius.lg, padding: spacing.lg }, kindnessText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 }, label: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700", marginBottom: 6 }, input: { color: colors.onSurface, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md }, row: { flexDirection: "row", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, chipOn: { backgroundColor: colors.brandPrimary }, chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" }, chipTextOn: { color: colors.onBrandPrimary }, totalCard: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }, totalLabel: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, totalKcal: { color: colors.onSurface, fontSize: 34, fontWeight: "800", marginTop: 4 }, totalUnit: { fontSize: 14, color: colors.onSurfaceTertiary }, totalMacros: { color: colors.onSurfaceSecondary, fontSize: 11, marginTop: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm }, sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" }, addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, addText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "800" }, itemRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }, itemName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" }, muted: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16 }, qty: { width: 68, color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, padding: spacing.sm, textAlign: "right" }, unit: { color: colors.onSurfaceTertiary, fontSize: 11 }, empty: { alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, error: { color: colors.error, fontSize: 12 }, saveBtn: { alignItems: "center", backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.lg }, saveText: { color: colors.onBrandPrimary, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" }, modal: { maxHeight: "80%", width: "100%", maxWidth: 720, alignSelf: "center", backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" }, pickerTabs: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md }, searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md }, search: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md }, pick: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md },
});
