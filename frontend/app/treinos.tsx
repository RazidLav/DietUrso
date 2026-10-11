import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TrainingSessionCard from "../src/components/TrainingSessionCard";
import { EmptyState, ErrorState, FeatureCard, FloatingActionMenu, FolderCard, LoadingSkeleton, SectionHeader } from "../src/components/ProgressiveUI";
import { getCloudStatus, subscribeCloudStatus } from "../src/cloud/cloudSync";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { addDays, dayEntries, localDate, startOfWeek } from "../src/training/calculations";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../src/training/catalog";
import type { TrainingState } from "../src/training/types";
import { getTrainingState, movePlannedSession, prepareTrainingRange } from "../src/store/trainingStore";
import { colors, withAlpha, radius, spacing } from "../src/theme";

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
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  useEffect(() => subscribeCloudStatus((next) => setCloudReady(next.readyForData)), []);

  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    try {
      const bounds = monthBounds(selectedDate);
      await prepareTrainingRange(addDays(bounds.first, -7), addDays(bounds.last, 7));
      setState(await getTrainingState());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os treinos.");
    }
  }, [selectedDate]);

  useFocusEffect(useCallback(() => { if (cloudReady) void load(); }, [cloudReady, load]));
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

  if (!state) return <View style={styles.loading}>{error ? <ErrorState description={error} onRetry={() => void load()} /> : <LoadingSkeleton title="Preparando seus treinos…" rows={4} />}</View>;

  const nextEntry = entries.find((entry) => entry.status === "in_progress") ?? entries.find((entry) => entry.status === "planned") ?? entries[0];
  const completedOnSelectedDay = entries.filter((entry) => entry.status === "completed").length;
  const openEntry = (entry: typeof nextEntry) => entry?.status === "in_progress" && entry.execution ? router.push(`/treino/${entry.execution.id}`) : entry ? router.push(`/treino-planejado/${entry.planned.id}`) : router.push(`/treino-novo?date=${selectedDate}`);

  return (
    <View style={styles.screen}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brandPrimary} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
        <SectionHeader eyebrow="TREINO" title="Sua semana, sem burocracia." description="Veja o que vem agora. Planos, exercícios e histórico ficam organizados em áreas próprias." />

        <View style={[styles.summaryGrid, width >= 768 && styles.summaryGridWide]}>
          <FeatureCard icon={nextEntry?.status === "in_progress" ? "play-circle-outline" : "calendar-clock"} title={nextEntry?.status === "in_progress" ? "EM ANDAMENTO" : "PRÓXIMA AÇÃO"} value={nextEntry?.planned.name ?? "Dia livre"} description={nextEntry ? `${nextEntry.planned.scheduledTime ?? "Sem horário"} · ${ACTIVITY_LABELS[nextEntry.planned.activityType]}` : "Você pode adicionar uma sessão quando quiser."} onPress={() => openEntry(nextEntry)} />
          <FeatureCard icon="check-circle-outline" title={selectedDate === localDate() ? "HOJE" : "DIA SELECIONADO"} value={`${completedOnSelectedDay}/${entries.length}`} description="sessões concluídas de forma independente" accent={colors.success} />
        </View>

        <View style={[styles.shortcuts, width >= 768 && styles.shortcutsDesktop]}>
          <FolderCard icon="calendar-edit" title="Meus planos" description="Monte e organize sua semana" onPress={() => router.push("/treinos-planos")} />
          <FolderCard icon="dumbbell" title="Banco de exercícios" description="Pesquise, filtre e favorite" onPress={() => router.push("/treinos-exercicios")} />
          <FolderCard icon="history" title="Histórico" description="Sessões, volume e recordes" onPress={() => router.push("/treinos-historico")} />
          <FolderCard icon="chart-line" title="Evolução" description="Acompanhe seu progresso" onPress={() => router.push("/evolucao")} />
        </View>

        <View style={styles.modeRow}>{(["day", "week", "month"] as ViewMode[]).map((value) => <Pressable key={value} style={[styles.mode, mode === value && styles.modeActive]} onPress={() => setMode(value)}><Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value === "day" ? "Dia" : value === "week" ? "Semana" : "Mês"}</Text></Pressable>)}</View>
        <View style={styles.dateNav}><Pressable style={styles.navButton} onPress={() => shift(-1)} accessibilityLabel="Período anterior"><MaterialDesignIcons name="chevron-left" size={24} color={colors.onSurface} /></Pressable><Pressable style={styles.dateCenter} onPress={() => setSelectedDate(localDate())}><Text style={styles.dateTitle}>{mode === "month" ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${selectedDate}T12:00:00`)) : dateTitle(selectedDate)}</Text><Text style={styles.todayHint}>{selectedDate === localDate() ? "HOJE" : "TOQUE PARA VOLTAR A HOJE"}</Text></Pressable><Pressable style={styles.navButton} onPress={() => shift(1)} accessibilityLabel="Próximo período"><MaterialDesignIcons name="chevron-right" size={24} color={colors.onSurface} /></Pressable></View>

        {error ? <ErrorState title="Dados locais preservados" description={error} onRetry={() => void load()} /> : null}

        {mode === "day" ? <View style={styles.list}>
          <View style={styles.sectionRow}><Text style={styles.sectionTitle}>SESSÕES DO DIA · {entries.length}</Text><Text style={styles.sectionHint}>status independente</Text></View>
          {entries.length ? entries.map((entry) => <TrainingSessionCard key={entry.planned.id} entry={entry} onPress={() => router.push(`/treino-planejado/${entry.planned.id}`)} onMove={(direction) => void move(entry.planned.id, direction)} />) : <EmptyState icon="calendar-blank-outline" title="Dia livre por enquanto" description="Adicione uma sessão quando fizer sentido. Cada modalidade continua independente." actionLabel="Adicionar sessão" onAction={() => router.push(`/treino-novo?date=${selectedDate}`)} />}
        </View> : null}

        {mode === "week" ? <View style={[styles.weekGrid, width >= 800 && styles.weekGridDesktop]}>{weekDates.map((date) => {
          const items = dayEntries(state, date);
          return <Pressable key={date} style={[styles.weekDay, date === selectedDate && styles.selected]} onPress={() => { setSelectedDate(date); setMode("day"); }}><Text style={styles.weekName}>{DAY_NAMES[new Date(`${date}T12:00:00`).getDay()]}</Text><Text style={styles.weekNumber}>{Number(date.slice(-2))}</Text><Text style={styles.weekCount}>{items.length ? `${items.length} sessão${items.length > 1 ? "ões" : ""}` : "Livre"}</Text>{items.slice(0, 3).map((entry) => <View key={entry.planned.id} style={[styles.miniBar, { backgroundColor: ACTIVITY_COLORS[entry.planned.activityType] }]} />)}</Pressable>;
        })}</View> : null}

        {mode === "month" ? <View style={styles.monthGrid}>{monthDates.map((date, index) => date ? <Pressable key={date} style={[styles.monthDay, date === selectedDate && styles.selected]} onPress={() => { setSelectedDate(date); setMode("day"); }}><Text style={styles.monthNumber}>{Number(date.slice(-2))}</Text><View style={styles.monthDots}>{dayEntries(state, date).slice(0, 4).map((entry) => <View key={entry.planned.id} style={[styles.monthDot, { backgroundColor: ACTIVITY_COLORS[entry.planned.activityType] }]} />)}</View></Pressable> : <View key={`empty-${index}`} style={styles.monthDay} />)}</View> : null}
      </ScrollView>
      <FloatingActionMenu label="Adicionar" actions={[
        { id: "session", label: "Nova sessão", hint: "Escolha a modalidade na próxima etapa", icon: "calendar-plus", onPress: () => router.push(`/treino-novo?date=${selectedDate}`) },
        { id: "plan", label: "Novo plano", hint: "Crie primeiro o plano e depois organize a semana", icon: "calendar-edit", onPress: () => router.push("/treinos-planos?new=1") },
        { id: "exercise", label: "Exercício personalizado", hint: "Adicione ao seu banco pessoal", icon: "plus-circle-outline", onPress: () => router.push("/treinos-exercicios?new=1") },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: 148, gap: spacing.lg }, loading: { flex: 1, backgroundColor: colors.surface, justifyContent: "center", padding: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md }, back: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, title: { color: colors.onSurface, fontSize: 26, fontWeight: "900" }, primarySmall: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md }, primarySmallText: { color: colors.onBrandPrimary, fontWeight: "900", fontSize: 12 },
  summaryGrid: { gap: spacing.sm }, summaryGridWide: { flexDirection: "row" }, shortcuts: { gap: spacing.sm }, shortcutsDesktop: { flexDirection: "row" },
  modeRow: { flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary }, mode: { flex: 1, minHeight: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }, modeActive: { backgroundColor: colors.brandPrimary }, modeText: { color: colors.onSurfaceTertiary, fontWeight: "800" }, modeTextActive: { color: colors.onBrandPrimary },
  dateNav: { flexDirection: "row", alignItems: "center" }, navButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }, dateCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm }, dateTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", textTransform: "capitalize", textAlign: "center" }, todayHint: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", marginTop: 2 },
  list: { gap: spacing.sm }, sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "900", marginTop: spacing.sm }, sectionHint: { color: colors.brandPrimary, fontSize: 10, fontWeight: "700" },
  empty: { padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, alignItems: "center", gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontWeight: "800", fontSize: 17 }, muted: { color: colors.onSurfaceTertiary, fontSize: 12, textAlign: "center" }, primary: { marginTop: spacing.sm, minHeight: 44, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg }, primaryText: { color: colors.onBrandPrimary, fontWeight: "900" },
  modalityGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, modality: { width: "48%", minHeight: 48, flexGrow: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, dot: { width: 9, height: 9, borderRadius: 9 }, modalityText: { flex: 1, color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 12 }, count: { color: colors.onSurface, fontWeight: "900" },
  weekGrid: { gap: spacing.sm }, weekGridDesktop: { flexDirection: "row" }, weekDay: { flex: 1, minHeight: 96, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, selected: { borderColor: colors.brandPrimary }, weekName: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800" }, weekNumber: { color: colors.onSurface, fontSize: 22, fontWeight: "900" }, weekCount: { color: colors.onSurfaceSecondary, fontSize: 10, marginBottom: spacing.xs }, miniBar: { height: 3, borderRadius: radius.pill, marginTop: 3 },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, monthDay: { width: "13.5%", minHeight: 58, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.xs }, monthNumber: { color: colors.onSurface, fontWeight: "800" }, monthDots: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: spacing.sm }, monthDot: { width: 6, height: 6, borderRadius: 6 },
  error: { padding: spacing.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.error, "18"), borderWidth: 1, borderColor: colors.error }, errorText: { color: colors.onSurfaceSecondary }, retry: { color: colors.error, fontWeight: "800", marginTop: spacing.sm },
});
