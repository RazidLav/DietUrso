import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from "../training/catalog";
import type { TrainingDayEntry } from "../training/types";
import { colors, radius, spacing } from "../theme";

const STATUS_LABELS: Record<TrainingDayEntry["status"], string> = {
  planned: "Planejada",
  in_progress: "Em andamento",
  completed: "Concluída",
  partial: "Parcial",
  skipped: "Pulada",
  canceled: "Cancelada",
};

export default function TrainingSessionCard({ entry, onPress, onMove }: { entry: TrainingDayEntry; onPress: () => void; onMove?: (direction: -1 | 1) => void }) {
  const accent = ACTIVITY_COLORS[entry.planned.activityType];
  const duration = entry.execution?.durationMinutes ?? entry.planned.estimatedDurationMinutes;
  const action = entry.status === "planned" ? "Iniciar" : entry.status === "in_progress" ? "Continuar" : "Visualizar";
  return (
    <View style={styles.card}>
      <Pressable style={styles.body} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${action} ${entry.planned.name}`}>
        <View style={[styles.icon, { backgroundColor: `${accent}22` }]}><MaterialDesignIcons name={ACTIVITY_ICONS[entry.planned.activityType] as never} size={24} color={accent} /></View>
        <View style={styles.content}>
          <View style={styles.titleRow}><Text style={styles.title} numberOfLines={1}>{entry.planned.name}</Text><Text style={[styles.status, { color: accent }]}>{STATUS_LABELS[entry.status].toUpperCase()}</Text></View>
          <Text style={styles.meta}>{entry.planned.scheduledTime ?? "Sem horário"} · {duration ? `${duration} min` : "Duração livre"} · {ACTIVITY_LABELS[entry.planned.activityType]}</Text>
          <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.round(entry.progress * 100)}%`, backgroundColor: accent }]} /></View>
        </View>
        <View style={styles.action}><Text style={styles.actionText}>{action}</Text><MaterialDesignIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} /></View>
      </Pressable>
      {onMove && entry.status === "planned" ? <View style={styles.moveRow}><Pressable style={styles.move} onPress={() => onMove(-1)} accessibilityLabel="Mover sessão para cima"><MaterialDesignIcons name="arrow-up" size={18} color={colors.onSurfaceSecondary} /></Pressable><Pressable style={styles.move} onPress={() => onMove(1)} accessibilityLabel="Mover sessão para baixo"><MaterialDesignIcons name="arrow-down" size={18} color={colors.onSurfaceSecondary} /></Pressable></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  body: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  title: { flex: 1, color: colors.onSurface, fontWeight: "800", fontSize: 15 },
  status: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  meta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: spacing.xs },
  progress: { height: 4, marginTop: spacing.sm, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.pill },
  action: { alignItems: "center" },
  actionText: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "700" },
  moveRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  move: { width: 38, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm },
});
