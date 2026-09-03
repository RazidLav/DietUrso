import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../../src/theme";
import MacroSummary from "../../src/components/MacroSummary";
import MealCard, { iconForMeal } from "../../src/components/MealCard";
import {
  dayMacrosDefault,
  getActivePlan,
  getChosenOption,
  listConsumption,
  optionMacros,
} from "../../src/store/planStore";
import { todayISO, WEEKDAYS_LONG } from "../../src/utils/date";
import type { ConsumptionEntry, Plan } from "../../src/types/plan";

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!plan) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + spacing.xxl }]}>
        <Text style={styles.emptyTitle}>Nenhum plano ativo</Text>
        <Text style={styles.emptyDesc}>Crie ou ative um plano em Ajustes.</Text>
      </View>
    );
  }

  const today = todayISO();
  const totals = dayMacrosDefault(plan);
  const weekdayName = WEEKDAYS_LONG[new Date().getDay()].toUpperCase();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />
      }
      testID="hoje-screen"
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>HOJE</Text>
        <Text style={styles.weekday}>{weekdayName}</Text>
      </View>

      <View style={styles.section}>
        <MacroSummary kcal={totals.kcal} protein={totals.protein} carbs={totals.carbs} fats={totals.fats} />
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
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  eyebrow: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  weekday: { color: colors.onSurface, fontSize: 26, fontWeight: "800", marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  empty: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  emptyDesc: { color: colors.onSurfaceTertiary, fontSize: 14, marginTop: spacing.sm, textAlign: "center" },
});
