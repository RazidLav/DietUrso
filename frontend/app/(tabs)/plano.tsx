import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../../src/theme";
import MacroSummary from "../../src/components/MacroSummary";
import MealCard, { iconForMeal } from "../../src/components/MealCard";
import { dayMacrosDefault, getActivePlan, optionMacros, updatePlan } from "../../src/store/planStore";
import { WEEKDAYS_SHORT } from "../../src/utils/date";
import type { Plan } from "../../src/types/plan";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { getCloudStatus, subscribeCloudStatus, syncCloudNow } from "../../src/cloud/cloudSync";
import { resolvePlanView, type DataLoadState } from "../../src/cloud/planViewState";
import { mealTimeForWeekday } from "../../src/nutrition/mealSchedule";
import { ContentContainer, IconButton, PageHeader, PrimaryButton, ResponsiveGrid, SectionHeader } from "../../src/components/DesignSystem";

export default function PlanoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loadState, setLoadState] = useState<DataLoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  const [cloudError, setCloudError] = useState(getCloudStatus().phase === "error" ? getCloudStatus().message : null);
  const loadId = useRef(0);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [copyOpen, setCopyOpen] = useState(false);

  React.useEffect(() => subscribeCloudStatus((status) => { setCloudReady(status.readyForData); setCloudError(status.phase === "error" ? status.message : null); }), []);

  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    const request = ++loadId.current;
    setLoadState((current) => current === "success" ? current : "loading");
    try {
      const next = await getActivePlan();
      if (request !== loadId.current) return;
      setPlan(next);
      setLoadState(next ? "success" : "empty");
      setLoadError(null);
    } catch (cause) {
      if (request === loadId.current) { setLoadState("error"); setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar o plano."); }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (cloudReady) void load();
    }, [cloudReady, load])
  );
  useCloudDataRefresh(load);

  const planView = resolvePlanView(cloudReady, loadState, Boolean(plan), Boolean(cloudError));
  const retry = async () => { if (cloudError) { try { await syncCloudNow(); } catch { /* O estado de erro continua visível. */ } } await load(); };
  if (planView === "loading") {
    return <View style={[styles.empty, { paddingTop: insets.top + spacing.xxl }]}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.emptyDesc}>{cloudReady ? "Carregando seu plano…" : "Preparando sua conta e seus dados…"}</Text></View>;
  }

  if (planView === "error") {
    return <View style={[styles.empty, { paddingTop: insets.top + spacing.xxl }]}><Text style={styles.emptyTitle}>Não foi possível carregar o plano</Text><Text style={styles.emptyDesc}>{loadError ?? cloudError}</Text><Pressable style={styles.emptyCta} onPress={() => void retry()}><Text style={styles.emptyCtaText}>Tentar novamente</Text></Pressable></View>;
  }

  if (planView === "empty" || !plan) {
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
      const sourceTime = mealTimeForWeekday(meal, selectedDay);
      return { ...meal, daysOfWeek: days, scheduleByWeekday: sourceIncluded && sourceTime ? { ...meal.scheduleByWeekday, [targetDay]: sourceTime } : meal.scheduleByWeekday };
    });
    await updatePlan({ ...plan, meals, updatedAt: new Date().toISOString() });
    setCopyOpen(false); setSelectedDay(targetDay); await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="plano-screen">
      {/* Sticky header with day chips */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing.md }]}>
        <ContentContainer style={styles.headerContent} maxWidth={1100}>
          <PageHeader eyebrow="PLANO ALIMENTAR" title={plan.name} description="Escolha o dia e acesse somente a refeição que deseja ajustar." action={<View style={styles.headerActions}><IconButton icon="content-copy" label="Duplicar programação do dia" onPress={() => setCopyOpen(true)} /><PrimaryButton icon="pencil" label="Editar plano" onPress={() => router.push(`/editor/${plan.id}`)} /></View>} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContent} style={styles.chipRow} accessibilityLabel="Dias da semana">
            {WEEKDAYS_SHORT.map((d, i) => {
              const selected = i === selectedDay;
              return <Pressable key={i} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => setSelectedDay(i)} style={[styles.chip, selected && styles.chipSelected]} testID={`day-chip-${i}`}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{d}</Text></Pressable>;
            })}
          </ScrollView>
        </ContentContainer>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl }}
      >
        <ContentContainer style={styles.planContent} maxWidth={1100}>
        <MacroSummary compact kcal={totals.kcal} protein={totals.protein} carbs={totals.carbs} fats={totals.fats} />
        <SectionHeader title="Refeições" description={`${mealsForDay.length} ${mealsForDay.length === 1 ? "refeição" : "refeições"} programadas para ${WEEKDAYS_SHORT[selectedDay]}`} />
        <ResponsiveGrid minItemWidth={300} maxColumns={3} gap={spacing.sm}>
          {mealsForDay.map((meal) => {
            const opt = meal.options[0];
            const mac = opt ? optionMacros(opt) : { kcal: 0, protein: 0, carbs: 0, fats: 0 };
            return (
              <MealCard
                key={meal.id}
                testID={`plan-meal-${meal.id}`}
                title={meal.name}
                subtitle={`${mealTimeForWeekday(meal, selectedDay) ? `${mealTimeForWeekday(meal, selectedDay)} · ` : ""}${meal.options.length} opções · ${opt?.name ?? ""}`}
                icon={iconForMeal(meal.type)}
                kcal={mac.kcal}
                compact
                onPress={() => router.push(`/meal/${plan.id}/${meal.id}`)}
              />
            );
          })}
          {mealsForDay.length === 0 ? (
            <Text style={styles.emptyDesc}>Nenhuma refeição. Toque em Editar para adicionar.</Text>
          ) : null}
        </ResponsiveGrid>
        </ContentContainer>
      </ScrollView>
      <Modal visible={copyOpen} transparent animationType="fade"><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Duplicar {WEEKDAYS_SHORT[selectedDay]}</Text><Text style={styles.modalText}>Escolha o dia que receberá a mesma programação. O histórico já registrado não será alterado.</Text><View style={styles.dayGrid}>{WEEKDAYS_SHORT.map((label, day) => <Pressable key={day} disabled={day === selectedDay} style={[styles.dayTarget, day === selectedDay && { opacity: 0.35 }]} onPress={() => void copyDay(day)}><Text style={styles.dayTargetText}>{label}</Text></Pressable>)}</View><Pressable style={styles.cancelBtn} onPress={() => setCopyOpen(false)}><Text style={styles.cancelText}>Cancelar</Text></Pressable></View></View></Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: colors.surface,
    paddingBottom: spacing.sm,
  },
  headerContent: { gap: spacing.md },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  planContent: { gap: spacing.md },
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
