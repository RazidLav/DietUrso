import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AchievementUnlockModal from "../../src/components/AchievementUnlockModal";
import GamificationSummaryCard from "../../src/components/GamificationSummaryCard";
import MacroSummary from "../../src/components/MacroSummary";
import MealCard, { iconForMeal } from "../../src/components/MealCard";
import TrainingSummaryCard from "../../src/components/TrainingSummaryCard";
import WaterCard from "../../src/components/WaterCard";
import { getCloudStatus, subscribeCloudStatus, syncCloudNow } from "../../src/cloud/cloudSync";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { dismissAchievement, evaluateGamification, getPendingAchievement } from "../../src/gamification/engine";
import type { AchievementDefinition, GamificationSummary } from "../../src/gamification/types";
import type { HydrationSummary } from "../../src/hydration/types";
import { createPlanConsumption, dayConsumedNutrients, entryNutrients } from "../../src/nutrition/records";
import { addHydrationRecord, getHydrationSummary } from "../../src/store/hydrationStore";
import { listFoodCatalog } from "../../src/store/nutritionStore";
import { addConsumption, dayMacrosDefault, getActivePlan, getChosenOption, listConsumption, optionMacros, removeConsumptionForDayMeal } from "../../src/store/planStore";
import { getTrainingState, prepareTrainingRange } from "../../src/store/trainingStore";
import { dayEntries } from "../../src/training/calculations";
import type { TrainingDayEntry, TrainingState } from "../../src/training/types";
import { colors, radius, spacing, withAlpha } from "../../src/theme";
import type { ConsumptionEntry, Plan } from "../../src/types/plan";
import { todayISO, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "../../src/utils/date";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";

type SectionKey = "diet" | "water" | "training" | "game";
type DataLoadState = "idle" | "loading" | "success" | "error";

const EMPTY_ERRORS: Record<SectionKey, string | null> = { diet: null, water: null, training: null, game: null };

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const tablet = width >= 700;
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [plan, setPlan] = useState<Plan | null>(null);
  const [consumption, setConsumption] = useState<ConsumptionEntry[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [water, setWater] = useState<HydrationSummary | null>(null);
  const [trainingEntries, setTrainingEntries] = useState<TrainingDayEntry[]>([]);
  const [activityDates, setActivityDates] = useState<Set<string>>(new Set());
  const [pendingAchievement, setPendingAchievement] = useState<AchievementDefinition | null>(null);
  const [loadState, setLoadState] = useState<DataLoadState>("idle");
  const [sectionErrors, setSectionErrors] = useState(EMPTY_ERRORS);
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  const [refreshing, setRefreshing] = useState(false);
  const [savingWater, setSavingWater] = useState(false);
  const loadId = useRef(0);
  const waterLock = useRef(false);

  React.useEffect(() => subscribeCloudStatus((status) => setCloudReady(status.readyForData)), []);

  const weekDays = useMemo(() => weekFor(selectedDate), [selectedDate]);

  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    const request = ++loadId.current;
    setLoadState((current) => current === "success" ? current : "loading");
    const selectedAt = localDate(selectedDate);
    const week = weekFor(selectedDate);
    const nextErrors = { ...EMPTY_ERRORS };

    const [dietResult, waterResult, trainingResult, gameResult] = await Promise.allSettled([
      Promise.all([getActivePlan(), listConsumption()]),
      getHydrationSummary(selectedAt),
      (async () => {
        await prepareTrainingRange(week[0].iso, week[6].iso);
        return getTrainingState();
      })(),
      Promise.all([evaluateGamification(), selectedDate === todayISO() ? getPendingAchievement() : Promise.resolve(null)]),
    ]);
    if (request !== loadId.current) return;

    let fulfilled = 0;
    let nextConsumption: ConsumptionEntry[] = [];
    let nextTraining: TrainingState | null = null;

    if (dietResult.status === "fulfilled") {
      fulfilled += 1;
      const [currentPlan, entries] = dietResult.value;
      nextConsumption = entries;
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
      fulfilled += 1; nextTraining = trainingResult.value;
      setTrainingEntries(dayEntries(trainingResult.value, selectedDate));
    } else nextErrors.training = "Não foi possível carregar os treinos.";

    if (gameResult.status === "fulfilled") {
      fulfilled += 1; setGamification(gameResult.value[0]); setPendingAchievement(gameResult.value[1]);
    } else nextErrors.game = "As conquistas estão temporariamente indisponíveis.";

    const marked = new Set(nextConsumption.filter((entry) => entry.date >= week[0].iso && entry.date <= week[6].iso).map((entry) => entry.date));
    nextTraining?.plannedSessions.forEach((entry) => { if (entry.date >= week[0].iso && entry.date <= week[6].iso) marked.add(entry.date); });
    nextTraining?.sessions.forEach((entry) => { if (entry.date >= week[0].iso && entry.date <= week[6].iso) marked.add(entry.date); });
    setActivityDates(marked);
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
      if (plan && meal && option) await addConsumption(createPlanConsumption({ plan, meal, option, date: selectedDate, catalog: await listFoodCatalog() }));
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
  const firstName = cloudName(getCloudStatus().email);
  const loading = loadState === "idle" || loadState === "loading" || !cloudReady;

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />} testID="home-screen">
        <View style={styles.header}>
          <View style={styles.avatar}><Image source={require("../../assets/images/mascot-whey.jpg")} style={styles.avatarImage} accessibilityLabel="Mascote UrsoFit" /></View>
          <View style={{ flex: 1 }}><Text style={styles.greeting}>{dayGreeting()}, {firstName}</Text><Text style={styles.greetingMessage}>Vamos cuidar do urso hoje?</Text><Text style={styles.headerDate}>{formatLongDate(selected)}</Text></View>
          <Pressable accessibilityRole="button" style={styles.iconButton} accessibilityLabel="Abrir conquistas" onPress={() => router.push("/conquistas")}><MaterialDesignIcons name="bell-outline" size={21} color={colors.onSurface} />{pendingAchievement ? <View style={styles.notificationDot} /> : null}</Pressable>
        </View>

        <WeekSelector days={weekDays} selectedDate={selectedDate} activityDates={activityDates} onSelect={setSelectedDate} onShift={(amount) => setSelectedDate(toISO(addDays(selected, amount * 7)))} />

        <Pressable style={[styles.hero, desktop && styles.heroDesktop]} onPress={() => router.push(trainingEntries.length ? "/treinos" : "/conquistas")} accessibilityRole="button" testID="home-main-highlight">
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>{trainingEntries.length ? "SEU MOVIMENTO DE HOJE" : "PROGRESSO DA SEMANA"}</Text>
            <Text style={styles.heroTitle}>{trainingEntries.length ? `${trainingEntries.length} ${trainingEntries.length === 1 ? "sessão planejada" : "sessões planejadas"}` : "Um passo por vez já conta."}</Text>
            <Text style={styles.heroText}>{trainingEntries.length ? "Cada modalidade tem seu próprio ritmo e status." : "Registre o que fizer e acompanhe a constância sem cobrança."}</Text>
            <View style={styles.heroCta}><Text style={styles.heroCtaText}>{trainingEntries.length ? "Ver treinos" : "Ver progresso"}</Text><MaterialDesignIcons name="arrow-right" size={16} color={colors.onBrandPrimary} /></View>
          </View>
          <Image source={require("../../assets/images/mascot-trophy.jpg")} style={styles.heroMascot} resizeMode="cover" accessibilityLabel="Mascote UrsoFit celebrando" />
        </Pressable>

        <View style={styles.quickRow}>
          <QuickAction icon="silverware-fork-knife" label="Registrar refeição" onPress={() => router.push("/alimentacao")} />
          <QuickAction icon="water-plus-outline" label="Adicionar água" onPress={() => void handleWater()} disabled={savingWater} />
          <QuickAction icon="dumbbell" label="Iniciar treino" onPress={() => router.push("/treinos")} />
        </View>

        <View style={[styles.dashboard, tablet && styles.dashboardWide]}>
          <View style={[styles.column, tablet && styles.columnWide]}>
            <SectionTitle title="Alimentação" action="Abrir dieta" onPress={() => router.push("/alimentacao")} />
            {loading && !plan ? <SkeletonCard height={230} /> : sectionErrors.diet ? <ErrorCard message={sectionErrors.diet} onRetry={load} /> : plan && totals ? <>
              <MacroSummary title={today ? "CONSUMIDO HOJE" : "CONSUMIDO NO DIA"} kcal={consumedTotals.kcal} protein={consumedTotals.protein} carbs={consumedTotals.carbs} fats={consumedTotals.fats} fiber={consumedTotals.fiber} subtitle={`Meta: ${Math.round(totals.kcal)} kcal · ${doneCount}/${dayMeals.length} refeições registradas`} />
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${dayMeals.length ? Math.min(100, (doneCount / dayMeals.length) * 100) : 0}%` }]} /></View>
            </> : <EmptyCard icon="food-apple-outline" title="Nenhum plano alimentar ativo" text="Crie ou ative um plano para acompanhar o dia." action="Ir para planos" onPress={() => router.push("/ajustes")} />}
          </View>

          <View style={[styles.column, tablet && styles.columnWide]}>
            <SectionTitle title="Hidratação" action="Abrir hidratação" onPress={() => router.push("/hidratacao")} />
            {loading && !water ? <SkeletonCard height={230} /> : sectionErrors.water ? <ErrorCard message={sectionErrors.water} onRetry={load} /> : water ? <WaterCard summary={water} onQuickAdd={handleWater} onPress={() => router.push("/hidratacao")} saving={savingWater} /> : null}
          </View>

          <View style={[styles.column, tablet && styles.columnWide]}>
            <SectionTitle title="Treinos" action="Abrir agenda" onPress={() => router.push("/treinos")} />
            {loading && !trainingEntries.length ? <SkeletonCard height={190} /> : sectionErrors.training ? <ErrorCard message={sectionErrors.training} onRetry={load} /> : <TrainingSummaryCard entries={trainingEntries} onPress={() => router.push("/treinos")} />}
          </View>

          <View style={[styles.column, tablet && styles.columnWide]}>
            <SectionTitle title="Conquistas" action="Ver todas" onPress={() => router.push("/conquistas")} />
            {loading && !gamification ? <SkeletonCard height={250} /> : sectionErrors.game ? <ErrorCard message={sectionErrors.game} onRetry={load} /> : gamification ? <GamificationSummaryCard summary={gamification} onPress={() => router.push("/conquistas")} /> : null}
          </View>
        </View>

        {plan && dayMeals.length ? <View style={styles.mealsSection}>
          <SectionTitle title="Refeições do dia" action="Diário" onPress={() => router.push("/historico-alimentar")} />
          <View style={[styles.mealGrid, desktop && styles.mealGridDesktop]}>{dayMeals.map((meal) => {
            const option = meal.options.find((candidate) => candidate.id === chosen[meal.id]) ?? meal.options[0];
            const macros = option ? optionMacros(option) : { kcal: 0, protein: 0, carbs: 0, fats: 0, fiber: 0, sodium: 0 };
            const entry = consumption.find((candidate) => candidate.date === selectedDate && candidate.mealId === meal.id);
            const status = entry ? (entry.status === "off_plan" ? "modified" : entry.status) : "planned";
            return <View key={meal.id} style={desktop ? styles.mealCell : undefined}><MealCard title={meal.name} subtitle={entry ? `${entry.status === "as_planned" ? "Conforme o plano" : entry.status === "skipped" ? "Não realizada" : "Com alterações"} · ${option?.name ?? ""}` : `${meal.suggestedTime ? `${meal.suggestedTime} · ` : ""}${option?.name ?? "Sem opções"}`} icon={iconForMeal(meal.type)} kcal={entry ? entryNutrients(entry).kcal : macros.kcal} status={status} onPress={() => router.push(`/meal/${plan.id}/${meal.id}?date=${selectedDate}`)} onToggleDone={() => void toggleQuickDone(meal.id, option?.id)} /></View>;
          })}</View>
        </View> : null}
      </ScrollView>
      <AchievementUnlockModal achievement={pendingAchievement} onDismiss={handleDismissAchievement} />
    </>
  );
}

function WeekSelector({ days, selectedDate, activityDates, onSelect, onShift }: { days: ReturnType<typeof weekFor>; selectedDate: string; activityDates: Set<string>; onSelect: (date: string) => void; onShift: (amount: number) => void }) {
  return <View style={styles.weekWrap} testID="home-week-selector"><Pressable accessibilityRole="button" style={styles.weekArrow} onPress={() => onShift(-1)} accessibilityLabel="Semana anterior"><MaterialDesignIcons name="chevron-left" size={21} color={colors.onSurfaceSecondary} /></Pressable><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekDays}>{days.map((day) => { const active = day.iso === selectedDate; const current = day.iso === todayISO(); return <Pressable key={day.iso} style={[styles.day, active && styles.dayActive]} onPress={() => onSelect(day.iso)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${WEEKDAYS_LONG[day.date.getDay()]}, dia ${day.date.getDate()}${current ? ", hoje" : ""}`} testID={`week-day-${day.iso}`}><Text style={[styles.dayName, active && styles.dayNameActive]}>{WEEKDAYS_SHORT[day.date.getDay()]}</Text><Text style={[styles.dayNumber, active && styles.dayNumberActive]}>{day.date.getDate()}</Text><View style={[styles.dayDot, activityDates.has(day.iso) && styles.dayDotOn, active && activityDates.has(day.iso) && styles.dayDotActive]} /></Pressable>; })}</ScrollView><Pressable accessibilityRole="button" style={styles.weekArrow} onPress={() => onShift(1)} accessibilityLabel="Próxima semana"><MaterialDesignIcons name="chevron-right" size={21} color={colors.onSurfaceSecondary} /></Pressable></View>;
}

function QuickAction({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed, disabled && styles.disabled]} onPress={onPress} accessibilityLabel={label}><View style={styles.quickIcon}><MaterialDesignIcons name={icon as never} size={18} color={colors.brandPrimary} /></View><Text style={styles.quickText} numberOfLines={2}>{label}</Text></Pressable>;
}

function SectionTitle({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Pressable onPress={onPress} accessibilityLabel={action}><Text style={styles.sectionAction}>{action}</Text></Pressable></View>;
}

function SkeletonCard({ height }: { height: number }) { return <View style={[styles.skeleton, { height }]} accessibilityLabel="Carregando"><View style={styles.skeletonIcon} /><View style={[styles.skeletonLine, { width: "48%" }]} /><View style={[styles.skeletonLine, { width: "78%" }]} /><View style={[styles.skeletonBlock, { flex: 1 }]} /></View>; }

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) { return <View style={styles.stateCard} accessibilityRole="alert"><MaterialDesignIcons name="cloud-alert-outline" size={27} color={colors.error} /><Text style={styles.stateTitle}>Esta área não carregou</Text><Text style={styles.stateText}>{message}</Text><Pressable style={styles.retry} onPress={onRetry}><Text style={styles.retryText}>Tentar novamente</Text></Pressable></View>; }

function EmptyCard({ icon, title, text, action, onPress }: { icon: string; title: string; text: string; action: string; onPress: () => void }) { return <View style={styles.stateCard}><MaterialDesignIcons name={icon as never} size={28} color={colors.brandPrimary} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{text}</Text><Pressable style={styles.retry} onPress={onPress}><Text style={styles.retryText}>{action}</Text></Pressable></View>; }

function localDate(iso: string) { const [year, month, day] = iso.split("-").map(Number); return new Date(year, month - 1, day, 12, 0, 0); }
function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function toISO(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function weekFor(iso: string) { const selected = localDate(iso); const mondayOffset = (selected.getDay() + 6) % 7; const monday = addDays(selected, -mondayOffset); return Array.from({ length: 7 }, (_, index) => { const date = addDays(monday, index); return { date, iso: toISO(date) }; }); }
function dayGreeting() { const hour = new Date().getHours(); return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"; }
function cloudName(email: string | null) { const raw = email?.split("@")[0]?.split(/[._-]/)[0] || "amigo"; return raw.charAt(0).toUpperCase() + raw.slice(1); }
function formatLongDate(date: Date) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 1260, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 18, overflow: "hidden", borderWidth: 2, borderColor: colors.brandPrimary, backgroundColor: colors.surfaceSecondary },
  avatarImage: { width: "100%", height: "100%" },
  greeting: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  greetingMessage: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600", marginTop: 2 },
  headerDate: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3, textTransform: "capitalize" },
  iconButton: { position: "relative", width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  notificationDot: { position: "absolute", right: 9, top: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary, borderWidth: 2, borderColor: colors.surfaceSecondary },
  weekWrap: { flexDirection: "row", alignItems: "center", gap: spacing.xs, padding: spacing.xs, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
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
  hero: { minHeight: 210, flexDirection: "row", overflow: "hidden", borderRadius: 30, backgroundColor: withAlpha(colors.brandSecondary, 0.18), borderWidth: 1, borderColor: withAlpha(colors.brandSecondary, 0.3) },
  heroDesktop: { minHeight: 260 },
  heroCopy: { flex: 1.1, zIndex: 2, justifyContent: "center", alignItems: "flex-start", padding: spacing.xl },
  heroEyebrow: { color: colors.brandSecondary, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  heroTitle: { color: colors.onSurface, fontSize: 25, lineHeight: 30, fontWeight: "900", letterSpacing: -0.7, marginTop: spacing.sm },
  heroText: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17, marginTop: spacing.sm, maxWidth: 470 },
  heroCta: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  heroCtaText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "900" },
  heroMascot: { width: "38%", minWidth: 130, height: "100%", position: "absolute", right: 0, top: 0 },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quickAction: { flex: 1, minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  quickIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.brandPrimary, 0.12) },
  quickText: { flexShrink: 1, color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  dashboard: { gap: spacing.lg },
  dashboardWide: { flexDirection: "row", flexWrap: "wrap" },
  column: { gap: spacing.sm },
  columnWide: { width: "48.8%", flexGrow: 1 },
  sectionHeading: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  sectionAction: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  progressTrack: { height: 6, marginTop: -18, marginHorizontal: spacing.lg, marginBottom: spacing.lg, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  mealsSection: { gap: spacing.sm },
  mealGrid: { gap: spacing.sm },
  mealGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  mealCell: { width: "49.4%" },
  skeleton: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  skeletonIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  skeletonLine: { height: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  skeletonBlock: { minHeight: 70, borderRadius: radius.md, backgroundColor: withAlpha(colors.surfaceTertiary, 0.78) },
  stateCard: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  stateTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", textAlign: "center" },
  stateText: { maxWidth: 360, color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16, textAlign: "center" },
  retry: { minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: withAlpha(colors.brandPrimary, 0.12) },
  retryText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.5 },
});
