import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TrainingPrescriptionFields } from "../../app/treino-planejado/[plannedId]";
import { getCloudStatus, subscribeCloudStatus } from "../cloud/cloudSync";
import { ACTIVITY_COLORS, ACTIVITY_LABELS } from "../training/catalog";
import { clonePrescription, createDefaultPrescription } from "../training/calculations";
import type { ActivityType, TrainingPlanItem, TrainingState, WorkoutPrescription } from "../training/types";
import { addStrengthExerciseToPrescription, copyTrainingPlanDay, getTrainingState, moveTrainingPlanItem, removeTrainingPlanItem, savePersonalExercise, saveTrainingPlanItem } from "../store/trainingStore";
import { colors, radius, spacing } from "../theme";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const TYPES: ActivityType[] = ["strength", "crossfit", "running", "cycling", "mobility", "custom"];
type Draft = Partial<TrainingPlanItem> & { weekday: number; name: string; activityType?: ActivityType };
type LoadState = "idle" | "loading" | "success" | "empty" | "error";

export default function WeeklyTrainingEditor() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [state, setState] = useState<TrainingState | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [cloudReady, setCloudReady] = useState(getCloudStatus().readyForData);
  useEffect(() => subscribeCloudStatus((next) => setCloudReady(next.readyForData)), []);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [copyTarget, setCopyTarget] = useState<number | null>(null);
  const [removeItem, setRemoveItem] = useState<TrainingPlanItem | null>(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [newExercise, setNewExercise] = useState({ name: "", primaryMuscle: "", equipment: "", instructions: "" });
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getCloudStatus().readyForData) return;
    setLoadState((current) => current === "success" ? current : "loading");
    try {
      const next = await getTrainingState();
      setState(next);
      setLoadState(next.plans.some((plan) => plan.id === planId) ? "success" : "empty");
      setError(null);
    } catch (cause) {
      setLoadState("error");
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a semana.");
    }
  }, [planId]);
  useFocusEffect(useCallback(() => { if (cloudReady) void load(); }, [cloudReady, load]));

  const plan = state?.plans.find((candidate) => candidate.id === planId);
  const items = useMemo(() => (plan?.days.find((day) => day.weekday === selectedDay)?.items ?? []).slice().sort((a, b) => a.order - b.order), [plan, selectedDay]);
  const exercises = useMemo(() => state?.exercises.filter((exercise) => !exercise.archivedAt && exercise.activityType === draft?.activityType && exercise.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) ?? [], [state, draft?.activityType, query]);

  const startAdd = () => { if (!draft) setDraft({ weekday: selectedDay, name: "" }); setEditorOpen(true); setQuery(""); setMessage(null); };
  const startEdit = (item: TrainingPlanItem) => { if (!draft) setDraft({ ...clonePrescription(item), weekday: selectedDay }); setEditorOpen(true); setQuery(""); setMessage(null); };
  const chooseType = (activityType: ActivityType) => setDraft((current) => current ? { ...current, activityType, name: current.name || ACTIVITY_LABELS[activityType], prescription: createDefaultPrescription(activityType) } : current);
  const change = (updates: Partial<Draft>) => setDraft((current) => current ? { ...current, ...updates } : current);

  const save = async (isDraft: boolean) => {
    if (!draft?.activityType || saveLock.current) return;
    saveLock.current = true; setSaving(true); setMessage(null);
    try {
      const saved = await saveTrainingPlanItem(planId, draft.weekday, { ...draft, name: draft.name.trim() || ACTIVITY_LABELS[draft.activityType], activityType: draft.activityType, isDraft });
      await load();
      if (isDraft) { setDraft({ ...draft, id: saved.id, isDraft: true }); setMessage("Rascunho salvo. Esta sessão ainda não aparece no calendário."); }
      else { setDraft(null); setEditorOpen(false); setMessage("Sessão salva na semana."); }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível salvar a sessão."); }
    finally { saveLock.current = false; setSaving(false); }
  };

  const createExercise = async () => {
    if (!newExercise.name.trim() || !draft?.prescription) return;
    setSaving(true);
    try {
      const created = await savePersonalExercise({ ...newExercise, activityType: "strength" });
      setState((current) => current ? { ...current, exercises: [...current.exercises, created] } : current);
      const next = await addStrengthExerciseToPrescription(draft.prescription, created);
      change({ prescription: next });
      setNewExercise({ name: "", primaryMuscle: "", equipment: "", instructions: "" });
      setCreatingExercise(false); setMessage("Exercício pessoal adicionado. Salve a sessão para guardar a prescrição.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível criar o exercício."); }
    finally { setSaving(false); }
  };

  const mutateDay = async (target: number) => {
    try { await copyTrainingPlanDay(planId, selectedDay, target); setCopyTarget(null); await load(); setMessage(target === selectedDay ? "Dia duplicado." : `Sessões copiadas para ${DAYS[target]}.`); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível copiar o dia."); }
  };

  const remove = async () => {
    if (!removeItem) return;
    try { await removeTrainingPlanItem(planId, selectedDay, removeItem.id); setRemoveItem(null); await load(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Não foi possível remover a sessão."); }
  };

  if (loadState === "idle" || loadState === "loading") return <StateMessage title="Carregando sua semana…" loading />;
  if (loadState === "error") return <StateMessage title={error ?? "Não foi possível carregar a semana."} retry={() => void load()} />;
  if (!plan) return <StateMessage title="Plano não encontrado." retry={() => void load()} />;

  const daySelector = <ScrollView horizontal={!desktop} showsHorizontalScrollIndicator={false} contentContainerStyle={desktop ? styles.daysDesktop : styles.daysMobile}>
    {ORDER.map((weekday) => {
      const count = plan.days.find((day) => day.weekday === weekday)?.items.length ?? 0;
      return <Pressable key={weekday} accessibilityRole="button" accessibilityState={{ selected: selectedDay === weekday }} style={[styles.dayChip, selectedDay === weekday && styles.dayChipActive]} onPress={() => { setSelectedDay(weekday); setEditorOpen(false); setMessage(null); }}>
        <Text style={[styles.dayName, selectedDay === weekday && styles.dayNameActive]}>{DAYS[weekday]}</Text><Text style={styles.dayCount}>{count} {count === 1 ? "sessão" : "sessões"}</Text>
      </Pressable>;
    })}
  </ScrollView>;

  const dayContent = <View style={styles.dayPanel}>
    {draft ? <View style={styles.choiceBox}><Text style={styles.sessionName}>Edição preservada · {DAYS[draft.weekday]}</Text><Text style={styles.muted}>Continue de onde parou ou descarte as alterações.</Text><View style={styles.dayActions}><Pressable style={styles.primarySmall} onPress={() => setEditorOpen(true)}><Text style={styles.primarySmallText}>Continuar edição</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => setConfirmDiscard(true)}><Text style={styles.secondaryText}>Descartar</Text></Pressable></View>{confirmDiscard ? <View style={styles.warning}><Text style={styles.muted}>Descartar esta edição? Alterações não salvas serão perdidas.</Text><View style={styles.dayActions}><Pressable style={styles.secondaryButton} onPress={() => setConfirmDiscard(false)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={styles.dangerButton} onPress={() => { setDraft(null); setConfirmDiscard(false); }}><Text style={styles.dangerText}>Descartar edição</Text></Pressable></View></View> : null}</View> : null}
    <View style={styles.panelHeader}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>SEMANA · {DAYS[selectedDay].toUpperCase()}</Text><Text style={styles.title}>{items.length ? `${items.length} ${items.length === 1 ? "sessão" : "sessões"}` : "Dia livre"}</Text></View><Pressable style={styles.primarySmall} onPress={startAdd} testID="weekly-add-session"><Text style={styles.primarySmallText}>+ Sessão</Text></Pressable></View>
    {items.length ? items.map((item, index) => <View key={item.id} style={styles.sessionCard}>
      <View style={[styles.typeMark, { backgroundColor: `${ACTIVITY_COLORS[item.activityType]}22` }]}><Text style={[styles.typeMarkText, { color: ACTIVITY_COLORS[item.activityType] }]}>{ACTIVITY_LABELS[item.activityType].slice(0, 1)}</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.sessionName}>{item.name}</Text><Text style={styles.muted}>{ACTIVITY_LABELS[item.activityType]} · {item.scheduledTime || "sem horário"}{item.isDraft ? " · rascunho" : ""}</Text></View>
      <View style={styles.itemActions}><IconButton icon="arrow-up" label="Mover sessão para cima" disabled={index === 0} onPress={async () => { await moveTrainingPlanItem(planId, selectedDay, item.id, -1); await load(); }} /><IconButton icon="arrow-down" label="Mover sessão para baixo" disabled={index === items.length - 1} onPress={async () => { await moveTrainingPlanItem(planId, selectedDay, item.id, 1); await load(); }} /><IconButton icon="pencil-outline" label="Editar sessão" onPress={() => startEdit(item)} /><IconButton icon="trash-can-outline" label="Excluir sessão" onPress={() => setRemoveItem(item)} /></View>
    </View>) : <Text style={styles.empty}>Sem sessão neste dia. Você pode deixá-lo livre ou adicionar quantas modalidades quiser.</Text>}
    <View style={styles.dayActions}><Pressable style={styles.secondaryButton} disabled={!items.length} onPress={() => void mutateDay(selectedDay)}><Text style={styles.secondaryText}>Duplicar dia</Text></Pressable><Pressable style={styles.secondaryButton} disabled={!items.length} onPress={() => setCopyTarget(selectedDay)}><Text style={styles.secondaryText}>Copiar para outro dia</Text></Pressable></View>
    {copyTarget !== null ? <View style={styles.choiceBox}><Text style={styles.label}>Copiar sessões para:</Text><View style={styles.wrap}>{ORDER.filter((day) => day !== selectedDay).map((day) => <Pressable key={day} style={styles.choice} onPress={() => void mutateDay(day)}><Text style={styles.choiceText}>{DAYS[day]}</Text></Pressable>)}</View><Pressable onPress={() => setCopyTarget(null)}><Text style={styles.link}>Cancelar</Text></Pressable></View> : null}
    {removeItem ? <View style={styles.warning}><Text style={styles.sessionName}>Excluir “{removeItem.name}” deste plano?</Text><Text style={styles.muted}>Sessões antigas e execuções ficam preservadas.</Text><View style={styles.dayActions}><Pressable style={styles.secondaryButton} onPress={() => setRemoveItem(null)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={styles.dangerButton} onPress={() => void remove()}><Text style={styles.dangerText}>Excluir sessão</Text></Pressable></View></View> : null}
    {message ? <Text style={styles.feedback}>{message}</Text> : null}
  </View>;

  const editor = draft && editorOpen ? <View style={styles.editor} testID="weekly-session-editor">
    <View style={styles.panelHeader}><Pressable style={styles.backButton} onPress={() => setEditorOpen(false)} accessibilityLabel="Voltar para a semana"><MaterialDesignIcons name="arrow-left" size={22} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>{DAYS[draft.weekday].toUpperCase()}</Text><Text style={styles.title}>{draft.activityType ? draft.id ? "Editar sessão" : "Nova sessão" : "Escolha a modalidade"}</Text></View></View>
    {!draft.activityType ? <View style={styles.typeGrid}>{TYPES.map((type) => <Pressable key={type} style={styles.typeCard} onPress={() => chooseType(type)}><View style={[styles.typeMark, { backgroundColor: `${ACTIVITY_COLORS[type]}22` }]}><Text style={[styles.typeMarkText, { color: ACTIVITY_COLORS[type] }]}>{ACTIVITY_LABELS[type].slice(0, 1)}</Text></View><Text style={styles.sessionName}>{ACTIVITY_LABELS[type]}</Text><MaterialDesignIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} /></Pressable>)}</View> : <>
      <View style={styles.formCard}><Field label="Nome do treino"><TextInput style={styles.input} value={draft.name} onChangeText={(name) => change({ name })} placeholder="Ex.: Quadríceps e panturrilhas" placeholderTextColor={colors.muted} /></Field><View style={styles.row}><Field label="Horário" grow><TextInput style={styles.input} value={draft.scheduledTime ?? ""} onChangeText={(scheduledTime) => change({ scheduledTime })} placeholder="HH:MM" placeholderTextColor={colors.muted} /></Field><Field label="Duração prevista (min)" grow><TextInput style={styles.input} value={draft.estimatedDurationMinutes ? String(draft.estimatedDurationMinutes) : ""} onChangeText={(value) => change({ estimatedDurationMinutes: Number(value) || undefined })} keyboardType="numeric" placeholder="Opcional" placeholderTextColor={colors.muted} /></Field></View><Field label="Orientações desta sessão no plano"><TextInput style={[styles.input, styles.multiline]} multiline value={draft.notes ?? ""} onChangeText={(notes) => change({ notes })} placeholder="Vale só para esta sessão" placeholderTextColor={colors.muted} /></Field></View>
      {draft.activityType === "strength" || draft.activityType === "mobility" ? <View style={styles.formCard}><Field label="Pesquisar no banco de exercícios"><TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Nome do exercício" placeholderTextColor={colors.muted} /></Field>{draft.activityType === "strength" ? <Pressable onPress={() => setCreatingExercise((value) => !value)}><Text style={styles.link}>+ Criar exercício próprio</Text></Pressable> : null}{creatingExercise ? <View style={styles.createForm}><Field label="Nome"><TextInput style={styles.input} value={newExercise.name} onChangeText={(name) => setNewExercise((current) => ({ ...current, name }))} /></Field><Field label="Grupo muscular"><TextInput style={styles.input} value={newExercise.primaryMuscle} onChangeText={(primaryMuscle) => setNewExercise((current) => ({ ...current, primaryMuscle }))} /></Field><Field label="Equipamento"><TextInput style={styles.input} value={newExercise.equipment} onChangeText={(equipment) => setNewExercise((current) => ({ ...current, equipment }))} /></Field><Field label="Orientação geral do exercício"><TextInput style={[styles.input, styles.multiline]} multiline value={newExercise.instructions} onChangeText={(instructions) => setNewExercise((current) => ({ ...current, instructions }))} /></Field><Pressable style={styles.primarySmall} disabled={saving || !newExercise.name.trim()} onPress={() => void createExercise()}><Text style={styles.primarySmallText}>Criar e adicionar</Text></Pressable></View> : null}</View> : null}
      {draft.prescription ? <TrainingPrescriptionFields prescription={draft.prescription} exercises={exercises} onChange={(prescription: WorkoutPrescription) => change({ prescription })} /> : null}
      {message ? <Text style={styles.feedback}>{message}</Text> : null}
      <View style={styles.saveBar}><Pressable style={styles.secondaryButton} disabled={saving} onPress={() => void save(true)}><Text style={styles.secondaryText}>Salvar rascunho</Text></Pressable><Pressable style={styles.primaryButton} disabled={saving} onPress={() => void save(false)} testID="weekly-save-session">{saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Salvar sessão</Text>}</Pressable></View>
    </>}
  </View> : null;

  return <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }]}>
    <View style={styles.topHeader}><Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Voltar aos planos"><MaterialDesignIcons name="arrow-left" size={22} color={colors.onSurface} /></Pressable><View><Text style={styles.eyebrow}>PLANO · SEMANA</Text><Text style={styles.title}>{plan.name}</Text></View></View>
    <Text style={styles.muted}>Cada sessão é independente. Editar o plano não altera treinos já registrados.</Text>
    {desktop ? <View style={styles.desktopGrid}><View style={styles.daysColumn}>{daySelector}</View><View style={styles.mainColumn}>{editor ?? dayContent}</View></View> : editor ? editor : <>{daySelector}{dayContent}</>}
  </ScrollView>;
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) { return <View style={grow ? { flex: 1 } : undefined}><Text style={styles.label}>{label}</Text>{children}</View>; }
function IconButton({ icon, label, disabled, onPress }: { icon: string; label: string; disabled?: boolean; onPress: () => void | Promise<void> }) { return <Pressable style={styles.iconButton} accessibilityLabel={label} disabled={disabled} onPress={() => void onPress()}><MaterialDesignIcons name={icon as never} size={18} color={disabled ? colors.muted : colors.onSurfaceSecondary} /></Pressable>; }
function StateMessage({ title, loading, retry }: { title: string; loading?: boolean; retry?: () => void }) { return <View style={styles.stateMessage}>{loading ? <ActivityIndicator color={colors.brandPrimary} /> : null}<Text style={styles.muted}>{title}</Text>{retry ? <Pressable onPress={retry}><Text style={styles.link}>Tentar novamente</Text></Pressable> : null}</View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.md },
  topHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: colors.onSurface, fontSize: 23, fontWeight: "900" },
  muted: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 17 },
  desktopGrid: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg },
  daysColumn: { width: 260 },
  mainColumn: { flex: 1, minWidth: 0 },
  daysDesktop: { gap: spacing.xs },
  daysMobile: { gap: spacing.xs, paddingVertical: spacing.sm },
  dayChip: { minWidth: 105, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  dayChipActive: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + "18" },
  dayName: { color: colors.onSurfaceSecondary, fontWeight: "800", fontSize: 12 },
  dayNameActive: { color: colors.brandPrimary },
  dayCount: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3 },
  dayPanel: { padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  primarySmall: { minHeight: 42, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  primarySmallText: { color: colors.onBrandPrimary, fontWeight: "900", fontSize: 12 },
  sessionCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  typeMark: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  typeMarkText: { fontSize: 18, fontWeight: "900" },
  sessionName: { color: colors.onSurface, fontWeight: "800", fontSize: 13 },
  itemActions: { flexDirection: "row", gap: 2 },
  iconButton: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  empty: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, paddingVertical: spacing.lg },
  dayActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  secondaryButton: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, justifyContent: "center", alignItems: "center" },
  secondaryText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "800" },
  choiceBox: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  choice: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  choiceText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
  link: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  warning: { padding: spacing.md, gap: spacing.sm, borderColor: colors.error, borderWidth: 1, borderRadius: radius.md },
  dangerButton: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.error, justifyContent: "center" },
  dangerText: { color: colors.onError, fontWeight: "800" },
  feedback: { color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  editor: { gap: spacing.md },
  typeGrid: { gap: spacing.sm },
  typeCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 },
  formCard: { padding: spacing.md, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "800", marginBottom: spacing.xs },
  input: { minHeight: 44, color: colors.onSurface, backgroundColor: colors.surface, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  multiline: { minHeight: 74, paddingTop: spacing.md, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: spacing.sm },
  createForm: { gap: spacing.sm },
  saveBar: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  primaryButton: { flex: 1, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "900" },
  stateMessage: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacing.md, backgroundColor: colors.surface, padding: spacing.xl },
});
