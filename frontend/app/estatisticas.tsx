import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../src/theme";
import { getActivePlan, listConsumption } from "../src/store/planStore";
import { computeStats, type Stats } from "../src/utils/stats";
import { WEEKDAYS_SHORT } from "../src/utils/date";
import type { Plan } from "../src/types/plan";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";

const EMPTY_STATS: Stats = {
  totalMeals: 0,
  totalAsPlanned: 0,
  totalModified: 0,
  daysActive: 0,
  daysComplete: 0,
  currentStreak: 0,
  bestStreak: 0,
  last7: [],
};

export default function EstatisticasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  const load = useCallback(async () => {
    const p = await getActivePlan();
    const entries = await listConsumption();
    setPlan(p);
    setStats(computeStats(entries, p));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useCloudDataRefresh(load);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="estatisticas-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} testID="stats-back-btn">
            <MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PROGRESSO</Text>
            <Text style={styles.title}>Estatísticas</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140, gap: spacing.md }}>
        {/* Streak hero */}
        <View style={styles.streakCard} testID="streak-card">
          <View style={styles.flameWrap}>
            <MaterialDesignIcons name="fire" size={42} color={colors.brandTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakLabel}>SEQUÊNCIA ATUAL</Text>
            <View style={styles.streakRow}>
              <Text style={styles.streakValue} testID="current-streak">{stats.currentStreak}</Text>
              <Text style={styles.streakUnit}>
                {stats.currentStreak === 1 ? "dia" : "dias"}
              </Text>
            </View>
            <Text style={styles.streakSub}>
              {stats.currentStreak === 0 && stats.bestStreak > 0
                ? "O urso deu uma cochilada. Bora começar de novo? 💤"
                : `Melhor: ${stats.bestStreak} ${stats.bestStreak === 1 ? "dia" : "dias"}`}
            </Text>
          </View>
        </View>

        {/* Counters grid */}
        <View style={styles.grid}>
          <CounterCard
            icon="silverware-fork-knife"
            value={stats.totalMeals}
            label="refeições registradas"
            color={colors.brandPrimary}
            testID="stat-total-meals"
          />
          <CounterCard
            icon="calendar-check"
            value={stats.daysComplete}
            label="dias completos"
            color={colors.brandSecondary}
            testID="stat-days-complete"
          />
          <CounterCard
            icon="check-circle-outline"
            value={stats.totalAsPlanned}
            label="conforme o plano"
            color={colors.brandPrimary}
            testID="stat-as-planned"
          />
          <CounterCard
            icon="pencil-circle-outline"
            value={stats.totalModified}
            label="com alteração"
            color={colors.brandTertiary}
            testID="stat-modified"
          />
        </View>

        {/* Last 7 days chart */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Últimos 7 dias</Text>
          <Text style={styles.chartSub}>
            Refeições registradas por dia{plan?.meals.length ? ` (meta: ${plan.meals.length})` : ""}
          </Text>
          <View style={styles.barsRow}>
            {stats.last7.map((d) => {
              const heightPct = d.total > 0 ? Math.min(d.count / d.total, 1) : 0;
              const full = d.total > 0 && d.count >= d.total;
              const dayOfWeek = new Date(d.date + "T00:00:00").getDay();
              return (
                <View key={d.date} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.max(heightPct * 100, 4)}%`,
                          backgroundColor: full ? colors.brandPrimary : colors.brandSecondary,
                          opacity: heightPct > 0 ? 1 : 0.3,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{WEEKDAYS_SHORT[dayOfWeek][0]}</Text>
                  <Text style={styles.barValue}>{d.count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {stats.totalMeals === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialDesignIcons name="chart-line" size={32} color={colors.onSurfaceTertiary} />
            <Text style={styles.emptyText}>
              Marque suas refeições em Hoje para ver o progresso acumular aqui.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CounterCard({
  icon,
  value,
  label,
  color,
  testID,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
  testID?: string;
}) {
  return (
    <View style={styles.counter} testID={testID}>
      <View style={[styles.counterIcon, { backgroundColor: color + "22" }]}>
        <MaterialDesignIcons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  streakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flameWrap: {
    width: 64, height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary + "22",
    alignItems: "center", justifyContent: "center",
  },
  streakLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  streakRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, marginTop: 2 },
  streakValue: { color: colors.onSurface, fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  streakUnit: { color: colors.onSurfaceTertiary, fontSize: 14, fontWeight: "700" },
  streakSub: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  counter: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  counterIcon: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  counterValue: { color: colors.onSurface, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  counterLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },
  chartCard: {
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  chartTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  chartSub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: -8 },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    gap: spacing.xs,
  },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: {
    width: "100%",
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: radius.sm },
  barLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  barValue: { color: colors.onSurface, fontSize: 11, fontWeight: "800" },
  emptyBox: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center" },
});
