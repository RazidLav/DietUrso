import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCloudStatus, subscribeCloudStatus } from "../../src/cloud/cloudSync";
import { getTrainingState } from "../../src/store/trainingStore";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from "../../src/training/catalog";
import { strengthVolume } from "../../src/training/calculations";
import type { StrengthSetResult, TrainingState, WorkoutSession } from "../../src/training/types";
import { colors, radius, spacing, withAlpha } from "../../src/theme";

const STATUS = { completed: "Concluído", partial: "Parcial", in_progress: "Em andamento", cancelled: "Cancelado" } as const;

export default function WorkoutHistoryDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<TrainingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  useEffect(() => subscribeCloudStatus((next) => setCloudReady(next.readyForData)), []);
  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    try { setState(await getTrainingState()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível carregar o treino."); }
  }, []);
  useFocusEffect(useCallback(() => { if (cloudReady) void load(); }, [cloudReady, load]));
  const session = state?.sessions.find((item) => item.id === sessionId);
  if (!state || !session) return <View style={styles.loading}><Text style={styles.muted}>{error ?? (state ? "Treino não encontrado." : "Carregando registro…")}</Text>{error ? <Pressable onPress={() => void load()}><Text style={styles.retry}>Tentar novamente</Text></Pressable> : null}</View>;
  const accent = ACTIVITY_COLORS[session.activityType];
  const records = state.personalRecords.filter((record) => record.sessionId === session.id);
  const setCount = session.result.strengthSets.filter((set) => set.status === "completed").length;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}>
    <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()}><MaterialDesignIcons name="arrow-left" size={22} color={colors.onSurface} /></Pressable><View style={[styles.activityIcon, { backgroundColor: withAlpha(accent, 0.15) }]}><MaterialDesignIcons name={ACTIVITY_ICONS[session.activityType] as never} size={22} color={accent} /></View><View style={styles.headerCopy}><Text style={styles.eyebrow}>REGISTRO PRESERVADO</Text><Text style={styles.title}>{session.name}</Text><Text style={styles.meta}>{ACTIVITY_LABELS[session.activityType]} · {formatDate(session.date)}</Text></View><View style={[styles.status, { borderColor: accent }]}><Text style={[styles.statusText, { color: accent }]}>{STATUS[session.status]}</Text></View></View>
    <View style={styles.summary}><Metric icon="timer-outline" label="Duração" value={formatDuration(session.durationMinutes)} /><Metric icon="weight-kilogram" label="Volume" value={session.activityType === "strength" ? `${Math.round(strengthVolume(session)).toLocaleString("pt-BR")} kg·rep` : modalityValue(session)} /><Metric icon="format-list-numbered" label="Séries" value={session.activityType === "strength" ? String(setCount) : "—"} /><Metric icon="medal-outline" label="Recordes" value={String(records.length)} /></View>
    {session.status === "cancelled" ? <View style={styles.notice}><MaterialDesignIcons name="information-outline" size={20} color={colors.onSurfaceSecondary} /><Text style={styles.noticeText}>Sessão cancelada: preservada para consulta, mas excluída das estatísticas, evolução e recordes.</Text></View> : null}
    {records.length ? <View style={styles.prPanel}><MaterialDesignIcons name="trophy-outline" size={25} color={colors.brandTertiary} /><View style={{ flex: 1 }}><Text style={styles.prTitle}>{records.length === 1 ? "Novo recorde pessoal" : `${records.length} novos recordes pessoais`}</Text><Text style={styles.meta}>{records.slice(0, 3).map(recordLabel).join(" · ")}</Text></View></View> : null}
    {session.activityType === "strength" ? <StrengthHistory session={session} /> : <OtherActivityHistory session={session} />}
    {session.notes ? <View style={styles.notes}><Text style={styles.sectionTitle}>ANOTAÇÃO DA EXECUÇÃO</Text><Text style={styles.noteText}>{session.notes}</Text></View> : null}
    <Text style={styles.snapshot}>Esta tela consulta o snapshot da execução. Alterações futuras no plano ou no catálogo não modificam este registro.</Text>
  </ScrollView>;
}

function StrengthHistory({ session }: { session: WorkoutSession }) {
  const groups = useMemo(() => session.result.strengthSets.reduce<Record<string, StrengthSetResult[]>>((result, set) => { (result[set.exercisePlanId] ??= []).push(set); return result; }, {}), [session]);
  const order = session.prescriptionSnapshot.strength?.exercises.map((exercise) => exercise.id) ?? Object.keys(groups);
  return <View style={styles.exerciseList}><Text style={styles.sectionTitle}>EXERCÍCIOS · {order.length}</Text>{order.map((planId) => {
    const sets = groups[planId] ?? [];
    const prescription = session.prescriptionSnapshot.strength?.exercises.find((exercise) => exercise.id === planId);
    const name = sets[0]?.exerciseName ?? prescription?.exerciseSnapshot.name ?? "Exercício";
    const completed = sets.filter((set) => set.status === "completed");
    const volume = completed.reduce((total, set) => total + (set.performedLoad ?? 0) * (set.performedReps ?? 0), 0);
    return <View key={planId} style={styles.exercise}><View style={styles.exerciseHeader}><View style={styles.exerciseThumb}><MaterialDesignIcons name="dumbbell" size={20} color={colors.brandSecondary} /></View><View style={{ flex: 1 }}><Text style={styles.exerciseName}>{name}</Text><Text style={styles.meta}>{completed.length} de {sets.length} séries · {Math.round(volume).toLocaleString("pt-BR")} kg·rep</Text></View></View>
      <View style={styles.tableHeader}><Text style={styles.numberHeader}>SÉRIE</Text><Text style={styles.valueHeader}>CARGA</Text><Text style={styles.valueHeader}>REPS</Text><Text style={styles.smallHeader}>RIR</Text><Text style={styles.smallHeader}>RPE</Text><Text style={styles.stateHeader}>STATUS</Text></View>
      {sets.map((set, index) => <View key={set.id} style={styles.setRow}><Text style={styles.number}>{index + 1}</Text><Text style={styles.value}>{set.performedLoad != null ? `${set.performedLoad} ${set.loadUnit ?? "kg"}` : "—"}</Text><Text style={styles.value}>{set.performedReps ?? "—"}</Text><Text style={styles.small}>{set.rir ?? "—"}</Text><Text style={styles.small}>{set.rpe ?? "—"}</Text><MaterialDesignIcons name={set.status === "completed" ? "check-circle" : set.status === "skipped" ? "minus-circle-outline" : "circle-outline"} size={19} color={set.status === "completed" ? colors.success : colors.onSurfaceTertiary} />{set.notes ? <Text style={styles.setNote}>{set.notes}</Text> : null}</View>)}
      {prescription?.executionNotes ? <Text style={styles.planNote}><Text style={styles.planNoteLabel}>Orientação do plano: </Text>{prescription.executionNotes}</Text> : null}
    </View>;
  })}</View>;
}

function OtherActivityHistory({ session }: { session: WorkoutSession }) {
  const entries: [string, string][] = [];
  const running = session.result.running; const cycling = session.result.cycling; const crossfit = session.result.crossfit;
  if (running) entries.push(["Distância", formatMetric(running.distanceKm, "km")], ["Duração registrada", formatMetric(running.durationMinutes, "min")], ["Ritmo", running.averagePaceSecondsPerKm ? `${Math.floor(running.averagePaceSecondsPerKm / 60)}:${String(Math.round(running.averagePaceSecondsPerKm % 60)).padStart(2, "0")}/km` : "—"], ["RPE", formatMetric(running.rpe)]);
  if (cycling) entries.push(["Distância", formatMetric(cycling.distanceKm, "km")], ["Velocidade média", formatMetric(cycling.averageSpeedKmh, "km/h")], ["Cadência", formatMetric(cycling.averageCadenceRpm, "rpm")], ["RPE", formatMetric(cycling.rpe)]);
  if (crossfit) entries.push(["Tempo final", formatMetric(crossfit.finalTimeSeconds, "s")], ["Rounds", formatMetric(crossfit.rounds)], ["Repetições", formatMetric(crossfit.repetitions)], ["Escala", crossfit.scale?.toUpperCase() ?? "—"]);
  if (session.activityType === "mobility") entries.push(["Movimentos concluídos", String(session.result.mobilityMovements.filter((item) => item.status === "completed").length)], ["Tempo total", formatDuration(session.durationMinutes)]);
  session.result.customFields?.forEach((field) => entries.push([field.label, field.value || "—"]));
  return <View style={styles.other}><Text style={styles.sectionTitle}>RESULTADOS REGISTRADOS</Text><View style={styles.otherGrid}>{entries.map(([label, value]) => <View key={label} style={styles.otherItem}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.otherValue}>{value}</Text></View>)}</View></View>;
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) { return <View style={styles.metric}><MaterialDesignIcons name={icon as never} size={19} color={colors.brandPrimary} /><View><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View></View>; }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short", year: "numeric" }); }
function formatDuration(value?: number) { if (!value) return "—"; const hours = Math.floor(value / 60); const minutes = value % 60; return hours ? `${hours}h ${minutes}min` : `${minutes} min`; }
function formatMetric(value?: number, unit = "") { return value == null ? "—" : `${Math.round(value * 100) / 100}${unit ? ` ${unit}` : ""}`; }
function modalityValue(session: WorkoutSession) { return session.activityType === "running" ? formatMetric(session.result.running?.distanceKm, "km") : session.activityType === "cycling" ? formatMetric(session.result.cycling?.distanceKm, "km") : formatDuration(session.durationMinutes); }
function recordLabel(record: TrainingState["personalRecords"][number]) { const label = record.metric === "max_load" ? "carga" : record.metric === "max_reps" ? "repetições" : record.metric === "exercise_session_volume" ? "volume" : record.metric === "estimated_1rm" ? "1RM estimado" : record.metric.replaceAll("_", " "); return `${record.exerciseName ?? "Cardio"}: ${label} ${Math.round(record.value * 10) / 10} ${record.unit}`; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { width: "100%", maxWidth: 980, alignSelf: "center", gap: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.huge }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.background }, muted: { color: colors.onSurfaceTertiary, textAlign: "center" }, retry: { color: colors.brandPrimary, fontWeight: "900" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary }, activityIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md }, headerCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1 }, title: { color: colors.onSurface, fontSize: 22, lineHeight: 27, fontWeight: "900" }, meta: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, marginTop: 2 }, status: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderRadius: radius.pill }, statusText: { fontSize: 9, fontWeight: "900" },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, metric: { flex: 1, minWidth: 120, flexDirection: "row", alignItems: "center", gap: spacing.sm }, metricLabel: { color: colors.onSurfaceTertiary, fontSize: 9 }, metricValue: { color: colors.onSurface, fontSize: 14, fontWeight: "900" }, notice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, noticeText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 15 }, prPanel: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: withAlpha(colors.brandTertiary, 0.11), borderWidth: 1, borderColor: withAlpha(colors.brandTertiary, 0.35) }, prTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "900", letterSpacing: 1 }, exerciseList: { gap: spacing.md }, exercise: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, exerciseHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, exerciseThumb: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceInteractive }, exerciseName: { color: colors.onSurface, fontSize: 15, fontWeight: "900" }, tableHeader: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 4 }, numberHeader: { width: 38, color: colors.onSurfaceTertiary, fontSize: 7, textAlign: "center" }, valueHeader: { flex: 1, minWidth: 58, color: colors.onSurfaceTertiary, fontSize: 7, textAlign: "center" }, smallHeader: { width: 34, color: colors.onSurfaceTertiary, fontSize: 7, textAlign: "center" }, stateHeader: { width: 42, color: colors.onSurfaceTertiary, fontSize: 7, textAlign: "center" }, setRow: { minHeight: 42, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, borderTopWidth: 1, borderTopColor: colors.divider }, number: { width: 38, color: colors.onSurface, fontWeight: "900", textAlign: "center" }, value: { flex: 1, minWidth: 58, color: colors.onSurface, textAlign: "center", fontVariant: ["tabular-nums"] }, small: { width: 34, color: colors.onSurfaceSecondary, textAlign: "center" }, setNote: { width: "100%", color: colors.onSurfaceTertiary, fontSize: 9, paddingLeft: 42, paddingBottom: spacing.xs }, planNote: { color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 15, paddingTop: spacing.sm }, planNoteLabel: { color: colors.onSurface, fontWeight: "900" },
  other: { gap: spacing.md }, otherGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, otherItem: { width: "46%", minWidth: 145, flexGrow: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, otherValue: { color: colors.onSurface, fontSize: 16, fontWeight: "900" }, notes: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, noteText: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17 }, snapshot: { color: colors.onSurfaceTertiary, fontSize: 9, lineHeight: 14, textAlign: "center" },
});
