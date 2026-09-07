import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { formatShoppingQuantity, generateShoppingList, type ShoppingLine } from "../../src/nutrition/shopping";
import { createId, getShoppingConfig, listRecipes, saveShoppingConfig, type ShoppingConfig } from "../../src/store/nutritionStore";
import { getActivePlan, getShoppingChecked, setShoppingChecked } from "../../src/store/planStore";
import { colors, radius, spacing } from "../../src/theme";
import type { Plan, Recipe, Unit } from "../../src/types/plan";
import { CATEGORY_ICONS, categorizeFood, sortCategories, type Category } from "../../src/utils/categories";
import { todayISO } from "../../src/utils/date";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";

const PERIODS = [{ days: 1, label: "Hoje" }, { days: 3, label: "3 dias" }, { days: 7, label: "1 semana" }, { days: 14, label: "2 semanas" }];

export default function ComprasScreen() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [config, setConfig] = useState<ShoppingConfig>({ periodDays: 7, preferredSubstitutions: {}, manualItems: [] });
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [manualUnit, setManualUnit] = useState<Unit>("un");

  const load = useCallback(async () => {
    const [activePlan, savedRecipes, shoppingConfig, checkedState] = await Promise.all([getActivePlan(), listRecipes(), getShoppingConfig(), getShoppingChecked()]);
    setPlan(activePlan); setRecipes(savedRecipes); setConfig(shoppingConfig); setChecked(checkedState);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const lines = useMemo(() => {
    const generated = generateShoppingList(plan, recipes, todayISO(), config.periodDays, config.preferredSubstitutions);
    const manual: ShoppingLine[] = config.manualItems.map((item) => ({ key: `manual:${item.id}`, name: item.name, quantity: item.quantity, unit: item.unit, category: item.category, source: "manual" }));
    return [...generated, ...manual];
  }, [plan, recipes, config]);
  const grouped = useMemo(() => {
    const map = new Map<Category, ShoppingLine[]>();
    lines.forEach((line) => { const category = (line.category in CATEGORY_ICONS ? line.category : categorizeFood(line.name)) as Category; map.set(category, [...(map.get(category) ?? []), line]); });
    return Array.from(map.entries()).sort(([a], [b]) => sortCategories(a, b));
  }, [lines]);
  const checkedCount = lines.filter((line) => checked[line.key]).length;

  const changePeriod = async (periodDays: number) => { const next = { ...config, periodDays }; setConfig(next); await saveShoppingConfig(next); };
  const toggle = async (key: string) => { const next = { ...checked, [key]: !checked[key] }; setChecked(next); await setShoppingChecked(next); };
  const addManual = async () => {
    const quantity = Number(manualQuantity.replace(",", "."));
    if (!manualName.trim() || !Number.isFinite(quantity) || quantity <= 0) return;
    const next = { ...config, manualItems: [...config.manualItems, { id: createId("shopping"), name: manualName.trim(), quantity, unit: manualUnit, category: categorizeFood(manualName), checked: false }] };
    setConfig(next); await saveShoppingConfig(next); setManualOpen(false); setManualName(""); setManualQuantity("1");
  };
  const removeManual = async (key: string) => { const id = key.replace("manual:", ""); const next = { ...config, manualItems: config.manualItems.filter((item) => item.id !== id) }; setConfig(next); await saveShoppingConfig(next); };

  return (
    <View style={styles.screen} testID="compras-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>LISTA AUTOMÁTICA</Text><Text style={styles.title}>{checkedCount}/{lines.length} itens</Text></View><Pressable style={styles.addBtn} onPress={() => setManualOpen(true)} testID="add-manual-shopping"><MaterialDesignIcons name="plus" size={22} color={colors.onBrandPrimary} /></Pressable></View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl, gap: spacing.md }}>
        <Text style={styles.sectionLabel}>PERÍODO A PARTIR DE HOJE</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{PERIODS.map((period) => <Pressable key={period.days} onPress={() => void changePeriod(period.days)} style={[styles.chip, config.periodDays === period.days && styles.chipOn]}><Text style={[styles.chipText, config.periodDays === period.days && styles.chipTextOn]}>{period.label}</Text></Pressable>)}</ScrollView>
        <View style={styles.info}><MaterialDesignIcons name="information-outline" size={19} color={colors.brandSecondary} /><Text style={styles.infoText}>A lista usa a opção principal de cada refeição, respeita os dias programados, soma itens iguais e expande ingredientes das receitas.</Text></View>
        {!plan ? <Text style={styles.emptyText}>Ative um plano para gerar a lista automaticamente.</Text> : null}
        {grouped.map(([category, items]) => { const isCollapsed = collapsed[category]; return <View key={category} style={styles.category}><Pressable style={styles.categoryHeader} onPress={() => setCollapsed((current) => ({ ...current, [category]: !current[category] }))}><View style={styles.categoryIcon}><MaterialDesignIcons name={CATEGORY_ICONS[category] as any} size={18} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.categoryName}>{category}</Text><Text style={styles.categoryMeta}>{items.filter((item) => checked[item.key]).length}/{items.length} comprados</Text></View><MaterialDesignIcons name={isCollapsed ? "chevron-down" : "chevron-up"} size={21} color={colors.onSurfaceTertiary} /></Pressable>{!isCollapsed ? <View style={styles.items}>{items.map((item) => <View key={item.key} style={styles.item}><Pressable style={[styles.checkbox, checked[item.key] && styles.checkboxOn]} onPress={() => void toggle(item.key)}>{checked[item.key] ? <MaterialDesignIcons name="check" size={15} color={colors.onBrandPrimary} /> : null}</Pressable><Pressable style={{ flex: 1 }} onPress={() => void toggle(item.key)}><Text style={[styles.itemName, checked[item.key] && styles.itemDone]}>{item.name}</Text><Text style={styles.itemQty}>{formatShoppingQuantity(item.quantity, item.unit)}{item.source === "manual" ? " · manual" : ""}</Text></Pressable>{item.source === "manual" ? <Pressable onPress={() => void removeManual(item.key)}><MaterialDesignIcons name="close" size={19} color={colors.error} /></Pressable> : null}</View>)}</View> : null}</View>; })}
        {!lines.length && plan ? <View style={styles.empty}><MaterialDesignIcons name="cart-outline" size={38} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>Lista vazia</Text><Text style={styles.emptyText}>Adicione itens ao plano ou inclua um item manual.</Text></View> : null}
      </ScrollView>
      <Modal visible={manualOpen} transparent animationType="fade"><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Adicionar item manual</Text><Pressable onPress={() => setManualOpen(false)}><MaterialDesignIcons name="close" size={23} color={colors.onSurface} /></Pressable></View><Text style={styles.label}>Item</Text><TextInput value={manualName} onChangeText={setManualName} placeholder="Ex.: Papel toalha" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} /><Text style={styles.label}>Quantidade</Text><TextInput value={manualQuantity} onChangeText={setManualQuantity} keyboardType="decimal-pad" style={styles.input} /><View style={styles.units}>{(["g", "ml", "un", "porcao"] as Unit[]).map((unit) => <Pressable key={unit} onPress={() => setManualUnit(unit)} style={[styles.chip, manualUnit === unit && styles.chipOn]}><Text style={[styles.chipText, manualUnit === unit && styles.chipTextOn]}>{unit}</Text></Pressable>)}</View><Pressable style={styles.saveBtn} onPress={() => void addManual()}><Text style={styles.saveText}>Adicionar à lista</Text></Pressable></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.onSurface, fontSize: 22, fontWeight: "800", marginTop: 2 }, addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }, sectionLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.1 }, chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, chipOn: { backgroundColor: colors.brandPrimary }, chipText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" }, chipTextOn: { color: colors.onBrandPrimary }, info: { flexDirection: "row", gap: spacing.sm, backgroundColor: colors.brandSecondary + "16", borderWidth: 1, borderColor: colors.brandSecondary + "44", borderRadius: radius.md, padding: spacing.md }, infoText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 16 }, category: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }, categoryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md }, categoryIcon: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.brandPrimary + "22", alignItems: "center", justifyContent: "center" }, categoryName: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, categoryMeta: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2 }, items: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: 4 }, item: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }, checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }, itemName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" }, itemDone: { color: colors.onSurfaceTertiary, textDecorationLine: "line-through" }, itemQty: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }, empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" }, emptyText: { color: colors.onSurfaceTertiary, fontSize: 12, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "#000A", alignItems: "center", justifyContent: "center", padding: spacing.lg }, modal: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }, modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" }, label: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700", marginBottom: -6 }, input: { color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }, units: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }, saveBtn: { alignItems: "center", backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md }, saveText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
