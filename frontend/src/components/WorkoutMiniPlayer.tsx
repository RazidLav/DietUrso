import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { subscribeCloudData } from "../cloud/cloudSync";
import { getTrainingState, pauseTrainingSession } from "../store/trainingStore";
import type { WorkoutSession } from "../training/types";
import { colors, radius, spacing, withAlpha } from "../theme";

function progress(session: WorkoutSession) {
  if (session.activityType === "strength") { const all = session.result.strengthSets; return all.length ? all.filter((item) => item.status !== "pending").length / all.length : 0; }
  if (session.activityType === "mobility") { const all = session.result.mobilityMovements; return all.length ? all.filter((item) => item.status !== "pending").length / all.length : 0; }
  const blocks = session.activityType === "running" ? session.result.running?.completedBlockIds : session.activityType === "cycling" ? session.result.cycling?.completedBlockIds : session.activityType === "crossfit" ? session.result.crossfit?.completedBlockIds : [];
  const planned = session.activityType === "running" ? session.prescriptionSnapshot.running?.blocks.length : session.activityType === "cycling" ? session.prescriptionSnapshot.cycling?.blocks.length : session.activityType === "crossfit" ? session.prescriptionSnapshot.crossfit?.blocks.length : 0;
  return planned ? (blocks?.length ?? 0) / planned : 0;
}

function elapsed(session: WorkoutSession, now: number) { const end = session.isPaused && session.pausedAt ? new Date(session.pausedAt).getTime() : now; return Math.max(0, Math.floor((end - new Date(session.startedAt).getTime()) / 1000)); }
function clock(seconds: number) { return `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

export default function WorkoutMiniPlayer() {
  const pathname = usePathname(); const router = useRouter(); const [session, setSession] = useState<WorkoutSession | null>(null); const [now, setNow] = useState(0);
  const load = useCallback(() => { void getTrainingState().then((state) => { setSession(state.sessions.filter((item) => item.status === "in_progress").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null); setNow(Date.now()); }); }, []);
  useEffect(() => { load(); const unsubscribe = subscribeCloudData(load); const refresh = setInterval(load, 12000); return () => { unsubscribe(); clearInterval(refresh); }; }, [load]);
  useEffect(() => { load(); }, [pathname, load]);
  useEffect(() => { if (!session || session.isPaused) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [session]);
  if (!session || pathname.startsWith(`/treino/${session.id}`)) return null;
  const value = Math.round(progress(session) * 100);
  return <View style={styles.outer} testID="workout-mini-player"><View style={styles.player}><View style={styles.icon}><MaterialDesignIcons name="dumbbell" size={19} color={colors.onBrandPrimary} /></View><Pressable style={styles.copy} onPress={() => router.push(`/treino/${session.id}`)} accessibilityRole="button" accessibilityLabel={`Retomar ${session.name}`}><Text style={styles.eyebrow}>{session.isPaused ? "TREINO PAUSADO" : "TREINO EM ANDAMENTO"}</Text><Text style={styles.name} numberOfLines={1}>{session.name}</Text><View style={styles.track}><View style={[styles.fill, { width: `${value}%` }]} /></View></Pressable><View style={styles.time}><Text style={styles.clock}>{clock(elapsed(session, now))}</Text><Text style={styles.percent}>{value}%</Text></View><Pressable accessibilityRole="button" accessibilityLabel={session.isPaused ? "Continuar treino" : "Pausar treino"} style={styles.control} onPress={async () => { await pauseTrainingSession(session.id, !session.isPaused); load(); }}><MaterialDesignIcons name={session.isPaused ? "play" : "pause"} size={20} color={colors.onSurface} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Voltar ao treino" style={styles.return} onPress={() => router.push(`/treino/${session.id}`)}><MaterialDesignIcons name="arrow-expand-up" size={20} color={colors.onBrandPrimary} /></Pressable></View></View>;
}

const styles = StyleSheet.create({ outer: { flexShrink: 0, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, backgroundColor: colors.surface }, player: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%", maxWidth: 820, alignSelf: "center", padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: withAlpha(colors.brandPrimary, 0.38), backgroundColor: colors.surfaceElevated }, icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.brandPrimary }, copy: { flex: 1, minWidth: 0 }, eyebrow: { color: colors.brandPrimary, fontSize: 7, fontWeight: "900", letterSpacing: 1 }, name: { color: colors.onSurface, fontSize: 12, fontWeight: "900", marginTop: 2 }, track: { height: 3, marginTop: 5, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, fill: { height: "100%", backgroundColor: colors.brandPrimary }, time: { alignItems: "flex-end" }, clock: { color: colors.onSurface, fontSize: 10, fontWeight: "800", fontVariant: ["tabular-nums"] }, percent: { color: colors.onSurfaceTertiary, fontSize: 8, marginTop: 2 }, control: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, return: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brandPrimary } });
