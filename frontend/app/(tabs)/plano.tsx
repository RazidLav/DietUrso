import React, { useCallback, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../src/theme";
import MacroSummary from "../../src/components/MacroSummary";
import MealCard, { iconForMeal } from "../../src/components/MealCard";
import { dayMacrosDefault, getActivePlan, optionMacros, updatePlan } from "../../src/store/planStore";
import { WEEKDAYS_SHORT } from "../../src/utils/date";
import type { Plan } from "../../src/types/plan";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";

export default function PlanoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [copyOpen, setCopyOpen] = useState(false);

  const load = useCallback(async () => {
    setPlan(await getActivePlan());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useCloudDataRefresh(load);

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

  const mealsForDay = plan.meals
    .filter((meal) => !meal.archived && (!meal.daysOfWeek?.length || meal.daysOfWeek.includes(selectedDay)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const totals = dayMacrosDefault({ ...plan, meals: mealsForDay });
  const copyDay = async (targetDay: number) => {
    const meals = plan.meals.map((meal) => {
      if (meal.archived || !meal.daysOfWeek?.length) return meal;
      const sourceIncluded = meal.daysOfWeek.includes(selectedDay);
      const days = sourceIncluded
        ? Array.from(new Set([...meal.daysOfWeek, targetDay])).sort()
        : meal.daysOfWeek.filter((day) => day !== targetDay);
      return { ...meal, daysOfWeek: days };
    });
    await updatePlan({ ...plan, meals, updatedAt: new Date().toISOString() });
    setCopyOpen(false); setSelectedDay(targetDay); await load();
  };

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
          <Pressable style={styles.copyBtn} onPress={() => setCopyOpen(true)} testID="copy-day-btn"><MaterialDesignIcons name="content-copy" size={16} color={colors.onSurface} /></Pressable>
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
          {mealsForDay.map((meal) => {
            const opt = meal.options[0];
            const mac = opt ? optionMacros(opt) : { kcal: 0, protein: 0, carbs: 0, fats: 0 };
            return (
              <MealCard
                key={meal.id}
                testID={`plan-meal-${meal.id}`}
                title={meal.name}
                subtitle={`${meal.suggestedTime ? `${meal.suggestedTime} · ` : ""}${meal.options.length} opções · ${opt?.name ?? ""}`}
                icon={iconForMeal(meal.type)}
                kcal={mac.kcal}
                onPress={() => router.push(`/meal/${plan.id}/${meal.id}`)}
              />
            );
          })}
          {mealsForDay.length === 0 ? (
            <Text style={styles.emptyDesc}>Nenhuma refeição. Toque em Editar para adicionar.</Text>
          ) : null}
        </View>
      </ScrollView>
      <Modal visible={copyOpen} transparent animationType="fade"><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Duplicar {WEEKDAYS_SHORT[selectedDay]}</Text><Text style={styles.modalText}>Escolha o dia que receberá a mesma programação. O histórico já registrado não será alterado.</Text><View style={styles.dayGrid}>{WEEKDAYS_SHORT.map((label, day) => <Pressable key={day} disabled={day === selectedDay} style={[styles.dayTarget, day === selectedDay && { opacity: 0.35 }]} onPress={() => void copyDay(day)}><Text style={styles.dayTargetText}>{label}</Text></Pressable>)}</View><Pressable style={styles.cancelBtn} onPress={() => setCopyOpen(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable></View></View></Modal>
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
  copyBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
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
  overlay: { flex: 1, backgroundColor: "#000A", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modal: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" }, modalText: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18 },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, dayTarget: { minWidth: 58, flexGrow: 1, alignItems: "center", padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md }, dayTargetText: { color: colors.onBrandPrimary, fontWeight: "800" },
  cancelBtn: { alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }, cancelText: { color: colors.onSurface, fontWeight: "700" },
});
