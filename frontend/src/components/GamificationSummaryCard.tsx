import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GamificationSummary } from "../gamification/types";
import { STREAK_MILESTONES } from "../gamification/config";
import { colors, radius, spacing } from "../theme";

export default function GamificationSummaryCard({
  summary,
  onPress,
}: {
  summary: GamificationSummary;
  onPress: () => void;
}) {
  const nextStreak = STREAK_MILESTONES.find((milestone) => milestone.days > summary.context.currentStreak);
  return (
    <Pressable style={styles.card} onPress={onPress} testID="gamification-summary-card">
      <View style={styles.topRow}>
        <View style={styles.levelBadge}>
          <MaterialDesignIcons name="star-four-points" size={20} color={colors.onBrandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{summary.title}</Text>
          <Text style={styles.level}>Nível {summary.level}</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={22} color={colors.onSurfaceTertiary} />
      </View>

      <View style={styles.metrics}>
        <Metric icon="fire" value={`${summary.context.currentStreak}`} label="sequência" color={colors.brandTertiary} />
        <View style={styles.divider} />
        <Metric icon="trophy" value={`${summary.unlockedCount}/${summary.totalAchievements}`} label="conquistas" color="#FFD166" />
        <View style={styles.divider} />
        <Metric icon="star" value={`${summary.state.totalXp}`} label="XP total" color={colors.brandPrimary} />
      </View>

      <View style={styles.xpRow}>
        <Text style={styles.xpText}>{summary.xpIntoLevel} / {summary.xpForNextLevel} XP</Text>
        <Text style={styles.xpHint}>próximo nível</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(summary.progress * 100, 2)}%` }]} />
      </View>
      {summary.context.currentStreak === 0 && summary.context.bestStreak > 0 ? (
        <Text style={styles.restMessage}>O urso deu uma cochilada 💤 Bora começar uma nova sequência?</Text>
      ) : nextStreak ? (
        <Text style={styles.milestone}>🔥 Próximo marco: {nextStreak.title} · {nextStreak.days} dias</Text>
      ) : null}
    </Pressable>
  );
}

function Metric({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.metric}>
      <MaterialDesignIcons name={icon as any} size={16} color={color} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary + "66",
    padding: spacing.lg,
    gap: spacing.md,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  levelBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  level: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", marginTop: 2 },
  metrics: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  metric: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { color: colors.onSurface, fontWeight: "800", fontSize: 13 },
  metricLabel: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "600" },
  divider: { width: 1, height: 28, backgroundColor: colors.borderStrong },
  xpRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  xpText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "800" },
  xpHint: { color: colors.onSurfaceTertiary, fontSize: 10 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  restMessage: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, textAlign: "center" },
  milestone: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, textAlign: "center" },
});
