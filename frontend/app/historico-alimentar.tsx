import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { addNutrients, ZERO_NUTRIENTS } from "../src/nutrition/calculations";
import { adherenceForDay, createPlannedDaySnapshot, entryNutrients } from "../src/nutrition/records";
import { getActivePlan, listConsumption, removeConsumption } from "../src/store/planStore";
import { colors, radius, spacing } from "../src/theme";
import type { ConsumptionEntry, Plan } from "../src/types/plan";
import { todayISO } from "../src/utils/date";

type Mode = "day" | "week";
const addDays = (iso: string, amount: number) => { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + amount); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export default function FoodHistoryScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState(params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayISO());
  const [mode, setMode] = useState<Mode>("day");
  const [entries, setEntries] = useState<ConsumptionEntry[]>([]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [foodFilter, setFoodFilter] = useState("");
  const [onlyOffPlan, setOnlyOffPlan] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ConsumptionEntry | null>(null);

  const load = useCallback(async () => { const [all, active] = await Promise.all([listConsumption(), getActivePlan()]); setEntries(all); setPlan(active); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const rangeStart = mode === "week" ? addDays(date, -6) : date;
  const rangeEntries = useMemo(() => entries.filter((entry) => {
    const inRange = entry.date >= rangeStart && entry.date <= date;
    const typeMatches = typeFilter === "all" || (entry.mealType ?? entry.plannedSnapshot?.mealType) === typeFilter;
    const offPlanMatches = !onlyOffPlan || entry.status === "off_plan";
    const normalized = foodFilter.trim().toLocaleLowerCase("pt-BR");
    const foodMatches = !normalized || `${entry.mealName ?? ""} ${(entry.foodNames ?? []).join(" ")} ${(entry.consumedItems ?? []).map((item) => item.name).join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized);
    return inRange && typeMatches && offPlanMatches && foodMatches;
  }).sort((a, b) => (b.actualAt ?? b.createdAt).localeCompare(a.actualAt ?? a.createdAt)), [entries, rangeStart, date, typeFilter, onlyOffPlan, foodFilter]);

  const totals = useMemo(() => addNutrients(...rangeEntries.map(entryNutrients)), [rangeEntries]);
  const todayEntries = entries.filter((entry) => entry.date === date);
  const plannedForDate = (day: string) => entries.find((entry) => entry.date === day && entry.plannedDayNutrients)?.plannedDayNutrients
    ?? (plan ? createPlannedDaySnapshot(plan, day).nutrients : ZERO_NUTRIENTS);
  const plannedCountForDate = (day: string) => entries.find((entry) => entry.date === day && entry.plannedMealCount !== undefined)?.plannedMealCount
    ?? (plan ? createPlannedDaySnapshot(plan, day).mealCount : 0);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(date, index - 6));
  const planned = mode === "day" ? plannedForDate(date) : addNutrients(...weekDates.map(plannedForDate));
  const adherence = mode === "day"
    ? adherenceForDay(todayEntries, plannedCountForDate(date))
    : weekDates.map((day) => adherenceForDay(entries.filter((entry) => entry.date === day), plannedCountForDate(day))).reduce((sum, value) => sum + value, 0) / 7;

  const doDelete = async () => { if (!confirmDelete) return; await removeConsumption(confirmDelete.id); setConfirmDelete(null); await load(); };

  return (
    <View style={styles.screen} testID="food-history-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><Pressable style={styles.iconBtn} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>DIÁRIO</Text><Text style={styles.title}>Histórico alimentar</Text></View></View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <View style={styles.modeRow}><Pressable onPress={() => setMode("day")} style={[styles.mode, mode === "day" && styles.modeOn]}><Text style={[styles.modeText, mode === "day" && styles.modeTextOn]}>Dia</Text></Pressable><Pressable onPress={() => setMode("week")} style={[styles.mode, mode === "week" && styles.modeOn]}><Text style={[styles.modeText, mode === "week" && styles.modeTextOn]}>7 dias</Text></Pressable></View>
        <View style={styles.dateNav}><Pressable style={styles.navBtn} onPress={() => setDate(addDays(date, mode === "day" ? -1 : -7))}><MaterialDesignIcons name="chevron-left" size={22} color={colors.onSurface} /></Pressable><View style={{ flex: 1, alignItems: "center" }}><Text style={styles.dateText}>{mode === "day" ? formatDate(date) : `${shortDate(addDays(date, -6))} a ${shortDate(date)}`}</Text><Text style={styles.dateIso}>{date === todayISO() ? "Hoje" : date}</Text></View><Pressable style={styles.navBtn} onPress={() => setDate(addDays(date, mode === "day" ? 1 : 7))} disabled={date >= todayISO()}><MaterialDesignIcons name="chevron-right" size={22} color={date >= todayISO() ? colors.onSurfaceTertiary : colors.onSurface} /></Pressable></View>
        <View style={styles.summary}>
          <View style={{ flex: 1 }}><Text style={styles.summaryLabel}>CONSUMIDO</Text><Text style={styles.summaryKcal}>{Math.round(totals.kcal)} kcal</Text><Text style={styles.summaryMacros}>P {totals.protein.toFixed(1)} · C {totals.carbs.toFixed(1)} · G {totals.fats.toFixed(1)} · Fibra {totals.fiber.toFixed(1)}</Text></View>
          <View style={styles.adherence}><Text style={styles.adherenceValue}>{Math.round(adherence)}%</Text><Text style={styles.adherenceLabel}>adesão aprox.</Text></View>
        </View>
        <View style={styles.compare}><Compare label="Planejado" value={planned.kcal} /><MaterialDesignIcons name="arrow-right" size={18} color={colors.onSurfaceTertiary} /><Compare label="Consumido" value={totals.kcal} accent /><View style={styles.delta}><Text style={styles.deltaText}>{totals.kcal - planned.kcal >= 0 ? "+" : ""}{Math.round(totals.kcal - planned.kcal)}</Text><Text style={styles.deltaLabel}>diferença</Text></View></View>
        <View style={styles.searchWrap}><MaterialDesignIcons name="magnify" size={18} color={colors.onSurfaceTertiary} /><TextInput value={foodFilter} onChangeText={setFoodFilter} placeholder="Filtrar alimento ou refeição" placeholderTextColor={colors.onSurfaceTertiary} style={styles.search} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{[["all", "Todas"], ["cafe", "Café"], ["almoco", "Almoço"], ["lanche", "Lanche"], ["jantar", "Jantar"], ["ceia", "Ceia"]].map(([value, label]) => <Pressable key={value} onPress={() => setTypeFilter(value)} style={[styles.chip, typeFilter === value && styles.chipOn]}><Text style={[styles.chipText, typeFilter === value && styles.chipTextOn]}>{label}</Text></Pressable>)}</ScrollView>
        <Pressable style={styles.checkRow} onPress={() => setOnlyOffPlan((value) => !value)}><View style={[styles.checkbox, onlyOffPlan && styles.checkboxOn]}>{onlyOffPlan ? <MaterialDesignIcons name="check" size={15} color={colors.onBrandPrimary} /> : null}</View><Text style={styles.checkText}>Mostrar somente refeições fora do plano</Text></Pressable>
        <Text style={styles.sectionTitle}>{rangeEntries.length} {rangeEntries.length === 1 ? "registro" : "registros"}</Text>
        {rangeEntries.map((entry) => <HistoryEntry key={entry.id} entry={entry} onEdit={entry.status === "off_plan" ? () => router.push(`/fora-do-plano?entryId=${entry.id}`) : undefined} onDelete={() => setConfirmDelete(entry)} />)}
        {!rangeEntries.length ? <View style={styles.empty}><MaterialDesignIcons name="calendar-blank-outline" size={38} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>Nenhum registro neste período</Text><Text style={styles.emptyText}>O plano continua disponível. Registre o que realmente consumiu quando estiver pronto.</Text></View> : null}
      </ScrollView>
      <Modal visible={!!confirmDelete} transparent animationType="fade"><View style={styles.overlay}><View style={styles.confirm}><Text style={styles.confirmTitle}>Excluir este registro?</Text><Text style={styles.emptyText}>Somente o consumo será removido. O plano e os registros de outros dias não serão alterados.</Text><View style={styles.confirmActions}><Pressable style={styles.cancel} onPress={() => setConfirmDelete(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={styles.delete} onPress={() => void doDelete()}><Text style={styles.deleteText}>Excluir</Text></Pressable></View></View></View></Modal>
    </View>
  );
}

function HistoryEntry({ entry, onEdit, onDelete }: { entry: ConsumptionEntry; onEdit?: () => void; onDelete: () => void }) { const nutrition = entryNutrients(entry); const isOffPlan = entry.status === "off_plan"; return <View style={[styles.entry, isOffPlan && { borderColor: colors.brandTertiary + "66" }]}><View style={styles.entryTop}><View style={[styles.entryIcon, { backgroundColor: (isOffPlan ? colors.brandTertiary : entry.status === "as_planned" ? colors.brandPrimary : colors.brandSecondary) + "22" }]}><MaterialDesignIcons name={entry.status === "skipped" ? "minus-circle-outline" : isOffPlan ? "silverware-variant" : "food"} size={20} color={isOffPlan ? colors.brandTertiary : entry.status === "as_planned" ? colors.brandPrimary : colors.brandSecondary} /></View><View style={{ flex: 1 }}><Text style={styles.entryName}>{entry.mealName ?? entry.plannedSnapshot?.mealName ?? "Refeição"}</Text><Text style={styles.entryMeta}>{entry.date} · {entry.status === "as_planned" ? "conforme o plano" : entry.status === "skipped" ? "não realizada" : isOffPlan ? "fora do plano" : "com alterações"}</Text></View><Text style={styles.entryKcal}>{Math.round(nutrition.kcal)} kcal</Text></View>{entry.consumedItems?.map((item) => <Text key={item.id} style={styles.itemLine}>• {item.name} — {item.quantity} {item.unit}{item.originalItemName ? ` (no lugar de ${item.originalItemName})` : ""}</Text>)}{entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}<View style={styles.entryActions}>{onEdit ? <Pressable style={styles.action} onPress={onEdit}><Text style={styles.actionText}>Editar</Text></Pressable> : null}<Pressable style={styles.action} onPress={onDelete}><Text style={[styles.actionText, { color: colors.error }]}>Excluir registro</Text></Pressable></View></View>; }
function Compare({ label, value, accent }: { label: string; value: number; accent?: boolean }) { return <View><Text style={styles.compareLabel}>{label}</Text><Text style={[styles.compareValue, accent && { color: colors.brandPrimary }]}>{Math.round(value)} kcal</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.onSurface, fontSize: 21, fontWeight: "800" },
  modeRow: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 3 }, mode: { flex: 1, alignItems: "center", padding: spacing.sm, borderRadius: radius.sm }, modeOn: { backgroundColor: colors.brandPrimary }, modeText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700" }, modeTextOn: { color: colors.onBrandPrimary }, dateNav: { flexDirection: "row", alignItems: "center" }, navBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, dateText: { color: colors.onSurface, fontSize: 14, fontWeight: "800", textTransform: "capitalize" }, dateIso: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  summary: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }, summaryLabel: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, summaryKcal: { color: colors.onSurface, fontSize: 30, fontWeight: "800", marginTop: 3 }, summaryMacros: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: spacing.sm }, adherence: { width: 82, height: 82, borderRadius: radius.pill, backgroundColor: colors.brandPrimary + "1F", alignItems: "center", justifyContent: "center" }, adherenceValue: { color: colors.brandPrimary, fontSize: 22, fontWeight: "800" }, adherenceLabel: { color: colors.onSurfaceTertiary, fontSize: 9 },
  compare: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md }, compareLabel: { color: colors.onSurfaceTertiary, fontSize: 10 }, compareValue: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 2 }, delta: { alignItems: "flex-end" }, deltaText: { color: colors.brandTertiary, fontSize: 13, fontWeight: "800" }, deltaLabel: { color: colors.onSurfaceTertiary, fontSize: 9 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md }, search: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md }, chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, chipOn: { backgroundColor: colors.brandPrimary }, chipText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" }, chipTextOn: { color: colors.onBrandPrimary }, checkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, checkbox: { width: 23, height: 23, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }, checkText: { color: colors.onSurfaceSecondary, fontSize: 12 }, sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginTop: spacing.sm },
  entry: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }, entryTop: { flexDirection: "row", alignItems: "center", gap: spacing.md }, entryIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }, entryName: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, entryMeta: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2 }, entryKcal: { color: colors.onSurface, fontSize: 13, fontWeight: "800" }, itemLine: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17, marginLeft: 50 }, note: { color: colors.onSurfaceTertiary, fontSize: 11, fontStyle: "italic", marginLeft: 50 }, entryActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }, action: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, actionText: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" }, emptyText: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" }, overlay: { flex: 1, backgroundColor: "#000A", alignItems: "center", justifyContent: "center", padding: spacing.lg }, confirm: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }, confirmTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", textAlign: "center" }, confirmActions: { flexDirection: "row", gap: spacing.sm }, cancel: { flex: 1, alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }, cancelText: { color: colors.onSurface, fontWeight: "700" }, delete: { flex: 1, alignItems: "center", padding: spacing.md, backgroundColor: colors.error, borderRadius: radius.md }, deleteText: { color: colors.onError, fontWeight: "800" },
});
