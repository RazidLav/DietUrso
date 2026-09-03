import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../src/theme";
import MacroSummary from "../../src/components/MacroSummary";
import MealCard, { iconForMeal } from "../../src/components/MealCard";
import { dayMacrosDefault, getActivePlan, optionMacros } from "../../src/store/planStore";
import { WEEKDAYS_SHORT } from "../../src/utils/date";
import type { Plan } from "../../src/types/plan";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";

export default function PlanoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());

  const load = useCallback(async () => {
    setPlan(await getActivePlan());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!plan) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + spacing.xxl }]}>
        <Text style={styles.emptyTitle}>Nenhum plano ativo</Text>
        <Text style={styles.emptyDesc}>Crie ou ative um plano em Ajustes.</Text>
        <Pressable
          style={styles.emptyCta}
          onPress={() => router.push("/ajustes")}
          testID="empty-go-ajustes-btn"
        >
          <Text style={styles.emptyCtaText}>Ir para Ajustes</Text>
        </Pressable>
      </View>
    );
  }

  const totals = dayMacrosDefault(plan);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="plano-screen">
      {/* Sticky header with day chips */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>MEU PLANO</Text>
            <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
          </View>
          <Pressable
            style={styles.editBtn}
            onPress={() => router.push(`/editor/${plan.id}`)}
            testID="edit-plan-btn"
          >
            <MaterialDesignIcons name="pencil" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.editBtnText}>Editar</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
          style={styles.chipRow}
        >
          {WEEKDAYS_SHORT.map((d, i) => {
            const selected = i === selectedDay;
            return (
              <Pressable
                key={i}
                onPress={() => setSelectedDay(i)}
                style={[styles.chip, selected && styles.chipSelected]}
                testID={`day-chip-${i}`}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{d}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl,
        }}
      >
        <MacroSummary kcal={totals.kcal} protein={totals.protein} carbs={totals.carbs} fats={totals.fats} />
        <Text style={styles.sectionTitle}>Refeições</Text>
        <View style={{ gap: spacing.sm }}>
          {plan.meals.map((meal) => {
            const opt = meal.options[0];
            const mac = opt ? optionMacros(opt) : { kcal: 0, protein: 0, carbs: 0, fats: 0 };
            return (
              <MealCard
                key={meal.id}
                testID={`plan-meal-${meal.id}`}
                title={meal.name}
                subtitle={`${meal.options.length} opções · ${opt?.name ?? ""}`}
                icon={iconForMeal(meal.type)}
                kcal={mac.kcal}
                onPress={() => router.push(`/meal/${plan.id}/${meal.id}`)}
              />
            );
          })}
          {plan.meals.length === 0 ? (
            <Text style={styles.emptyDesc}>Nenhuma refeição. Toque em Editar para adicionar.</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  planName: { color: colors.onSurface, fontSize: 20, fontWeight: "800", marginTop: 2 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  editBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  chipRow: { height: 56 },
  chipRowContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipSelected: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipText: { color: colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 },
  chipTextSelected: { color: colors.onBrandPrimary, fontWeight: "800" },
  sectionTitle: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: spacing.lg,
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
  emptyCta: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  emptyCtaText: { color: colors.onBrandPrimary, fontWeight: "700" },
});
