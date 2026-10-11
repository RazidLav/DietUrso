import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdvancedOptions, StepHeader, StickyActionBar } from "../src/components/ProgressiveUI";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from "../src/training/catalog";
import { localDate } from "../src/training/calculations";
import type { ActivityType, WorkoutTemplate } from "../src/training/types";
import { getTrainingState, replaceTrainingSession, scheduleTrainingSession } from "../src/store/trainingStore";
import { colors, radius, spacing } from "../src/theme";

const TYPES: ActivityType[] = ["mobility", "strength", "crossfit", "running", "cycling", "pilates", "jiu_jitsu", "muay_thai", "hiit", "cardio", "custom"];

export default function NewTrainingSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; type?: string; replaceId?: string }>();
  const initialType = TYPES.includes(params.type as ActivityType) ? params.type as ActivityType : undefined;
  const [activityType, setActivityType] = useState<ActivityType | undefined>(initialType);
  const [name, setName] = useState(initialType ? ACTIVITY_LABELS[initialType] : "");
  const [date, setDate] = useState(params.date || localDate());
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { void getTrainingState().then((state) => setTemplates(state.templates.filter((template) => !template.archivedAt))); }, []));

  const chooseType = (value: ActivityType) => {
    setActivityType(value);
    setTemplateId(undefined);
    if (!name || TYPES.some((type) => name === ACTIVITY_LABELS[type])) setName(ACTIVITY_LABELS[value]);
  };

  const save = async () => {
    if (!activityType) { setError("Escolha uma modalidade."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setError("Informe a data no formato AAAA-MM-DD."); return; }
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { setError("Informe o horário no formato HH:MM."); return; }
    const parsedDuration = duration ? Number(duration) : undefined;
    if (parsedDuration !== undefined && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) { setError("Informe uma duração válida."); return; }
    setSaving(true); setError(null);
    try {
      const template = templates.find((candidate) => candidate.id === templateId);
      const input = {
        name: name.trim() || ACTIVITY_LABELS[activityType], activityType, date, scheduledTime: time || undefined,
        estimatedDurationMinutes: parsedDuration ?? template?.estimatedDurationMinutes, templateId,
        prescription: template?.prescription, notes, idempotencyKey: `manual:${date}:${Date.now()}`,
      };
      const planned = params.replaceId
        ? await replaceTrainingSession(params.replaceId, input)
        : await scheduleTrainingSession(input);
      router.replace(`/treino-planejado/${planned.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a sessão."); }
    finally { setSaving(false); }
  };

  return <View style={styles.screen}><ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]} keyboardShouldPersistTaps="handled">
    <StepHeader current={activityType ? 2 : 1} total={2} title={activityType ? "Quando e como?" : "Qual atividade você vai fazer?"} summary={activityType ? ACTIVITY_LABELS[activityType] : "Cada atividade vira uma sessão independente."} onBack={() => activityType ? setActivityType(undefined) : router.back()} />
    {!activityType ? <View style={styles.typeGrid}>{TYPES.map((type) => <Pressable key={type} style={styles.typeCard} onPress={() => chooseType(type)} accessibilityRole="radio" accessibilityState={{ checked: false }}><MaterialDesignIcons name={ACTIVITY_ICONS[type] as never} size={25} color={ACTIVITY_COLORS[type]} /><View style={{ flex: 1 }}><Text style={styles.typeText}>{ACTIVITY_LABELS[type]}</Text><Text style={styles.typeHint}>{type === "strength" ? "Exercícios e séries" : type === "running" || type === "cycling" ? "Contínuo ou intervalado" : type === "crossfit" ? "Blocos e WOD" : type === "mobility" ? "Movimentos e duração" : "Configuração própria"}</Text></View><MaterialDesignIcons name="chevron-right" size={21} color={colors.onSurfaceTertiary} /></Pressable>)}</View> : <>
      <View style={styles.card}><Field label="Nome da sessão"><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex.: Peito e tríceps" placeholderTextColor={colors.muted} /></Field><View style={styles.row}><Field label="Data" grow><TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={colors.muted} /></Field><Field label="Horário" grow><TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM · opcional" placeholderTextColor={colors.muted} /></Field></View><AdvancedOptions title="Detalhes opcionais" summary="Duração, observações e modelo reutilizável"><Field label="Duração prevista (min)"><TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="Opcional" placeholderTextColor={colors.muted} /></Field><Field label="Observações"><TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="Opcional" placeholderTextColor={colors.muted} /></Field><Text style={styles.label}>MODELO REUTILIZÁVEL</Text><View style={styles.templateList}>{templates.filter((template) => template.activityType === activityType).length ? templates.filter((template) => template.activityType === activityType).map((template) => <Pressable key={template.id} style={[styles.template, templateId === template.id && styles.templateActive]} onPress={() => { setTemplateId(template.id); setName(template.name); setDuration(template.estimatedDurationMinutes ? String(template.estimatedDurationMinutes) : ""); }}><MaterialDesignIcons name="bookmark-outline" size={20} color={templateId === template.id ? colors.brandPrimary : colors.onSurfaceTertiary} /><View style={{ flex: 1 }}><Text style={styles.templateTitle}>{template.name}</Text><Text style={styles.templateMeta}>{template.estimatedDurationMinutes ? `${template.estimatedDurationMinutes} min` : "Sem duração"}</Text></View><MaterialDesignIcons name={templateId === template.id ? "check-circle" : "circle-outline"} size={21} color={templateId === template.id ? colors.brandPrimary : colors.onSurfaceTertiary} /></Pressable>) : <Text style={styles.empty}>Nenhum modelo desta modalidade. Você configurará os detalhes na próxima tela.</Text>}</View></AdvancedOptions></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>}
  </ScrollView>{activityType ? <StickyActionBar secondaryLabel="Trocar modalidade" onSecondary={() => setActivityType(undefined)} primaryLabel="Salvar e configurar" onPrimary={() => void save()} busy={saving} /> : null}</View>;
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) { return <View style={grow ? { flex: 1 } : undefined}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }, back: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.onSurface, fontSize: 24, fontWeight: "900" }, label: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, typeGrid: { gap: spacing.sm }, typeCard: { minHeight: 72, flexDirection: "row", borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", gap: spacing.md, padding: spacing.md }, typeText: { color: colors.onSurface, fontSize: 13, fontWeight: "900" }, typeHint: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3 }, card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }, row: { flexDirection: "row", gap: spacing.sm }, fieldLabel: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700", marginBottom: spacing.xs }, input: { minHeight: 44, color: colors.onSurface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, multiline: { minHeight: 84, paddingTop: spacing.md, textAlignVertical: "top" }, templateList: { gap: spacing.sm }, template: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }, templateActive: { borderColor: colors.brandPrimary }, templateTitle: { color: colors.onSurface, fontWeight: "800" }, templateMeta: { color: colors.onSurfaceTertiary, fontSize: 11 }, empty: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }, save: { minHeight: 50, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, saveText: { color: colors.onBrandPrimary, fontWeight: "900" }, error: { color: colors.error, fontWeight: "700" } });
