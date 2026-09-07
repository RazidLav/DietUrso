import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrainingSessionCard from "../src/components/TrainingSessionCard";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { addDays, dayEntries, localDate, startOfWeek } from "../src/training/calculations";
import { ACTIVITY_COLORS } from "../src/training/catalog";
import type { TrainingState } from "../src/training/types";
import { getTrainingState, movePlannedSession, prepareTrainingRange } from "../src/store/trainingStore";
import { colors, radius, spacing } from "../src/theme";

type ViewMode = "day" | "week" | "month";
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dateTitle(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${date}T12:00:00`));
}

function monthBounds(date: string) {
  const current = new Date(`${date}T12:00:00`);
  const first = localDate(new Date(current.getFullYear(), current.getMonth(), 1, 12));
  const last = localDate(new Date(current.getFullYear(), current.getMonth() + 1, 0, 12));
  return { first, last };
}

export default function TreinosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<TrainingState | null>(null);
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [mode, setMode] = useState<ViewMode>("day");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const bounds = monthBounds(selectedDate);
      await prepareTrainingRange(addDays(bounds.first, -7), addDays(bounds.last, 7));
      setState(await getTrainingState());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os treinos.");
    }
  }, [selectedDate]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const entries = useMemo(() => state ? dayEntries(state, selectedDate) : [], [state, selectedDate]);
  const weekStart = startOfWeek(selectedDate);
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const bounds = monthBounds(selectedDate);
  const monthFirstWeekday = new Date(`${bounds.first}T12:00:00`).getDay();
  const monthDates = Array.from({ length: monthFirstWeekday + Number(bounds.last.slice(-2)) }, (_, index) => index < monthFirstWeekday ? null : `${selectedDate.slice(0, 8)}${String(index - monthFirstWeekday + 1).padStart(2, "0")}`);

  const shift = (direction: -1 | 1) => {
    if (mode === "day") setSelectedDate(addDays(selectedDate, direction));
    else if (mode === "week") setSelectedDate(addDays(selectedDate, direction * 7));
    else {
      const current = new Date(`${selectedDate}T12:00:00`);
      setSelectedDate(localDate(new Date(current.getFullYear(), current.getMonth() + direction, 1, 12)));
    }
  };

  const move = async (id: string, direction: -1 | 1) => {
    await movePlannedSession(id, direction);
    await load();
  };

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!state) return <View style={styles.loading}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.muted}>Preparando seus treinos…</Text></View>;

  return (
    <View style={styles.screen}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brandPrimary} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Voltar"><MaterialDesignIcons name="arrow-left" size={23} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>ETAPA 4 · URSOFIT</Text><Text style={styles.title}>Treinos completos</Text></View><Pressable style={styles.primarySmall} onPress={() => router.push(`/treino-novo?date=${selectedDate}`)} accessibilityLabel="Adicionar sessão"><MaterialDesignIcons name="plus" size={20} color={colors.onBrandPrimary} /><Text style={styles.primarySmallText}>Sessão</Text></Pressable></View>

        <View style={[styles.shortcuts, width >= 800 && styles.shortcutsDesktop]}>
          <Shortcut icon="calendar-edit" label="Planos e modelos" onPress={() => router.push("/treinos-planos")} />
          <Shortcut icon="dumbbell" label="Banco de exercícios" onPress={() => router.push("/treinos-exercicios")} />
          <Shortcut icon="chart-timeline-variant" label="Histórico e evolução" onPress={() => router.push("/treinos-historico")} />
        </View>

        <View style={styles.modeRow}>{(["day", "week", "month"] as ViewMode[]).map((value) => <Pressable key={value} style={[styles.mode, mode === value && styles.modeActive]} onPress={() => setMode(value)}><Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value === "day" ? "Dia" : value === "week" ? "Semana" : "Mês"}</Text></Pressable>)}</View>
        <View style={styles.dateNav}><Pressable style={styles.navButton} onPress={() => shift(-1)} accessibilityLabel="Período anterior"><MaterialDesignIcons name="chevron-left" size={24} color={colors.onSurface} /></Pressable><Pressable style={styles.dateCenter} onPress={() => setSelectedDate(localDate())}><Text style={styles.dateTitle}>{mode === "month" ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${selectedDate}T12:00:00`)) : dateTitle(selectedDate)}</Text><Text style={styles.todayHint}>{selectedDate === localDate() ? "HOJE" : "TOQUE PARA VOLTAR A HOJE"}</Text></Pressable><Pressable style={styles.navButton} onPress={() => shift(1)} accessibilityLabel="Próximo período"><MaterialDesignIcons name="chevron-right" size={24} color={colors.onSurface} /></Pressable></View>

        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={load}><Text style={styles.retry}>Tentar novamente</Text></Pressable></View> : null}

        {mode === "day" ? <View style={styles.list}>
          <View style={styles.sectionRow}><Text style={styles.sectionTitle}>SESSÕES DO DIA · {entries.length}</Text><Text style={styles.sectionHint}>status independente</Text></View>
          {entries.length ? entries.map((entry) => <TrainingSessionCard key={entry.planned.id} entry={entry} onPress={() => router.push(`/treino-planejado/${entry.planned.id}`)} onMove={(direction) => void move(entry.planned.id, direction)} />) : <EmptyDay onAdd={() => router.push(`/treino-novo?date=${selectedDate}`)} />}
          <Text style={styles.sectionTitle}>MODALIDADES</Text>
          <View style={styles.modalityGrid}>{(["mobility", "strength", "crossfit", "running", "cycling", "custom"] as const).map((activityType) => {
            const count = entries.filter((entry) => entry.planned.activityType === activityType).length;
            return <Pressable key={activityType} style={styles.modality} onPress={() => router.push(`/treino-novo?date=${selectedDate}&type=${activityType}`)}><View style={[styles.dot, { backgroundColor: ACTIVITY_COLORS[activityType] }]} /><Text style={styles.modalityText}>{activityType === "mobility" ? "Alongamento" : activityType === "strength" ? "Musculação" : activityType === "running" ? "Corrida" : activityType === "cycling" ? "Bike" : activityType === "crossfit" ? "CrossFit" : "Personalizada"}</Text><Text style={styles.count}>{count || "+"}</Text></Pressable>;
          })}</View>
        </View> : null}

        {mode === "week" ? <View style={[styles.weekGrid, width >= 800 && styles.weekGridDesktop]}>{weekDates.map((date) => {
          const items = dayEntries(state, date);
          return <Pressable key={date} style={[styles.weekDay, date === selectedDate && styles.selected]} onPress={() => { setSelectedDate(date); setMode("day"); }}><Text style={styles.weekName}>{DAY_NAMES[new Date(`${date}T12:00:00`).getDay()]}</Text><Text style={styles.weekNumber}>{Number(date.slice(-2))}</Text><Text style={styles.weekCount}>{items.length ? `${items.length} sessão${items.length > 1 ? "ões" : ""}` : "Livre"}</Text>{items.slice(0, 3).map((entry) => <View key={entry.planned.id} style={[styles.miniBar, { backgroundColor: ACTIVITY_COLORS[entry.planned.activityType] }]} />)}</Pressable>;
        })}</View> : null}

        {mode === "month" ? <View style={styles.monthGrid}>{monthDates.map((date, index) => date ? <Pressable key={date} style={[styles.monthDay, date === selectedDate && styles.selected]} onPress={() => { setSelectedDate(date); setMode("day"); }}><Text style={styles.monthNumber}>{Number(date.slice(-2))}</Text><View style={styles.monthDots}>{dayEntries(state, date).slice(0, 4).map((entry) => <View key={entry.planned.id} style={[styles.monthDot, { backgroundColor: ACTIVITY_COLORS[entry.planned.activityType] }]} />)}</View></Pressable> : <View key={`empty-${index}`} style={styles.monthDay} />)}</View> : null}
      </ScrollView>
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) { return <Pressable style={styles.shortcut} onPress={onPress} accessibilityRole="button"><MaterialDesignIcons name={icon as never} size={22} color={colors.brandPrimary} /><Text style={styles.shortcutText}>{label}</Text><MaterialDesignIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} /></Pressable>; }
function EmptyDay({ onAdd }: { onAdd: () => void }) { return <View style={styles.empty}><MaterialDesignIcons name="calendar-blank-outline" size={38} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>Dia livre por enquanto</Text><Text style={styles.muted}>Adicione sessões independentes. Uma não conclui a outra.</Text><Pressable style={styles.primary} onPress={onAdd}><Text style={styles.primaryText}>Adicionar sessão</Text></Pressable></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg }, loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md }, back: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, title: { color: colors.onSurface, fontSize: 26, fontWeight: "900" }, primarySmall: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md }, primarySmallText: { color: colors.onBrandPrimary, fontWeight: "900", fontSize: 12 },
  shortcuts: { gap: spacing.sm }, shortcutsDesktop: { flexDirection: "row" }, shortcut: { minHeight: 58, flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, shortcutText: { flex: 1, color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 12 },
  modeRow: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary }, mode: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }, modeActive: { backgroundColor: colors.brandPrimary }, modeText: { color: colors.onSurfaceTertiary, fontWeight: "800" }, modeTextActive: { color: colors.onBrandPrimary },
  dateNav: { flexDirection: "row", alignItems: "center" }, navButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }, dateCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm }, dateTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", textTransform: "capitalize", textAlign: "center" }, todayHint: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", marginTop: 2 },
  list: { gap: spacing.sm }, sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "900", marginTop: spacing.sm }, sectionHint: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700" },
  empty: { padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: "center", gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontWeight: "800", fontSize: 17 }, muted: { color: colors.onSurfaceTertiary, fontSize: 12, textAlign: "center" }, primary: { marginTop: spacing.sm, minHeight: 44, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg }, primaryText: { color: colors.onBrandPrimary, fontWeight: "900" },
  modalityGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, modality: { width: "48%", minHeight: 48, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, dot: { width: 9, height: 9, borderRadius: 9 }, modalityText: { flex: 1, color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 12 }, count: { color: colors.onSurface, fontWeight: "900" },
  weekGrid: { gap: spacing.sm }, weekGridDesktop: { flexDirection: "row" }, weekDay: { flex: 1, minHeight: 96, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, selected: { borderColor: colors.brandPrimary }, weekName: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800" }, weekNumber: { color: colors.onSurface, fontSize: 22, fontWeight: "900" }, weekCount: { color: colors.onSurfaceSecondary, fontSize: 10, marginBottom: spacing.xs }, miniBar: { height: 3, borderRadius: radius.pill, marginTop: 3 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, monthDay: { width: "13.5%", minHeight: 58, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.xs }, monthNumber: { color: colors.onSurface, fontWeight: "800" }, monthDots: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: spacing.sm }, monthDot: { width: 6, height: 6, borderRadius: 6 },
  error: { padding: spacing.md, borderRadius: radius.md, backgroundColor: `${colors.error}18`, borderWidth: 1, borderColor: colors.error }, errorText: { color: colors.onSurfaceSecondary }, retry: { color: colors.error, fontWeight: "800", marginTop: spacing.sm },
});
