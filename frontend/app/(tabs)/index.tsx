import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AchievementUnlockModal from "../../src/components/AchievementUnlockModal";
import GamificationSummaryCard from "../../src/components/GamificationSummaryCard";
import MacroSummary from "../../src/components/MacroSummary";
import { iconForMeal } from "../../src/components/MealCard";
import TrainingSummaryCard from "../../src/components/TrainingSummaryCard";
import WaterCard from "../../src/components/WaterCard";
import { AreaDashboardHeader } from "../../src/components/AreaDashboard";
import { getCloudStatus, subscribeCloudStatus, syncCloudNow } from "../../src/cloud/cloudSync";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { dismissAchievement, evaluateGamification, getPendingAchievement } from "../../src/gamification/engine";
import type { AchievementDefinition, GamificationSummary } from "../../src/gamification/types";
import type { HydrationSummary } from "../../src/hydration/types";
import { createPlanConsumption, dayConsumedNutrients } from "../../src/nutrition/records";
import { mealTimeForWeekday, resolveMealScheduleFocus, scheduledMealsForDate } from "../../src/nutrition/mealSchedule";
import { inferredMealFocusTime, prioritizeCurrentTimelineItem, resolveCurrentTimelineId } from "../../src/home/timeline";
import { addHydrationRecord, getHydrationSummary } from "../../src/store/hydrationStore";
import { listFoodCatalog } from "../../src/store/nutritionStore";
import { addConsumption, dayMacrosDefault, getActivePlan, getChosenOption, listConsumption, removeConsumptionForDayMeal } from "../../src/store/planStore";
import { getTrainingState, prepareTrainingRange } from "../../src/store/trainingStore";
import { dayEntries } from "../../src/training/calculations";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from "../../src/training/catalog";
import type { TrainingDayEntry } from "../../src/training/types";
import { areaColors, colors, layout, radius, spacing, withAlpha } from "../../src/theme";
import type { ConsumptionEntry, Plan } from "../../src/types/plan";
import { todayISO } from "../../src/utils/date";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";
import { useResponsiveLayout } from "../../src/responsive";

type SectionKey = "diet" | "water" | "training" | "game";
type DataLoadState = "idle" | "loading" | "success" | "error";

type TimelineItem = {
  id: string;
  kind: "meal" | "training" | "exercise";
  title: string;
  subtitle: string;
  time: string;
  sortTime: string;
  focusTime?: string;
  icon: string;
  accent: string;
  completed: boolean;
  active?: boolean;
  onPress: () => void;
  onToggle?: () => void;
};

const EMPTY_ERRORS: Record<SectionKey, string | null> = { diet: null, water: null, training: null, game: null };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, isDesktop: desktop, isPhone } = useResponsiveLayout();
  const stackHero = width < 340;
  const router = useRouter();
  const selectedDate = todayISO();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionEntry[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [water, setWater] = useState<HydrationSummary | null>(null);
  const [trainingEntries, setTrainingEntries] = useState<TrainingDayEntry[]>([]);
  const [pendingAchievement, setPendingAchievement] = useState<AchievementDefinition | null>(null);
  const [loadState, setLoadState] = useState<DataLoadState>("idle");
  const [sectionErrors, setSectionErrors] = useState(EMPTY_ERRORS);
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  const [refreshing, setRefreshing] = useState(false);
  const [savingWater, setSavingWater] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());
  const loadId = useRef(0);
  const waterLock = useRef(false);

  React.useEffect(() => subscribeCloudStatus((status) => setCloudReady(status.readyForData)), []);
  React.useEffect(() => {
    const timer = setInterval(() => setClockNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    const request = ++loadId.current;
    setLoadState((current) => current === "success" ? current : "loading");
    const selectedAt = localDate(selectedDate);
    const nextErrors = { ...EMPTY_ERRORS };

    const [dietResult, waterResult, trainingResult, gameResult] = await Promise.allSettled([
      Promise.all([getActivePlan(), listConsumption()]),
      getHydrationSummary(selectedAt),
      (async () => {
        await prepareTrainingRange(selectedDate, selectedDate);
        return getTrainingState();
      })(),
      Promise.all([evaluateGamification(), selectedDate === todayISO() ? getPendingAchievement() : Promise.resolve(null)]),
    ]);
    if (request !== loadId.current) return;

    let fulfilled = 0;
    if (dietResult.status === "fulfilled") {
      fulfilled += 1;
      const [currentPlan, entries] = dietResult.value;
      setPlan(currentPlan); setConsumption(entries);
      const map: Record<string, string> = {};
      if (currentPlan) {
        const selected = await Promise.all(currentPlan.meals.map((meal) => getChosenOption(selectedDate, meal.id)));
        if (request !== loadId.current) return;
        currentPlan.meals.forEach((meal, index) => { if (selected[index]) map[meal.id] = selected[index]!; });
      }
      setChosen(map);
    } else nextErrors.diet = "Não foi possível carregar a alimentação.";

    if (waterResult.status === "fulfilled") { fulfilled += 1; setWater(waterResult.value); }
    else nextErrors.water = "A hidratação não respondeu agora.";

    if (trainingResult.status === "fulfilled") {
      fulfilled += 1;
      setTrainingEntries(dayEntries(trainingResult.value, selectedDate));
    } else nextErrors.training = "Não foi possível carregar os treinos.";

    if (gameResult.status === "fulfilled") {
      fulfilled += 1; setGamification(gameResult.value[0]); setPendingAchievement(gameResult.value[1]);
    } else nextErrors.game = "As conquistas estão temporariamente indisponíveis.";

    setSectionErrors(nextErrors);
    setLoadState(fulfilled ? "success" : "error");
  }, [selectedDate]);

  useFocusEffect(useCallback(() => { if (cloudReady) void load(); }, [cloudReady, load]));
  useCloudDataRefresh(load);

  const onRefresh = async () => { setRefreshing(true); try { await syncCloudNow().catch(() => undefined); await load(); } finally { setRefreshing(false); } };

  const toggleQuickDone = async (mealId: string, optionId?: string) => {
    const already = consumption.find((entry) => entry.date === selectedDate && entry.mealId === mealId);
    if (already) await removeConsumptionForDayMeal(selectedDate, mealId);
    else {
      const meal = plan?.meals.find((candidate) => candidate.id === mealId);
      const option = meal?.options.find((candidate) => candidate.id === optionId) ?? meal?.options[0];
      if (plan && meal && option) {
        const current = new Date();
        const clock = `${String(current.getHours()).padStart(2, "0")}:${String(current.getMinutes()).padStart(2, "0")}`;
        await addConsumption(createPlanConsumption({ plan, meal, option, date: selectedDate, actualAt: new Date(`${selectedDate}T${clock}:00`).toISOString(), catalog: await listFoodCatalog() }));
      }
    }
    await load();
  };

  const handleWater = async () => {
    if (waterLock.current) return;
    waterLock.current = true; setSavingWater(true);
    try {
      const occurredAt = selectedDate === todayISO() ? new Date().toISOString() : localDate(selectedDate).toISOString();
      await addHydrationRecord({ amountMl: 250, source: "quick", occurredAt, idempotencyKey: `home-250:${selectedDate}:${Date.now()}` });
      await load();
    } finally { waterLock.current = false; setSavingWater(false); }
  };

  const handleDismissAchievement = async () => {
    if (!pendingAchievement) return;
    await dismissAchievement(pendingAchievement.id); setPendingAchievement(await getPendingAchievement());
  };

  const selected = localDate(selectedDate);
  const today = selectedDate === todayISO();
  const dayMeals = plan?.meals.filter((meal) => !meal.archived && (!meal.daysOfWeek?.length || meal.daysOfWeek.includes(selected.getDay()))).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) ?? [];
  const totals = plan ? dayMacrosDefault({ ...plan, meals: dayMeals }) : null;
  const consumedTotals = dayConsumedNutrients(consumption, selectedDate);
  const doneToday = new Set(consumption.filter((entry) => entry.date === selectedDate && entry.status !== "off_plan").map((entry) => entry.mealId));
  const doneCount = dayMeals.filter((meal) => doneToday.has(meal.id)).length;
  const scheduledMeals = plan ? scheduledMealsForDate(plan, consumption, selectedDate, today ? new Date() : new Date(`${selectedDate}T00:00:00`), chosen) : [];
  const nextMeal = resolveMealScheduleFocus(scheduledMeals);
  const firstName = cloudName(getCloudStatus().email);
  const loading = loadState === "idle" || loadState === "loading" || !cloudReady;
  const completedTraining = trainingEntries.filter((entry) => entry.status === "completed").length;
  const totalActivities = dayMeals.length + trainingEntries.length;
  const completedActivities = doneCount + completedTraining;
  const dailyProgress = totalActivities ? Math.round((completedActivities / totalActivities) * 100) : 0;
  const focusTraining = trainingEntries.find((entry) => entry.status === "in_progress") ?? trainingEntries.find((entry) => entry.status !== "completed") ?? trainingEntries[0];
  const openTraining = (entry: TrainingDayEntry) => {
    if (entry.execution?.id && entry.status === "in_progress") router.push(`/treino/${entry.execution.id}` as never);
    else router.push(`/treino-planejado/${entry.planned.id}` as never);
  };
  const timelineItems: TimelineItem[] = [
    ...dayMeals.map((meal) => {
      const option = meal.options.find((candidate) => candidate.id === chosen[meal.id]) ?? meal.options[0];
      const plannedTime = mealTimeForWeekday(meal, selected.getDay());
      const focusTime = plannedTime ?? inferredMealFocusTime(meal.type);
      const entry = consumption.find((candidate) => candidate.date === selectedDate && candidate.mealId === meal.id);
      return {
        id: `meal-${meal.id}`,
        kind: "meal" as const,
        title: meal.name,
        subtitle: option?.name ?? "Escolha uma opção",
        time: plannedTime || "Livre",
        sortTime: focusTime || "99:99",
        focusTime,
        icon: iconForMeal(meal.type),
        accent: colors.brandTertiary,
        completed: Boolean(entry && entry.status !== "skipped"),
        onPress: () => plan && router.push(`/meal/${plan.id}/${meal.id}?date=${selectedDate}`),
        onToggle: () => void toggleQuickDone(meal.id, option?.id),
      };
    }),
    ...trainingEntries.flatMap((entry) => {
      const baseTime = entry.planned.scheduledTime || "99:98";
      const sessionItem: TimelineItem = {
        id: `training-${entry.planned.id}`,
        kind: "training",
        title: entry.planned.name,
        subtitle: `${ACTIVITY_LABELS[entry.planned.activityType]}${entry.planned.estimatedDurationMinutes ? ` · ${entry.planned.estimatedDurationMinutes} min` : ""}`,
        time: entry.planned.scheduledTime || "Livre",
        sortTime: `${baseTime}:000`,
        focusTime: entry.planned.scheduledTime,
        icon: ACTIVITY_ICONS[entry.planned.activityType],
        accent: ACTIVITY_COLORS[entry.planned.activityType],
        completed: entry.status === "completed",
        active: entry.status === "in_progress",
        onPress: () => openTraining(entry),
      };
      const exercises: TimelineItem[] = (entry.planned.prescriptionSnapshot.strength?.exercises ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((exercise, index) => {
          const results = entry.execution?.result.strengthSets.filter((set) => set.exercisePlanId === exercise.id) ?? [];
          const completed = results.length > 0 && results.every((set) => set.status !== "pending");
          return {
            id: `training-exercise-${entry.planned.id}-${exercise.id}`,
            kind: "exercise",
            title: exercise.exerciseSnapshot.name,
            subtitle: `${entry.planned.name} · ${exercise.sets.length} ${exercise.sets.length === 1 ? "série" : "séries"}`,
            time: "Exercício",
            sortTime: `${baseTime}:${String(index + 1).padStart(3, "0")}`,
            icon: "dumbbell",
            accent: ACTIVITY_COLORS.strength,
            completed,
            onPress: () => openTraining(entry),
          };
        });
      return [sessionItem, ...exercises];
    }),
  ].sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  const currentTimelineId = resolveCurrentTimelineId(timelineItems, today, clockNow);
  const orderedTimelineItems = prioritizeCurrentTimelineItem(timelineItems, currentTimelineId);

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />} testID="home-screen">
        <AreaDashboardHeader
          title="UrsoFit"
          subtitle={`${dayGreeting()}, ${firstName} · ${formatLongDate(selected)}`}
          accent={areaColors.home}
          onSettings={() => router.push("/ajustes")}
          settingsLabel="Abrir configurações do UrsoFit"
          actions={[
            { id: "meal", label: "Registrar refeição", hint: "Abra a dieta e registre o que comeu", icon: "silverware-fork-knife", onPress: () => router.push("/alimentacao") },
            { id: "water", label: "Adicionar água", hint: "Registre sua hidratação", icon: "water-plus-outline", onPress: () => router.push("/hidratacao") },
            { id: "training", label: "Iniciar treino", hint: "Escolha ou crie uma sessão", icon: "dumbbell", onPress: () => router.push(`/treino-novo?date=${selectedDate}` as never) },
          ]}
        />

        <View style={[styles.overview, desktop && styles.overviewDesktop]} testID="home-overview-columns">
          <View style={[styles.focusColumn, desktop && styles.focusColumnDesktop]}>
            <View style={[styles.hero, stackHero && styles.heroStacked, desktop && styles.heroDesktop]} testID="home-main-highlight">
              <Pressable style={styles.heroCopy} onPress={() => router.push("/treinos")} accessibilityRole="button" testID="home-highlight-copy">
                <View style={styles.featureTop}><Text style={styles.heroEyebrow}>PLANO DO DIA</Text><MaterialDesignIcons name="link-variant" size={17} color="#FFF8EE" /></View>
                <Text style={styles.heroTitle}>{timelineItems.length ? `${timelineItems.length} atividades hoje` : "Monte sua rotina"}</Text>
                <View style={styles.featureSchedule}>
                  {orderedTimelineItems.slice(0, 2).map((item) => <View key={item.id} style={styles.featureScheduleRow}><View style={[styles.featureScheduleIcon, { backgroundColor: withAlpha("#FFFFFF", 0.18) }]}><MaterialDesignIcons name={item.icon as never} size={15} color="#FFF8EE" /></View><View style={{ flex: 1 }}><Text style={styles.featureScheduleTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.featureScheduleTime}>{item.time}</Text></View><View style={[styles.featureStatusDot, item.completed && styles.featureStatusDone]} /></View>)}
                  {!timelineItems.length ? <><View style={styles.featureEmptyLine} /><View style={[styles.featureEmptyLine, { width: "68%" }]} /></> : null}
                </View>
              </Pressable>

              <Pressable style={styles.heroArtwork} onPress={() => focusTraining ? openTraining(focusTraining) : router.push(`/treino-novo?date=${selectedDate}` as never)} accessibilityRole="button" testID="home-highlight-artwork">
                <Image source={require("../../assets/images/home-progress-v2.png")} style={styles.heroMascot} resizeMode="contain" accessibilityLabel="Mascote UrsoFit celebrando o progresso" />
                <Text style={styles.moveDate}>{formatShortDate(selected)}</Text>
                <Text style={styles.moveEyebrow}>{focusTraining?.status === "in_progress" ? "CONTINUE AGORA" : "MOVIMENTO DO DIA"}</Text>
                <Text style={styles.moveTitle} numberOfLines={3}>{focusTraining?.planned.name ?? "Comece uma atividade"}</Text>
                <View style={styles.moveAction}><Text style={styles.moveActionText}>{focusTraining ? (focusTraining.status === "in_progress" ? "Continuar" : "Iniciar") : "Adicionar"}</Text><View style={styles.movePlay}><MaterialDesignIcons name={focusTraining ? "play" : "plus"} size={18} color="#EAF0FF" /></View></View>
              </Pressable>
            </View>

            <Pressable style={styles.dailyProgressCard} onPress={() => router.push("/alimentacao")} accessibilityRole="button" accessibilityLabel="Abrir plano alimentar">
              <View style={styles.dailyProgressIcon}><MaterialDesignIcons name="food-apple-outline" size={24} color={colors.onBrandPrimary} /></View>
              <View style={styles.dailyProgressCopy}><Text style={styles.dailyProgressTitle}>Seu dia</Text><Text style={styles.dailyProgressText}>{totalActivities ? `${completedActivities} de ${totalActivities} atividades concluídas` : "Adicione refeições ou treinos ao seu dia"}</Text><View style={styles.dailyProgressTrack}><View style={[styles.dailyProgressFill, { width: `${dailyProgress}%` }]} /></View></View>
              <View style={styles.progressRing}><Text style={styles.progressRingValue}>{dailyProgress}%</Text></View>
            </Pressable>

            <View style={styles.timelineSection}>
              <SectionTitle title="O que temos pra hoje" action="Ver agenda" onPress={() => router.push("/treinos")} />
              {loading && !timelineItems.length ? <SkeletonCard height={220} /> : orderedTimelineItems.length ? <View style={styles.timelineList}>{orderedTimelineItems.map((item, index) => <TimelineRow key={item.id} item={item} current={item.id === currentTimelineId} last={index === orderedTimelineItems.length - 1} />)}</View> : <View style={styles.timelineEmpty}><MaterialDesignIcons name="calendar-blank-outline" size={25} color={colors.brandPrimary} /><View style={{ flex: 1 }}><Text style={styles.timelineEmptyTitle}>Seu dia está livre</Text><Text style={styles.timelineEmptyText}>Adicione uma refeição ou sessão quando quiser.</Text></View><Pressable style={styles.compactAdd} onPress={() => router.push(`/treino-novo?date=${selectedDate}` as never)}><MaterialDesignIcons name="plus" size={18} color={colors.onBrandPrimary} /></Pressable></View>}
            </View>
          </View>

          <View style={[styles.dashboard, !isPhone && styles.dashboardWide, desktop && styles.dashboardDesktop]}>
            <View style={[styles.column, !isPhone && styles.columnWide, desktop && styles.columnDesktop]}>
              <SectionTitle title="Alimentação" action="Abrir dieta" onPress={() => router.push("/alimentacao")} />
              {loading && !plan ? <SkeletonCard height={210} /> : sectionErrors.diet ? <ErrorCard message={sectionErrors.diet} onRetry={load} /> : plan && totals ? <><MacroSummary compact title={today ? "CONSUMIDO HOJE" : "CONSUMIDO NO DIA"} kcal={consumedTotals.kcal} protein={consumedTotals.protein} carbs={consumedTotals.carbs} fats={consumedTotals.fats} fiber={consumedTotals.fiber} subtitle={nextMeal ? `Próxima: ${nextMeal.meal.name} · meta ${Math.round(totals.kcal)} kcal` : `Meta: ${Math.round(totals.kcal)} kcal · ${doneCount}/${dayMeals.length} refeições`} /><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${dayMeals.length ? Math.min(100, (doneCount / dayMeals.length) * 100) : 0}%` }]} /></View></> : <EmptyCard icon="food-apple-outline" title="Nenhum plano alimentar ativo" text="Crie ou ative um plano para acompanhar o dia." action="Ir para planos" onPress={() => router.push("/ajustes")} />}
            </View>

            <View style={[styles.column, !isPhone && styles.columnWide, desktop && styles.columnDesktop]}>
              <SectionTitle title="Hidratação" action="Abrir" onPress={() => router.push("/hidratacao")} />
              {loading && !water ? <SkeletonCard height={210} /> : sectionErrors.water ? <ErrorCard message={sectionErrors.water} onRetry={load} /> : water ? <WaterCard summary={water} onQuickAdd={handleWater} onPress={() => router.push("/hidratacao")} saving={savingWater} /> : null}
            </View>

            <View style={[styles.column, !isPhone && styles.columnWide, desktop && styles.columnDesktop]}>
              <SectionTitle title="Treinos" action="Abrir" onPress={() => router.push("/treinos")} />
              {loading && !trainingEntries.length ? <SkeletonCard height={180} /> : sectionErrors.training ? <ErrorCard message={sectionErrors.training} onRetry={load} /> : <TrainingSummaryCard entries={trainingEntries} onPress={() => router.push("/treinos")} />}
            </View>

            <View style={[styles.column, !isPhone && styles.columnWide, desktop && styles.columnDesktop]}>
              <SectionTitle title="Conquistas" action="Ver todas" onPress={() => router.push("/conquistas")} />
              {loading && !gamification ? <SkeletonCard height={220} /> : sectionErrors.game ? <ErrorCard message={sectionErrors.game} onRetry={load} /> : gamification ? <GamificationSummaryCard summary={gamification} onPress={() => router.push("/conquistas")} /> : null}
            </View>
          </View>
        </View>
      </ScrollView>
      <AchievementUnlockModal achievement={pendingAchievement} onDismiss={handleDismissAchievement} />
    </>
  );
}

function TimelineRow({ item, current, last }: { item: TimelineItem; current: boolean; last: boolean }) {
  return <View style={styles.timelineRow}>
    <View style={styles.timelineRail}><View style={[styles.timelineDot, { borderColor: item.accent }, item.completed && { backgroundColor: item.accent }]}>{item.completed ? <MaterialDesignIcons name="check" size={12} color={colors.surface} /> : null}</View>{last ? null : <View style={styles.timelineLine} />}</View>
    <Pressable style={styles.timelineBody} onPress={item.onPress} accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`}>
      <View style={[styles.timelineIcon, { backgroundColor: withAlpha(item.accent, 0.14) }]}><MaterialDesignIcons name={item.icon as never} size={18} color={item.accent} /></View>
      <View style={styles.timelineCopy}><Text style={[styles.timelineTitle, item.completed && styles.timelineTitleDone]} numberOfLines={1}>{item.title}</Text><Text style={styles.timelineSubtitle} numberOfLines={1}>{item.subtitle}</Text></View>
      <Text style={styles.timelineTime}>{item.time}</Text>
    </Pressable>
    <Pressable style={[styles.timelineAction, current && styles.timelineActionCurrent, item.completed && styles.timelineActionDone]} onPress={item.onToggle ?? item.onPress} accessibilityRole="button" accessibilityLabel={item.completed ? `${item.title} concluída` : `${item.kind === "meal" ? "Registrar" : "Abrir"} ${item.title}`}>
      {item.completed ? <MaterialDesignIcons name="check" size={17} color={colors.onSuccess} /> : current ? <Text style={styles.timelineActionCurrentText}>AGORA</Text> : <MaterialDesignIcons name={item.kind === "meal" ? "check" : "chevron-right"} size={17} color={colors.onSurfaceSecondary} />}
    </Pressable>
  </View>;
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress} accessibilityLabel={action}><Text style={styles.sectionAction}>{action}</Text></Pressable></View>;
}

function SkeletonCard({ height }: { height: number }) { return <View style={[styles.skeleton, { height }]} accessibilityLabel="Carregando"><View style={styles.skeletonIcon} /><View style={[styles.skeletonLine, { width: "48%" }]} /><View style={[styles.skeletonLine, { width: "78%" }]} /><View style={[styles.skeletonBlock, { flex: 1 }]} /></View>; }

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) { return <View style={styles.stateCard} accessibilityRole="alert"><MaterialDesignIcons name="cloud-alert-outline" size={27} color={colors.error} /><Text style={styles.stateTitle}>Esta área não carregou</Text><Text style={styles.stateText}>{message}</Text><Pressable style={styles.retry} onPress={onRetry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>; }

function EmptyCard({ icon, title, text, action, onPress }: { icon: string; title: string; text: string; action: string; onPress: () => void }) { return <View style={styles.stateCard}><MaterialDesignIcons name={icon as never} size={28} color={colors.brandPrimary} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{text}</Text><Pressable style={styles.retry} onPress={onPress}><Text style={styles.retryText}>{action}</Text></Pressable></View>; }

function localDate(iso: string) { const [year, month, day] = iso.split("-").map(Number); return new Date(year, month - 1, day, 12, 0, 0); }
function dayGreeting() { const hour = new Date().getHours(); return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"; }
function cloudName(email: string | null) { const raw = email?.split("@")[0]?.split(/[._-]/)[0] || "amigo"; return raw.charAt(0).toUpperCase() + raw.slice(1); }
function formatLongDate(date: Date) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date); }
function formatShortDate(date: Date) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", ""); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: layout.editorMax, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg },
  topbar: { gap: spacing.md },
  topbarDesktop: { flexDirection: "row", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerDesktop: { flex: 0.78, minWidth: 360 },
  avatar: { width: 52, height: 52, borderRadius: 18, overflow: "hidden", borderWidth: 2, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary },
  avatarImage: { width: "100%", height: "100%" },
  greeting: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  greetingMessage: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600", marginTop: 2 },
  headerDate: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3, textTransform: "capitalize" },
  iconButton: { position: "relative", width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  notificationDot: { position: "absolute", right: 9, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary, borderWidth: 2, borderColor: colors.surfaceSecondary },
  weekWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  weekWrapWide: { width: "100%", maxWidth: 680, alignSelf: "flex-start" },
  weekWrapDesktop: { flex: 1.22, maxWidth: 760 },
  weekArrow: { width: 36, minHeight: 64, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  weekDays: { flexGrow: 1, justifyContent: "space-between", gap: 5 },
  day: { width: 52, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 2, borderRadius: radius.md },
  dayActive: { backgroundColor: colors.brandPrimary },
  dayName: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  dayNameActive: { color: colors.onBrandPrimary },
  dayNumber: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  dayNumberActive: { color: colors.onBrandPrimary },
  dayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "transparent" },
  dayDotOn: { backgroundColor: colors.brandSecondary },
  dayDotActive: { backgroundColor: colors.onBrandPrimary },
  hero: { minHeight: 228, flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  heroStacked: { flexDirection: "column", minHeight: 390 },
  heroDesktop: { minHeight: 236 },
  heroCopy: { flex: 1.05, minWidth: 0, overflow: "hidden", borderRadius: radius.xl, backgroundColor: "#E95722", padding: spacing.lg },
  featureTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  heroEyebrow: { color: "#FFF8EE", fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  heroTitle: { maxWidth: "100%", color: "#FFFFFF", fontSize: 22, lineHeight: 25, fontWeight: "900", letterSpacing: -0.6, marginTop: spacing.sm },
  featureSchedule: { gap: spacing.sm, marginTop: spacing.lg },
  featureScheduleRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.14)" },
  featureScheduleIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  featureScheduleTitle: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  featureScheduleTime: { color: "rgba(255,255,255,0.72)", fontSize: 9, fontWeight: "600", marginTop: 1 },
  featureStatusDot: { width: 12, height: 12, borderRadius: radius.pill, borderWidth: 2, borderColor: "rgba(255,255,255,0.78)" },
  featureStatusDone: { backgroundColor: "#FFFFFF" },
  featureEmptyLine: { width: "88%", height: 12, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.18)" },
  heroArtwork: { flex: 0.95, minWidth: 0, overflow: "hidden", borderRadius: radius.xl, backgroundColor: "#AFC2FF", padding: spacing.lg },
  heroMascot: { width: 66, height: 58, alignSelf: "flex-end", marginTop: -10, marginRight: -8, marginBottom: -16 },
  moveDate: { color: "rgba(15,20,39,0.62)", fontSize: 9, fontWeight: "700" },
  moveEyebrow: { color: "#17203B", fontSize: 9, fontWeight: "900", letterSpacing: 0.5, marginTop: spacing.sm },
  moveTitle: { flex: 1, color: "#11182D", fontSize: 21, lineHeight: 23, fontWeight: "900", letterSpacing: -0.6, marginTop: spacing.xs },
  moveAction: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.xs, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.72)" },
  moveActionText: { color: "#11182D", fontSize: 11, fontWeight: "900" },
  movePlay: { width: 31, height: 31, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: "#11182D" },
  dailyProgressCard: { minHeight: 92, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceElevated },
  dailyProgressIcon: { width: 48, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary },
  dailyProgressCopy: { flex: 1, minWidth: 0 },
  dailyProgressTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  dailyProgressText: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  dailyProgressTrack: { height: 4, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, marginTop: spacing.sm },
  dailyProgressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  progressRing: { width: 52, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: colors.brandTertiary, backgroundColor: colors.surfaceSecondary },
  progressRingValue: { color: colors.onSurface, fontSize: 11, fontWeight: "900" },
  overview: { gap: spacing.lg },
  overviewDesktop: { flexDirection: "row", alignItems: "stretch" },
  focusColumn: { minWidth: 0, gap: spacing.md },
  focusColumnDesktop: { flex: 0.9 },
  dashboard: { minWidth: 0, gap: spacing.lg },
  dashboardWide: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
  dashboardDesktop: { flex: 1.1, gap: spacing.md },
  column: { gap: spacing.sm },
  columnWide: { width: "48.8%", flexGrow: 1 },
  columnDesktop: { width: "48%", flexGrow: 1 },
  sectionHeading: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  sectionAction: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  timelineSection: { gap: spacing.sm },
  timelineList: { paddingVertical: spacing.xs },
  timelineRow: { minHeight: 68, flexDirection: "row", alignItems: "stretch" },
  timelineRail: { width: 25, alignItems: "center" },
  timelineDot: { zIndex: 1, width: 19, height: 19, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 2, backgroundColor: colors.surface },
  timelineLine: { width: 1, flex: 1, backgroundColor: colors.borderStrong },
  timelineBody: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.md },
  timelineIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  timelineCopy: { flex: 1, minWidth: 0 },
  timelineTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  timelineTitleDone: { color: colors.onSurfaceTertiary },
  timelineSubtitle: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  timelineTime: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "700" },
  timelineAction: { width: 44, height: 34, alignSelf: "center", marginLeft: spacing.sm, marginBottom: spacing.md, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  timelineActionCurrent: { width: 58, backgroundColor: colors.brandPrimary },
  timelineActionCurrentText: { color: colors.onBrandPrimary, fontSize: 8, fontWeight: "900" },
  timelineActionDone: { backgroundColor: colors.success },
  timelineEmpty: { minHeight: 84, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  timelineEmptyTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },
  timelineEmptyText: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  compactAdd: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary },
  progressTrack: { height: 6, marginTop: -18, marginHorizontal: spacing.lg, marginBottom: spacing.lg, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  skeleton: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  skeletonIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  skeletonLine: { height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  skeletonBlock: { minHeight: 70, borderRadius: radius.md, backgroundColor: withAlpha(colors.surfaceTertiary, 0.78) },
  stateCard: { minHeight: 164, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  stateTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", textAlign: "center" },
  stateText: { maxWidth: 360, color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16, textAlign: "center" },
  retry: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: withAlpha(colors.brandPrimary, 0.12) },
  retryText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
