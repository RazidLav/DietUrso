import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, RefreshControl, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../src/theme";
import MacroSummary from "../../src/components/MacroSummary";
import MealCard, { iconForMeal } from "../../src/components/MealCard";
import {
  addConsumption,
  dayMacrosDefault,
  getActivePlan,
  getChosenOption,
  listConsumption,
  optionMacros,
  removeConsumptionForDayMeal,
} from "../../src/store/planStore";
import { todayISO, WEEKDAYS_LONG } from "../../src/utils/date";
import type { ConsumptionEntry, Plan } from "../../src/types/plan";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";

export default function HojeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionEntry[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const p = await getActivePlan();
    setPlan(p);
    const c = await listConsumption();
    setConsumption(c);
    if (p) {
      const map: Record<string, string> = {};
      for (const meal of p.meals) {
        const chosenId = await getChosenOption(todayISO(), meal.id);
        if (chosenId) map[meal.id] = chosenId;
      }
      setChosen(map);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useCloudDataRefresh(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const today = todayISO();

  const toggleQuickDone = async (mealId: string, optionId?: string) => {
    const already = consumption.find((e) => e.date === today && e.mealId === mealId);
    if (already) {
      await removeConsumptionForDayMeal(today, mealId);
    } else {
      await addConsumption({
        date: today,
        mealId,
        status: "as_planned",
        chosenOptionId: optionId,
      });
    }
    await load();
  };

  if (!plan) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + spacing.xxl }]}>
        <Text style={styles.emptyTitle}>Nenhum plano ativo</Text>
        <Text style={styles.emptyDesc}>Crie ou ative um plano em Ajustes.</Text>
      </View>
    );
  }

  const totals = dayMacrosDefault(plan);
  const weekdayName = WEEKDAYS_LONG[new Date().getDay()].toUpperCase();
  const doneToday = new Set(consumption.filter((e) => e.date === today).map((e) => e.mealId));
  const totalMeals = plan.meals.length;
  const doneCount = plan.meals.filter((m) => doneToday.has(m.id)).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
      }
      testID="hoje-screen"
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>HOJE</Text>
          <Text style={styles.weekday}>{weekdayName}</Text>
        </View>
        <Pressable
          style={styles.statsBtn}
          onPress={() => router.push("/estatisticas")}
          testID="open-stats-btn"
        >
          <MaterialDesignIcons name="chart-line" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <MacroSummary kcal={totals.kcal} protein={totals.protein} carbs={totals.carbs} fats={totals.fats} />
      </View>

      {/* Progress ring / counter */}
      <View style={[styles.section, styles.progressCard]}>
        <View style={styles.progressLeft}>
          <Text style={styles.progressCount} testID="daily-progress-count">
            {doneCount}<Text style={styles.progressTotal}>/{totalMeals}</Text>
          </Text>
          <Text style={styles.progressLabel}>
            {doneCount === totalMeals ? "Dia completo! 🔥" : "refeições concluídas"}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${totalMeals > 0 ? (doneCount / totalMeals) * 100 : 0}%`,
                backgroundColor: doneCount === totalMeals ? colors.brandPrimary : colors.brandSecondary,
              },
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Refeições do dia</Text>
        <View style={{ gap: spacing.sm }}>
          {plan.meals.map((meal) => {
            const chosenOpt = meal.options.find((o) => o.id === chosen[meal.id]) ?? meal.options[0];
            const mac = chosenOpt ? optionMacros(chosenOpt) : { kcal: 0, protein: 0, carbs: 0, fats: 0 };
            const entry = consumption.find((e) => e.date === today && e.mealId === meal.id);
            const status = entry ? entry.status : "planned";
            return (
              <MealCard
                key={meal.id}
                testID={`meal-card-${meal.id}`}
                title={meal.name}
                subtitle={chosenOpt?.name ?? "Sem opções"}
                icon={iconForMeal(meal.type)}
                kcal={mac.kcal}
                status={status}
                onPress={() => router.push(`/meal/${plan.id}/${meal.id}?date=${today}`)}
                onToggleDone={() => toggleQuickDone(meal.id, chosenOpt?.id)}
              />
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  weekday: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginTop: 2 },
  statsBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  progressCard: {
    padding: 0,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  progressLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressCount: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  progressTotal: { color: colors.onSurfaceTertiary, fontSize: 16, fontWeight: "700" },
  progressLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" },
  progressBar: {
    height: 8,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  empty: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  emptyDesc: { color: colors.onSurfaceTertiary, fontSize: 14, marginTop: spacing.sm, textAlign: "center" },
});
