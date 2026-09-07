import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../../src/theme";
import MacroSummary from "../../../src/components/MacroSummary";
import {
  addConsumption,
  getActivePlan,
  getChosenOption,
  listConsumption,
  optionMacros,
  removeConsumptionForDayMeal,
  setChosenOption,
} from "../../../src/store/planStore";
import { todayISO } from "../../../src/utils/date";
import type { ConsumptionEntry, Food, FoodCatalogItem, Meal, MealOption, Plan } from "../../../src/types/plan";
import { createPlanConsumption, resolvePlanFood } from "../../../src/nutrition/records";
import { listFoodCatalog } from "../../../src/store/nutritionStore";

export default function MealDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mealId, date: dateParam } = useLocalSearchParams<{
    planId: string;
    mealId: string;
    date?: string;
  }>();
  const date = dateParam ?? todayISO();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  // per-food substitution overrides (foodId -> subId or "original")
  const [subs, setSubs] = useState<Record<string, string>>({});
  const [entry, setEntry] = useState<ConsumptionEntry | null>(null);
  const [catalog, setCatalog] = useState<FoodCatalogItem[]>([]);

  // Modify modal state
  const [showModify, setShowModify] = useState(false);
  const [modNote, setModNote] = useState("");
  const [modFreeMeal, setModFreeMeal] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [actualTime, setActualTime] = useState("");

  const load = useCallback(async () => {
    const [p, foodCatalog] = await Promise.all([getActivePlan(), listFoodCatalog()]);
    setPlan(p);
    setCatalog(foodCatalog);
    if (!p) return;
    const meal = p.meals.find((m) => m.id === mealId);
    if (!meal) return;
    const chosen = await getChosenOption(date, mealId as string);
    setOptionId(chosen ?? meal.options[0]?.id ?? null);
    const all = await listConsumption();
    setEntry(all.find((e) => e.date === date && e.mealId === mealId) ?? null);
    setSubs({});
  }, [mealId, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const meal: Meal | undefined = plan?.meals.find((m) => m.id === mealId);
  const currentOption: MealOption | undefined = meal?.options.find((o) => o.id === optionId);

  const effectiveFoods = currentOption?.foods.map((f) => {
        return resolvePlanFood(f, subs[f.id], catalog);
      }) ?? [];

  const macros = (() => {
    if (!currentOption) return { kcal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 };
    const patched: MealOption = { ...currentOption, foods: effectiveFoods };
    return optionMacros(patched);
  })();

  const handleChooseOption = async (oid: string) => {
    setOptionId(oid);
    setSubs({});
    await setChosenOption(date, mealId as string, oid);
  };

  const handleAsPlanned = async () => {
    if (!optionId) return;
    await removeConsumptionForDayMeal(date, mealId as string);
    if (plan && meal && currentOption) await addConsumption(createPlanConsumption({
      plan,
      meal,
      option: currentOption,
      date,
      substitutions: subs,
      catalog,
    }));
    router.back();
  };

  const openModify = () => {
    setModNote(entry?.note ?? "");
    setModFreeMeal(Boolean(entry?.isFreeMeal));
    const nextQuantities: Record<string, string> = {};
    currentOption?.foods.forEach((food, index) => {
      nextQuantities[food.id] = String(entry?.consumedItems?.[index]?.quantity ?? effectiveFoods[index]?.quantity ?? food.quantity);
    });
    setQuantities(nextQuantities);
    setActualTime(entry?.actualAt ? new Date(entry.actualAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }) : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }));
    setShowModify(true);
  };

  const handleSubmitModify = async () => {
    if (!optionId) return;
    await removeConsumptionForDayMeal(date, mealId as string);
    if (plan && meal && currentOption) await addConsumption(createPlanConsumption({
      plan,
      meal,
      option: currentOption,
      date,
      substitutions: subs,
      catalog,
      quantities: Object.fromEntries(Object.entries(quantities).map(([key, value]) => [key, Math.max(0, Number(value.replace(",", ".")) || 0)])),
      note: modNote,
      actualAt: new Date(`${date}T${/^\d{2}:\d{2}$/.test(actualTime) ? actualTime : "12:00"}:00`).toISOString(),
      isFreeMeal: modFreeMeal,
    }));
    setShowModify(false);
    router.back();
  };

  const handleSkipped = async () => {
    if (!plan || !meal || !currentOption) return;
    await removeConsumptionForDayMeal(date, meal.id);
    const snapshot = createPlanConsumption({ plan, meal, option: currentOption, date });
    await addConsumption({ ...snapshot, status: "skipped", consumedItems: [], foodNames: [] });
    router.back();
  };

  const handleClearLog = async () => {
    await removeConsumptionForDayMeal(date, mealId as string);
    await load();
  };

  if (!plan || !meal) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.emptyText}>Refeição não encontrada.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="meal-detail-screen">
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
            <MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>REFEIÇÃO</Text>
            <Text style={styles.title} numberOfLines={1}>{meal.name}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200, gap: spacing.lg }}>
        {/* Options selector */}
        {meal.options.length > 1 ? (
          <View>
            <Text style={styles.sectionTitle}>Opções</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56 }} contentContainerStyle={{ gap: spacing.sm, alignItems: "center" }}>
              {meal.options.map((o, i) => {
                const sel = o.id === optionId;
                return (
                  <Pressable
                    key={o.id}
                    style={[styles.optChip, sel && styles.optChipSelected]}
                    onPress={() => handleChooseOption(o.id)}
                    testID={`option-chip-${i}`}
                  >
                    <Text style={[styles.optChipText, sel && styles.optChipTextSelected]}>
                      Opção {i + 1}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {currentOption ? (
          <>
            <View style={styles.optHeader}>
              <Text style={styles.optName}>{currentOption.name}</Text>
              {currentOption.notes ? <Text style={styles.optNotes}>{currentOption.notes}</Text> : null}
            </View>

            <MacroSummary
              kcal={macros.kcal}
              protein={macros.protein}
              carbs={macros.carbs}
              fats={macros.fats}
              fiber={macros.fiber}
            />

            <Text style={styles.sectionTitle}>Ingredientes</Text>
            <View style={{ gap: spacing.sm }}>
              {currentOption.foods.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  currentSub={subs[food.id]}
                  catalog={catalog}
                  onChangeSub={(v) => setSubs((prev) => ({ ...prev, [food.id]: v }))}
                />
              ))}
            </View>

            {entry ? (
              <View
                style={[
                  styles.statusBox,
                  { borderColor: entry.status === "as_planned" ? colors.brandPrimary : entry.status === "skipped" ? colors.borderStrong : colors.warning },
                ]}
              >
                <MaterialDesignIcons
                  name={entry.status === "as_planned" ? "check-circle" : entry.status === "skipped" ? "minus-circle" : "pencil-circle"}
                  size={22}
                  color={entry.status === "as_planned" ? colors.brandPrimary : entry.status === "skipped" ? colors.onSurfaceTertiary : colors.warning}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>
                    {entry.status === "as_planned" ? "Consumido conforme o plano" : entry.status === "skipped" ? "Refeição não realizada" : "Consumo com alteração"}
                  </Text>
                  {entry.note ? <Text style={styles.statusNote}>{entry.note}</Text> : null}
                  {entry.status === "modified" ? (
                    <Text style={styles.statusNote}>
                      {entry.manualKcal} kcal · P {entry.manualProtein}g · C {entry.manualCarbs}g · G {entry.manualFats}g
                    </Text>
                  ) : null}
                </View>
                <Pressable onPress={handleClearLog} testID="clear-log-btn">
                  <MaterialDesignIcons name="close" size={20} color={colors.onSurfaceTertiary} />
                </Pressable>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyText}>Nenhuma opção. Edite o plano para adicionar.</Text>
        )}
      </ScrollView>

      {/* Sticky bottom CTA */}
      {currentOption ? (
        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm },
          ]}
        >
          <Pressable style={styles.ctaSecondary} onPress={openModify} testID="cta-modify-btn">
            <MaterialDesignIcons name="pencil" size={18} color={colors.onSurface} />
            <Text style={styles.ctaSecondaryText}>Registrar alteração</Text>
          </Pressable>
          <Pressable style={styles.ctaPrimary} onPress={handleAsPlanned} testID="cta-as-planned-btn">
            <MaterialDesignIcons name="check" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.ctaPrimaryText}>Comi conforme o plano</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={handleSkipped} testID="cta-skipped-btn">
            <Text style={styles.skipButtonText}>Não realizei esta refeição</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Modify modal */}
      <Modal visible={showModify} transparent animationType="fade" onRequestClose={() => setShowModify(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar alteração</Text>
            <Text style={styles.modalDesc}>Isso não altera o plano original.</Text>
            <TextInput
              style={styles.input}
              placeholder="Observação (o que comeu diferente?)"
              placeholderTextColor={colors.muted}
              value={modNote}
              onChangeText={setModNote}
              testID="mod-note-input"
              multiline
            />
            <Text style={styles.modalSectionLabel}>QUANTIDADE REALMENTE CONSUMIDA</Text>
            <ScrollView style={{ maxHeight: 210 }} contentContainerStyle={{ gap: spacing.sm }}>
              {currentOption?.foods.map((food) => {
                const selected = subs[food.id] && subs[food.id] !== "original" ? food.substitutions.find((sub) => sub.id === subs[food.id]) : null;
                return <View key={food.id} style={styles.quantityRow}><View style={{ flex: 1 }}><Text style={styles.quantityName}>{selected?.name ?? food.name}</Text><Text style={styles.quantityHint}>Planejado: {selected?.quantity ?? food.quantity} {selected?.unit ?? food.unit}</Text></View><TextInput value={quantities[food.id] ?? ""} onChangeText={(value) => setQuantities((current) => ({ ...current, [food.id]: value }))} keyboardType="decimal-pad" style={styles.quantityInput} /><Text style={styles.quantityUnit}>{selected?.unit ?? food.unit}</Text></View>;
              })}
            </ScrollView>
            <Text style={styles.modalSectionLabel}>HORÁRIO REAL</Text>
            <TextInput style={styles.input} value={actualTime} onChangeText={setActualTime} placeholder="HH:MM" placeholderTextColor={colors.muted} />
            <Pressable style={[styles.freeMealToggle, modFreeMeal && styles.freeMealToggleActive]} onPress={() => setModFreeMeal((value) => !value)} testID="mod-free-meal-toggle">
              <MaterialDesignIcons name={modFreeMeal ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} size={20} color={modFreeMeal ? colors.brandPrimary : colors.onSurfaceTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.freeMealTitle}>Refeição livre</Text>
                <Text style={styles.freeMealDescription}>Sem culpa — marcar ajuda o histórico a contar a história real.</Text>
              </View>
            </Pressable>
            <Pressable style={styles.extraLink} onPress={() => { setShowModify(false); router.push(`/fora-do-plano?date=${date}`); }}><MaterialDesignIcons name="plus-circle-outline" size={18} color={colors.brandSecondary} /><Text style={styles.extraLinkText}>Adicionar alimento extra como registro separado</Text></Pressable>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setShowModify(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={handleSubmitModify} testID="mod-save-btn">
                <Text style={styles.modalBtnPrimaryText}>Salvar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FoodRow({
  food,
  currentSub,
  catalog,
  onChangeSub,
}: {
  food: Food;
  currentSub?: string;
  catalog: FoodCatalogItem[];
  onChangeSub: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubs = food.substitutions.length > 0;
  const activeSub = currentSub && currentSub !== "original"
    ? food.substitutions.find((s) => s.id === currentSub)
    : null;

  const display = resolvePlanFood(food, currentSub, catalog);

  return (
    <View style={styles.foodCard} testID={`food-row-${food.id}`}>
      <View style={styles.foodMain}>
        <View style={{ flex: 1 }}>
          <Text style={styles.foodName}>
            {display.name}
            {activeSub ? <Text style={styles.subBadge}>  · SUBSTITUÍDO</Text> : null}
          </Text>
          <Text style={styles.foodQty}>
            {formatQuantity(display.quantity, display.unit)}
          </Text>
          {food.notes ? <Text style={styles.foodNotes}>{food.notes}</Text> : null}
        </View>
        <View style={styles.foodMacros}>
          <Text style={styles.foodKcal}>{display.kcal !== null ? Math.round(display.kcal) : "—"}</Text>
          <Text style={styles.foodKcalLabel}>kcal</Text>
        </View>
      </View>
      <View style={styles.foodMacroLine}>
        <MacroDot label="P" value={display.protein} color={colors.protein} />
        <MacroDot label="C" value={display.carbs} color={colors.carbs} />
        <MacroDot label="G" value={display.fats} color={colors.fats} />
      </View>
      {hasSubs ? (
        <>
          <Pressable
            style={styles.subToggle}
            onPress={() => setExpanded((v) => !v)}
            testID={`toggle-subs-${food.id}`}
          >
            <MaterialDesignIcons
              name="swap-horizontal"
              size={16}
              color={colors.brandSecondary}
            />
            <Text style={styles.subToggleText}>
              {expanded ? "Ocultar substituições" : `Substituir (${food.substitutions.length})`}
            </Text>
            {activeSub ? (
              <Pressable
                onPress={() => onChangeSub("original")}
                style={styles.restoreBtn}
                testID={`restore-${food.id}`}
              >
                <Text style={styles.restoreText}>Restaurar</Text>
              </Pressable>
            ) : null}
          </Pressable>
          {expanded ? (
            <View style={styles.subList}>
              {food.substitutions.map((sub) => {
                const sel = currentSub === sub.id;
                return (
                  <Pressable
                    key={sub.id}
                    style={[styles.subRow, sel && styles.subRowSelected]}
                    onPress={() => onChangeSub(sel ? "original" : sub.id)}
                    testID={`sub-${food.id}-${sub.id}`}
                  >
                    <MaterialDesignIcons
                      name={sel ? "radiobox-marked" : "radiobox-blank"}
                      size={18}
                      color={sel ? colors.brandPrimary : colors.onSurfaceTertiary}
                    />
                    <Text style={styles.subText}>
                      {sub.name} — {formatQuantity(sub.quantity, sub.unit)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function MacroDot({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <View style={styles.macroDotWrap}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text style={styles.macroDotText}>
        {label} {value !== null ? Math.round(value) : "—"}g
      </Text>
    </View>
  );
}

function formatQuantity(q: number, unit: string) {
  if (unit === "un") return q === 1 ? "1 unidade" : `${q} unidades`;
  return `${q} ${unit}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  sectionTitle: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  optChip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optChipSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  optChipText: { color: colors.onSurfaceSecondary, fontWeight: "600" },
  optChipTextSelected: { color: colors.onBrandPrimary, fontWeight: "800" },
  optHeader: { gap: spacing.xs },
  optName: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  optNotes: { color: colors.onSurfaceTertiary, fontSize: 13 },
  foodCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  foodMain: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  foodName: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  subBadge: { color: colors.brandTertiary, fontSize: 10, fontWeight: "800" },
  foodQty: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  foodNotes: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4, fontStyle: "italic" },
  foodMacros: { alignItems: "flex-end" },
  foodKcal: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  foodKcalLabel: { color: colors.onSurfaceTertiary, fontSize: 10 },
  foodMacroLine: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
  macroDotWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  macroDot: { width: 6, height: 6, borderRadius: 999 },
  macroDotText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  subToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  subToggleText: { color: colors.brandSecondary, fontSize: 13, fontWeight: "700", flex: 1 },
  restoreBtn: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  restoreText: { color: colors.onSurface, fontSize: 11, fontWeight: "700" },
  subList: {
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  subRowSelected: {},
  subText: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  statusTitle: { color: colors.onSurface, fontWeight: "700" },
  statusNote: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  ctaSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceTertiary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  ctaSecondaryText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  ctaPrimary: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  ctaPrimaryText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  skipButton: { flexBasis: "100%", alignItems: "center", paddingVertical: spacing.xs },
  skipButtonText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },
  emptyText: { color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.xl },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    maxHeight: "92%",
  },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  modalDesc: { color: colors.onSurfaceTertiary, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 14,
    minHeight: 60,
  },
  modalSectionLabel: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.sm },
  quantityName: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  quantityHint: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 },
  quantityInput: { width: 64, color: colors.onSurface, backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, textAlign: "right" },
  quantityUnit: { color: colors.onSurfaceTertiary, fontSize: 10, minWidth: 24 },
  extraLink: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm },
  extraLinkText: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700" },
  freeMealToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  freeMealToggleActive: { borderColor: colors.brandPrimary + "88", backgroundColor: colors.brandPrimary + "12" },
  freeMealTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  freeMealDescription: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalBtnSecondary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  modalBtnSecondaryText: { color: colors.onSurface, fontWeight: "600" },
  modalBtnPrimary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  modalBtnPrimaryText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
