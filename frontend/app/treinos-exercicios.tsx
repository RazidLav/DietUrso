import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CompactCard, ContentContainer, FilterChip, IconButton, PageHeader, PrimaryButton, ResponsiveGrid, ResponsiveSheet, SectionHeader, SegmentedControl, StatusBadge } from "../src/components/DesignSystem";
import { AdvancedOptions, EmptyState, ErrorState, LoadingSkeleton, SearchAndFilter } from "../src/components/ProgressiveUI";
import { getCloudStatus, subscribeCloudStatus } from "../src/cloud/cloudSync";
import { useResponsiveLayout } from "../src/responsive";
import { createPersonalExerciseVariant, getTrainingState, savePersonalExercise, setPersonalExerciseArchived, toggleExerciseFavorite } from "../src/store/trainingStore";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from "../src/training/catalog";
import type { ActivityType, ExerciseDefinition, TrainingState } from "../src/training/types";
import { colors, layout, radius, spacing, typeScale, withAlpha } from "../src/theme";
import { matchesSearch } from "../src/utils/search";

const TYPES: (ActivityType | "all")[] = ["all", "strength", "mobility", "crossfit", "running", "cycling", "pilates", "jiu_jitsu", "muay_thai", "hiit", "cardio", "custom"];
type ExerciseDraft = Partial<ExerciseDefinition> & { name: string; activityType: ActivityType };
type ViewMode = "list" | "grid";

const emptyDraft = (): ExerciseDraft => ({ name: "", activityType: "strength", laterality: "bilateral", secondaryMuscles: [], alternativeExerciseIds: [] });

export default function ExerciseCatalogScreen() {
  const router = useRouter();
  const { new: createNew } = useLocalSearchParams<{ new?: string }>();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const [state, setState] = useState<TrainingState | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ActivityType | "all">("all");
  const [scope, setScope] = useState<"all" | "global" | "personal">("all");
  const [muscle, setMuscle] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [detail, setDetail] = useState<ExerciseDefinition | null>(null);
  const [draft, setDraft] = useState<ExerciseDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  const routeActionHandled = useRef(false);

  useEffect(() => subscribeCloudStatus((next) => setCloudReady(next.readyForData)), []);
  useEffect(() => { if (createNew === "1" && !routeActionHandled.current) { routeActionHandled.current = true; setDraft(emptyDraft()); } }, [createNew]);
  const effectiveViewMode: ViewMode = responsive.isPhone ? "list" : viewMode;

  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    try { setState(await getTrainingState()); setLoadError(null); }
    catch (cause) { setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar os exercícios."); }
  }, []);
  useFocusEffect(useCallback(() => { if (cloudReady) void load(); }, [cloudReady, load]));

  const muscles = useMemo(() => Array.from(new Set(state?.exercises.map((exercise) => exercise.primaryMuscle).filter((value): value is string => Boolean(value)) ?? [])).sort(), [state]);
  const equipmentOptions = useMemo(() => Array.from(new Set(state?.exercises.map((exercise) => exercise.equipment).filter((value): value is string => Boolean(value)) ?? [])).sort(), [state]);
  const exercises = useMemo(() => state?.exercises.filter((exercise) =>
    matchesSearch(query, exercise.name, exercise.primaryMuscle, exercise.secondaryMuscles.join(" "), exercise.equipment)
    && (type === "all" || exercise.activityType === type)
    && (scope === "all" || exercise.scope === scope)
    && (muscle === "all" || exercise.primaryMuscle === muscle)
    && (equipment === "all" || exercise.equipment === equipment)
    && (!favoritesOnly || exercise.favorite)
  ).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)) ?? [], [state, query, type, scope, muscle, equipment, favoritesOnly]);

  const advancedFilterCount = Number(scope !== "all") + Number(muscle !== "all") + Number(equipment !== "all") + Number(favoritesOnly);
  const resetFilters = () => { setScope("all"); setMuscle("all"); setEquipment("all"); setFavoritesOnly(false); };
  const save = async () => {
    if (!draft?.name.trim()) return;
    try {
      await savePersonalExercise({ ...draft, name: draft.name.trim(), secondaryMuscles: typeof draft.secondaryMuscles === "string" ? String(draft.secondaryMuscles).split(",").map((item) => item.trim()).filter(Boolean) : draft.secondaryMuscles });
      setDraft(null); setMessage("Exercício pessoal salvo."); await load();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
  };

  if (!state) return <View style={styles.loading}>{loadError ? <ErrorState description={loadError} onRetry={() => void load()} /> : <LoadingSkeleton rows={5} title={cloudReady ? "Carregando exercícios…" : "Preparando seus dados…"} />}</View>;

  const detailPanel = detail ? <ExerciseDetail exercise={detail} sessions={state.sessions} onClose={() => setDetail(null)} onVariant={async () => { const copy = await createPersonalExerciseVariant(detail.id); setDetail(null); setDraft(copy); await load(); }} onEdit={() => { setDraft({ ...detail }); setDetail(null); }} onArchive={async () => { await setPersonalExerciseArchived(detail.id, !detail.archivedAt); setDetail(null); await load(); }} /> : null;

  return <View style={styles.screen} testID="exercise-catalog-screen">
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.huge }} keyboardShouldPersistTaps="handled">
      <ContentContainer style={styles.content} maxWidth={layout.editorMax}>
        <PageHeader eyebrow="BIBLIOTECA URSOFIT" title="Banco de exercícios" description="Encontre o essencial primeiro. Filtros específicos e detalhes aparecem quando você precisar." onBack={() => router.back()} action={<PrimaryButton icon="plus" label="Criar exercício" onPress={() => setDraft(emptyDraft())} />} />
        {loadError ? <ErrorState title="A biblioteca pode estar desatualizada" description={loadError} onRetry={() => void load()} /> : null}

        <SearchAndFilter value={query} onChangeText={setQuery} placeholder="Buscar por nome, músculo ou equipamento">
          {TYPES.map((value) => <FilterChip key={value} label={value === "all" ? "Todas" : ACTIVITY_LABELS[value]} active={type === value} onPress={() => setType(value)} />)}
        </SearchAndFilter>

        <View style={styles.toolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Abrir filtros adicionais" onPress={() => setFiltersOpen(true)} style={[styles.filterButton, advancedFilterCount > 0 && styles.filterButtonActive]}><MaterialDesignIcons name="tune-variant" size={19} color={advancedFilterCount ? colors.onBrandPrimary : colors.onSurface} /><Text style={[styles.filterButtonText, advancedFilterCount > 0 && styles.filterButtonTextActive]}>Filtros{advancedFilterCount ? ` · ${advancedFilterCount}` : ""}</Text></Pressable>
          {!responsive.isPhone ? <View style={styles.viewControl}><SegmentedControl value={viewMode} label="Modo de visualização" options={[{ value: "list", label: "Lista", icon: "format-list-bulleted" }, { value: "grid", label: "Grade", icon: "view-grid-outline" }]} onChange={setViewMode} /></View> : null}
        </View>

        {advancedFilterCount ? <View style={styles.activeFilters} accessibilityLabel="Filtros ativos">
          {scope !== "all" ? <FilterChip label={scope === "global" ? "Globais" : "Meus exercícios"} onRemove={() => setScope("all")} /> : null}
          {muscle !== "all" ? <FilterChip label={muscle} onRemove={() => setMuscle("all")} /> : null}
          {equipment !== "all" ? <FilterChip label={equipment} onRemove={() => setEquipment("all")} /> : null}
          {favoritesOnly ? <FilterChip label="Favoritos" onRemove={() => setFavoritesOnly(false)} /> : null}
          <Pressable onPress={resetFilters}><Text style={styles.clearFilters}>Limpar filtros</Text></Pressable>
        </View> : null}

        <SectionHeader title={`${exercises.length} ${exercises.length === 1 ? "exercício" : "exercícios"}`} description="Exercícios globais são somente leitura; você pode criar uma versão pessoal." />

        <View style={[styles.masterDetail, !responsive.isPhone && detail && styles.masterDetailOpen]}>
          <View style={styles.results}>
            {exercises.length ? effectiveViewMode === "grid" ? <ResponsiveGrid minItemWidth={250} maxColumns={detail ? 2 : 3}>{exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} grid selected={detail?.id === exercise.id} onPress={() => setDetail(exercise)} onFavorite={async () => { await toggleExerciseFavorite(exercise.id); await load(); }} />)}</ResponsiveGrid> : <View style={styles.list}>{exercises.map((exercise) => <ExerciseCard key={exercise.id} exercise={exercise} selected={detail?.id === exercise.id} onPress={() => setDetail(exercise)} onFavorite={async () => { await toggleExerciseFavorite(exercise.id); await load(); }} />)}</View> : <EmptyState icon="dumbbell" title="Nenhum exercício encontrado" description="Ajuste a busca ou limpe os filtros para ampliar os resultados." actionLabel={advancedFilterCount ? "Limpar filtros" : undefined} onAction={advancedFilterCount ? resetFilters : undefined} />}
          </View>
          {!responsive.isPhone && detail ? <View style={styles.detailColumn}>{detailPanel}</View> : null}
        </View>
        {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
      </ContentContainer>
    </ScrollView>

    <ResponsiveSheet visible={filtersOpen} title="Filtros adicionais" description="Refine apenas quando a busca e a modalidade não forem suficientes." onClose={() => setFiltersOpen(false)}>
      <FilterGroup title="Origem"><View style={styles.filterWrap}>{(["all", "global", "personal"] as const).map((value) => <FilterChip key={value} label={value === "all" ? "Todas" : value === "global" ? "Globais" : "Meus exercícios"} active={scope === value} onPress={() => setScope(value)} />)}</View></FilterGroup>
      <FilterGroup title="Preferências"><View style={styles.filterWrap}><FilterChip label="Somente favoritos" active={favoritesOnly} onPress={() => setFavoritesOnly((value) => !value)} /></View></FilterGroup>
      <FilterGroup title="Grupo muscular"><View style={styles.filterWrap}><FilterChip label="Todos" active={muscle === "all"} onPress={() => setMuscle("all")} />{muscles.map((value) => <FilterChip key={value} label={value} active={muscle === value} onPress={() => setMuscle(value)} />)}</View></FilterGroup>
      <FilterGroup title="Equipamento"><View style={styles.filterWrap}><FilterChip label="Todos" active={equipment === "all"} onPress={() => setEquipment("all")} />{equipmentOptions.map((value) => <FilterChip key={value} label={value} active={equipment === value} onPress={() => setEquipment(value)} />)}</View></FilterGroup>
      <View style={styles.sheetActions}><Pressable style={styles.secondaryButton} onPress={resetFilters}><Text style={styles.secondaryText}>Limpar</Text></Pressable><PrimaryButton label="Ver resultados" onPress={() => setFiltersOpen(false)} /></View>
    </ResponsiveSheet>

    {responsive.isPhone ? <ResponsiveSheet visible={!!detail} title={detail?.name ?? "Detalhes"} onClose={() => setDetail(null)}>{detailPanel}</ResponsiveSheet> : null}
    <ResponsiveSheet visible={!!draft} title={draft?.id ? "Editar exercício pessoal" : "Novo exercício pessoal"} description="Comece pelo essencial; orientações e cuidados ficam em detalhes avançados." onClose={() => setDraft(null)} width={560}>
      {draft ? <ExerciseForm draft={draft} onChange={(updates) => setDraft((current) => current ? { ...current, ...updates } : current)} /> : null}
      <View style={styles.sheetActions}><Pressable style={styles.secondaryButton} onPress={() => setDraft(null)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><PrimaryButton label="Salvar exercício" disabled={!draft?.name.trim()} onPress={() => void save()} /></View>
    </ResponsiveSheet>
  </View>;
}

function ExerciseCard({ exercise, onPress, onFavorite, selected, grid = false }: { exercise: ExerciseDefinition; onPress: () => void; onFavorite: () => void; selected?: boolean; grid?: boolean }) {
  return <CompactCard onPress={onPress} selected={selected} accessibilityLabel={`Abrir ${exercise.name}`} style={[styles.exerciseCard, grid && styles.exerciseCardGrid, exercise.archivedAt ? styles.archivedCard : undefined]}>
    <View style={[styles.typeIcon, { backgroundColor: withAlpha(ACTIVITY_COLORS[exercise.activityType], 0.13) }]}><MaterialDesignIcons name={ACTIVITY_ICONS[exercise.activityType] as never} size={22} color={ACTIVITY_COLORS[exercise.activityType]} /></View>
    <View style={styles.exerciseCopy}><Text style={styles.exerciseName} numberOfLines={2}>{exercise.name}</Text><Text style={styles.exerciseMeta} numberOfLines={2}>{exercise.primaryMuscle ?? "Grupo geral"} · {exercise.equipment ?? "Sem equipamento"}</Text><View style={styles.badges}><StatusBadge label={exercise.scope === "global" ? "Global" : "Meu"} tone={exercise.scope === "global" ? "info" : "primary"} />{exercise.archivedAt ? <StatusBadge label="Arquivado" /> : null}</View></View>
    <Pressable accessibilityRole="button" accessibilityLabel={exercise.favorite ? "Remover dos favoritos" : "Favoritar exercício"} hitSlop={8} onPress={(event) => { event.stopPropagation?.(); onFavorite(); }} style={styles.favorite}><MaterialDesignIcons name={exercise.favorite ? "star" : "star-outline"} size={22} color={exercise.favorite ? colors.brandTertiary : colors.onSurfaceTertiary} /></Pressable>
  </CompactCard>;
}

function ExerciseDetail({ exercise, sessions, onClose, onVariant, onEdit, onArchive }: { exercise: ExerciseDefinition; sessions: TrainingState["sessions"]; onClose: () => void; onVariant: () => void; onEdit: () => void; onArchive: () => void }) {
  const history = sessions.flatMap((session) => session.result.strengthSets.filter((set) => set.exerciseId === exercise.id && set.status === "completed").map((set) => ({ session, set }))).sort((a, b) => b.session.startedAt.localeCompare(a.session.startedAt));
  const last = history[0];
  return <View style={styles.detailPanel} testID="exercise-detail-panel">
    <View style={styles.detailHeader}><View style={[styles.detailIcon, { backgroundColor: withAlpha(ACTIVITY_COLORS[exercise.activityType], 0.13) }]}><MaterialDesignIcons name={ACTIVITY_ICONS[exercise.activityType] as never} size={25} color={ACTIVITY_COLORS[exercise.activityType]} /></View><View style={styles.exerciseCopy}><Text style={styles.detailTitle}>{exercise.name}</Text><Text style={styles.exerciseMeta}>{ACTIVITY_LABELS[exercise.activityType]}</Text></View><IconButton icon="close" label="Fechar detalhes" onPress={onClose} /></View>
    <Info label="Grupo principal" value={exercise.primaryMuscle} /><Info label="Grupos secundários" value={exercise.secondaryMuscles.join(", ")} /><Info label="Equipamento" value={exercise.equipment} /><Info label="Execução" value={exercise.instructions} /><Info label="Cuidados" value={exercise.cautions} />
    <View style={styles.progressPanel}><Text style={styles.infoLabel}>PROGRESSO PESSOAL</Text>{last ? <><Text style={styles.progressValue}>{last.set.performedLoad != null ? `${last.set.performedLoad} ${last.set.loadUnit ?? "kg"}` : "Carga não informada"} · {last.set.performedReps ?? "—"} reps</Text><Text style={styles.exerciseMeta}>Última execução em {new Date(last.session.startedAt).toLocaleDateString("pt-BR")} · {history.length} série(s) registrada(s)</Text></> : <Text style={styles.exerciseMeta}>Ainda não há execução real suficiente para mostrar evolução.</Text>}</View>
    <View style={styles.detailActions}>{exercise.scope === "global" ? <PrimaryButton label="Criar versão pessoal" onPress={onVariant} /> : <><Pressable style={styles.secondaryButton} onPress={onEdit}><Text style={styles.secondaryText}>Editar</Text></Pressable><Pressable style={styles.secondaryButton} onPress={onArchive}><Text style={styles.secondaryText}>{exercise.archivedAt ? "Restaurar" : "Arquivar"}</Text></Pressable></>}</View>
  </View>;
}

function ExerciseForm({ draft, onChange }: { draft: ExerciseDraft; onChange: (updates: Partial<ExerciseDraft>) => void }) {
  return <View style={styles.form}>
    <Field label="Nome"><TextInput accessibilityLabel="Nome do exercício" style={styles.input} value={draft.name} onChangeText={(name) => onChange({ name })} placeholder="Ex.: Agachamento livre" placeholderTextColor={colors.muted} /></Field>
    <FilterGroup title="Modalidade"><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>{TYPES.filter((value): value is ActivityType => value !== "all").map((value) => <FilterChip key={value} label={ACTIVITY_LABELS[value]} active={draft.activityType === value} onPress={() => onChange({ activityType: value })} />)}</ScrollView></FilterGroup>
    <View style={styles.formRow}><Field label="Grupo principal" grow><TextInput style={styles.input} value={draft.primaryMuscle ?? ""} onChangeText={(primaryMuscle) => onChange({ primaryMuscle })} placeholder="Opcional" placeholderTextColor={colors.muted} /></Field><Field label="Equipamento" grow><TextInput style={styles.input} value={draft.equipment ?? ""} onChangeText={(equipment) => onChange({ equipment })} placeholder="Opcional" placeholderTextColor={colors.muted} /></Field></View>
    <AdvancedOptions title="Detalhes avançados" summary="Secundários, instruções, cuidados e lateralidade">
      <Field label="Grupos secundários, separados por vírgula"><TextInput style={styles.input} value={Array.isArray(draft.secondaryMuscles) ? draft.secondaryMuscles.join(", ") : String(draft.secondaryMuscles ?? "")} onChangeText={(value) => onChange({ secondaryMuscles: value as never })} /></Field>
      <Field label="Instruções"><TextInput style={[styles.input, styles.multiline]} multiline value={draft.instructions ?? ""} onChangeText={(instructions) => onChange({ instructions })} /></Field>
      <Field label="Cuidados e observações"><TextInput style={[styles.input, styles.multiline]} multiline value={draft.cautions ?? ""} onChangeText={(cautions) => onChange({ cautions })} /></Field>
      <FilterGroup title="Lateralidade"><View style={styles.filterWrap}>{(["bilateral", "unilateral", "not_applicable"] as const).map((value) => <FilterChip key={value} label={value === "not_applicable" ? "Não se aplica" : value} active={draft.laterality === value} onPress={() => onChange({ laterality: value })} />)}</View></FilterGroup>
    </AdvancedOptions>
  </View>;
}

function Field({ label, children, grow = false }: { label: string; children: React.ReactNode; grow?: boolean }) { return <View style={grow ? styles.fieldGrow : undefined}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.filterGroup}><Text style={styles.fieldLabel}>{title}</Text>{children}</View>; }
function Info({ label, value }: { label: string; value?: string }) { return value ? <View style={styles.info}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoText}>{value}</Text></View> : null; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background, justifyContent: "center", padding: spacing.lg },
  content: { gap: spacing.lg },
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  filterButton: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceInteractive },
  filterButtonActive: { backgroundColor: colors.brandPrimary },
  filterButtonText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" },
  filterButtonTextActive: { color: colors.onBrandPrimary },
  viewControl: { width: 240 },
  activeFilters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  clearFilters: { color: colors.brandPrimary, fontSize: 10, fontWeight: "850" as never, paddingHorizontal: spacing.sm },
  masterDetail: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg },
  masterDetailOpen: { minHeight: 480 },
  results: { flex: 1, minWidth: 0 },
  detailColumn: { width: 360 },
  list: { gap: spacing.sm },
  exerciseCard: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  exerciseCardGrid: { minHeight: 132, alignItems: "flex-start" },
  archivedCard: { opacity: 0.56 },
  typeIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  exerciseCopy: { flex: 1, minWidth: 0 },
  exerciseName: { color: colors.onSurface, fontSize: typeScale.componentTitle.fontSize, lineHeight: typeScale.componentTitle.lineHeight, fontWeight: "850" as never },
  exerciseMeta: { color: colors.onSurfaceTertiary, fontSize: typeScale.caption.fontSize, lineHeight: typeScale.caption.lineHeight, marginTop: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  favorite: { width: 40, height: 40, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  message: { color: colors.success, fontSize: 11, fontWeight: "800", textAlign: "center" },
  filterWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  filterGroup: { gap: spacing.sm },
  sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive },
  secondaryText: { color: colors.onSurface, fontSize: 11, fontWeight: "850" as never },
  detailPanel: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  detailIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  detailTitle: { color: colors.onSurface, fontSize: 19, lineHeight: 24, fontWeight: "900" },
  detailActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  info: { gap: 2 },
  infoLabel: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "850" as never, letterSpacing: 0.6 },
  infoText: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  progressPanel: { gap: 3, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceInteractive },
  progressValue: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  form: { gap: spacing.md },
  formRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  fieldGrow: { flex: 1, minWidth: 180 },
  fieldLabel: { color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 15, fontWeight: "750" as never, marginBottom: spacing.xs },
  input: { minHeight: 46, color: colors.onSurface, backgroundColor: colors.surfaceInteractive, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: spacing.md },
  multiline: { minHeight: 88, textAlignVertical: "top", paddingTop: spacing.md },
});
