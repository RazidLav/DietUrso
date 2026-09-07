import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addIsoDays, formatHydrationVolume, hydrationClock, totalForDate } from "../src/hydration/calculations";
import type { HydrationState } from "../src/hydration/types";
import { getHydrationState } from "../src/store/hydrationStore";
import { colors, radius, spacing } from "../src/theme";

type Mode = "day" | "week" | "month";
const formatDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
const monthLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function rangeDates(anchor: string, mode: Mode) {
  if (mode === "day") return [anchor];
  if (mode === "week") return Array.from({ length: 7 }, (_, index) => addIsoDays(anchor, index - 6));
  const [year, month] = anchor.split("-").map(Number);
  const days = new Date(year, month, 0).getDate();
  return Array.from({ length: days }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

function moveAnchor(anchor: string, mode: Mode, direction: -1 | 1) {
  if (mode === "day") return addIsoDays(anchor, direction);
  if (mode === "week") return addIsoDays(anchor, direction * 7);
  const [year, month] = anchor.split("-").map(Number);
  const date = new Date(year, month - 1 + direction, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function bestStreak(goalDates: string[]) {
  const sorted = Array.from(new Set(goalDates)).sort();
  let best = 0; let run = 0; let previous = "";
  sorted.forEach((date) => { run = previous && addIsoDays(previous, 1) === date ? run + 1 : 1; best = Math.max(best, run); previous = date; });
  return best;
}

export default function HydrationHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<HydrationState | null>(null);
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState("");
  const load = useCallback(async () => { const next = await getHydrationState(); setState(next); setAnchor((value) => value || hydrationClock(new Date(), next.config).date); }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const dates = useMemo(() => anchor ? rangeDates(anchor, mode) : [], [anchor, mode]);
  const rows = useMemo(() => !state ? [] : dates.filter((date) => date <= hydrationClock(new Date(), state.config).date).map((date) => { const consumed = totalForDate(state.records, date); const snapshot = state.daySnapshots[date]; const goal = snapshot?.dailyGoalMl ?? state.config.dailyGoalMl; const currentDate = hydrationClock(new Date(), state.config).date; const expected = date === currentDate ? hydrationClock(new Date(), snapshot ?? state.config).progress * goal : goal; return { date, consumed, goal, expected, percentage: goal > 0 ? consumed / goal * 100 : 0 }; }), [dates, state]);
  if (!state || !anchor) return <View style={styles.loading}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>;
  const total = rows.reduce((sum, row) => sum + row.consumed, 0);
  const activeRows = rows.filter((row) => row.consumed > 0);
  const goalRows = rows.filter((row) => row.consumed >= row.goal);
  const average = activeRows.length ? total / activeRows.length : 0;
  const streak = bestStreak(Array.from(new Set(state.records.map((record) => record.localDate))).filter((date) => totalForDate(state.records, date) >= (state.daySnapshots[date]?.dailyGoalMl ?? state.config.dailyGoalMl)));
  const selectedRecords = state.records.filter((record) => record.localDate === anchor).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const today = hydrationClock(new Date(), state.config).date;
  const forwardDisabled = mode === "month" ? anchor.slice(0, 7) >= today.slice(0, 7) : anchor >= today;
  const label = mode === "day" ? formatDay(anchor) : mode === "week" ? `${formatDay(dates[0])} — ${formatDay(dates.at(-1)!)} ` : monthLabel(anchor);
  return <View style={styles.screen} testID="hydration-history-screen">
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><Pressable style={styles.iconButton} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>HIDRATURSO</Text><Text style={styles.title}>Histórico</Text></View></View>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.lg }}>
      <View style={styles.tabs}>{(["day", "week", "month"] as Mode[]).map((value) => <Pressable key={value} style={[styles.tab, mode === value && styles.tabOn]} onPress={() => setMode(value)}><Text style={[styles.tabText, mode === value && styles.tabTextOn]}>{value === "day" ? "Dia" : value === "week" ? "Semana" : "Mês"}</Text></Pressable>)}</View>
      <View style={styles.dateNav}><Pressable accessibilityRole="button" accessibilityLabel="Período anterior" style={styles.iconButton} onPress={() => setAnchor(moveAnchor(anchor, mode, -1))}><MaterialDesignIcons name="chevron-left" size={22} color={colors.onSurface} /></Pressable><View style={{ flex: 1, alignItems: "center" }}><Text style={styles.dateLabel}>{label}</Text><Text style={styles.snapshotHint}>Cada dia usa a meta registrada naquela data</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Próximo período" style={styles.iconButton} disabled={forwardDisabled} onPress={() => { const next = moveAnchor(anchor, mode, 1); setAnchor(next > today ? today : next); }}><MaterialDesignIcons name="chevron-right" size={22} color={forwardDisabled ? colors.onSurfaceTertiary : colors.onSurface} /></Pressable></View>
      <View style={styles.summary}><Stat label="Total" value={formatHydrationVolume(total)} /><Stat label="Média ativa" value={formatHydrationVolume(average)} /><Stat label="Metas" value={`${goalRows.length}/${rows.length}`} /><Stat label="Melhor sequência" value={`${streak} d`} /></View>
      <View style={styles.chart}><Text style={styles.sectionTitle}>{mode === "day" ? "PROGRESSO DO DIA" : "PROGRESSO NO PERÍODO"}</Text>{rows.map((row) => <View key={row.date}><View style={styles.barRow}><Text style={styles.barDate}>{mode === "month" ? row.date.slice(8) : formatDay(row.date).replace(".", "")}</Text><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(100, row.percentage)}%`, backgroundColor: row.percentage >= 100 ? colors.brandPrimary : colors.brandSecondary }]} /></View><Text style={styles.barValue}>{Math.round(row.percentage)}%</Text></View><Text style={styles.barMeta}>{formatHydrationVolume(row.consumed)} / {formatHydrationVolume(row.goal)} · esperado {formatHydrationVolume(row.expected)}</Text></View>)}</View>
      {mode === "day" ? <View><Text style={styles.sectionTitle}>REGISTROS · {selectedRecords.length}</Text><View style={{ gap: spacing.sm }}>{selectedRecords.map((record) => <View key={record.id} style={styles.record}><MaterialDesignIcons name="water" size={19} color={colors.brandSecondary} /><View style={{ flex: 1 }}><Text style={styles.recordAmount}>{formatHydrationVolume(record.amountMl)}</Text><Text style={styles.recordMeta}>{record.containerSnapshot?.name ?? (record.source === "manual" ? "Manual" : record.source === "legacy" ? "Importado" : "Atalho")} · {new Date(record.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text></View></View>)}</View>{!selectedRecords.length ? <Text style={styles.empty}>Nenhum registro neste dia.</Text> : null}</View> : null}
    </ScrollView>
  </View>;
}

function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandSecondary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.onSurface, fontSize: 22, fontWeight: "900" }, tabs: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 3 }, tab: { flex: 1, alignItems: "center", padding: spacing.sm, borderRadius: radius.sm }, tabOn: { backgroundColor: colors.brandPrimary }, tabText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" }, tabTextOn: { color: colors.onBrandPrimary }, dateNav: { flexDirection: "row", alignItems: "center", gap: spacing.md }, dateLabel: { color: colors.onSurface, fontSize: 13, fontWeight: "800", textTransform: "capitalize", textAlign: "center" }, snapshotHint: { color: colors.onSurfaceTertiary, fontSize: 8, marginTop: 3 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, stat: { width: "48%", flexGrow: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, statValue: { color: colors.onSurface, fontSize: 18, fontWeight: "900" }, statLabel: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 3 }, chart: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }, sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, marginBottom: spacing.sm }, barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, barDate: { width: 58, color: colors.onSurfaceTertiary, fontSize: 8, textTransform: "capitalize" }, track: { flex: 1, height: 8, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" }, fill: { height: "100%", borderRadius: radius.pill }, barValue: { width: 36, color: colors.onSurfaceSecondary, fontSize: 9, fontWeight: "800", textAlign: "right" }, barMeta: { color: colors.onSurfaceTertiary, fontSize: 8, marginLeft: 66, marginTop: 3 }, record: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md }, recordAmount: { color: colors.onSurface, fontSize: 13, fontWeight: "800" }, recordMeta: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 }, empty: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", padding: spacing.xl },
});
