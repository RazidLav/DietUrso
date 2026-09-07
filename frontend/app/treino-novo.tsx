import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACTIVITY_COLORS, ACTIVITY_ICONS, ACTIVITY_LABELS } from "../src/training/catalog";
import { localDate } from "../src/training/calculations";
import type { ActivityType, WorkoutTemplate } from "../src/training/types";
import { getTrainingState, replaceTrainingSession, scheduleTrainingSession } from "../src/store/trainingStore";
import { colors, radius, spacing } from "../src/theme";

const TYPES: ActivityType[] = ["mobility", "strength", "crossfit", "running", "cycling", "custom"];

export default function NewTrainingSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; type?: string; replaceId?: string }>();
  const initialType = TYPES.includes(params.type as ActivityType) ? params.type as ActivityType : "strength";
  const [activityType, setActivityType] = useState<ActivityType>(initialType);
  const [name, setName] = useState(ACTIVITY_LABELS[initialType]);
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

  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Voltar"><MaterialDesignIcons name="arrow-left" size={23} color={colors.onSurface} /></Pressable><View><Text style={styles.eyebrow}>NOVA SESSÃO</Text><Text style={styles.title}>Planejar treino</Text></View></View>
    <Text style={styles.label}>MODALIDADE</Text><View style={styles.typeGrid}>{TYPES.map((type) => <Pressable key={type} style={[styles.typeCard, activityType === type && { borderColor: ACTIVITY_COLORS[type], backgroundColor: `${ACTIVITY_COLORS[type]}15` }]} onPress={() => chooseType(type)} accessibilityRole="radio" accessibilityState={{ checked: activityType === type }}><MaterialDesignIcons name={ACTIVITY_ICONS[type] as never} size={24} color={ACTIVITY_COLORS[type]} /><Text style={styles.typeText}>{ACTIVITY_LABELS[type]}</Text></Pressable>)}</View>
    <View style={styles.card}><Field label="Nome da sessão"><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ex.: Peito e tríceps" placeholderTextColor={colors.muted} /></Field><View style={styles.row}><Field label="Data" grow><TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" placeholderTextColor={colors.muted} /></Field><Field label="Horário" grow><TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={colors.muted} /></Field></View><Field label="Duração prevista (min)"><TextInput style={styles.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="Opcional" placeholderTextColor={colors.muted} /></Field><Field label="Observações"><TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} multiline placeholder="Opcional" placeholderTextColor={colors.muted} /></Field></View>
    <Text style={styles.label}>MODELO REUTILIZÁVEL · OPCIONAL</Text><View style={styles.templateList}>{templates.filter((template) => template.activityType === activityType).length ? templates.filter((template) => template.activityType === activityType).map((template) => <Pressable key={template.id} style={[styles.template, templateId === template.id && styles.templateActive]} onPress={() => { setTemplateId(template.id); setName(template.name); setDuration(template.estimatedDurationMinutes ? String(template.estimatedDurationMinutes) : ""); }}><MaterialDesignIcons name="bookmark-outline" size={20} color={templateId === template.id ? colors.brandPrimary : colors.onSurfaceTertiary} /><View style={{ flex: 1 }}><Text style={styles.templateTitle}>{template.name}</Text><Text style={styles.templateMeta}>{template.estimatedDurationMinutes ? `${template.estimatedDurationMinutes} min` : "Sem duração"}</Text></View><MaterialDesignIcons name={templateId === template.id ? "check-circle" : "circle-outline"} size={21} color={templateId === template.id ? colors.brandPrimary : colors.onSurfaceTertiary} /></Pressable>) : <Text style={styles.empty}>Nenhum modelo desta modalidade. Você poderá configurar os detalhes na próxima tela.</Text>}</View>
    {error ? <Text style={styles.error}>{error}</Text> : null}<Pressable disabled={saving} style={[styles.save, saving && { opacity: 0.6 }]} onPress={() => void save()}>{saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Text style={styles.saveText}>Salvar e configurar</Text><MaterialDesignIcons name="arrow-right" size={20} color={colors.onBrandPrimary} /></>}</Pressable>
  </ScrollView>;
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) { return <View style={grow ? { flex: 1 } : undefined}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>; }
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm }, back: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, title: { color: colors.onSurface, fontSize: 24, fontWeight: "900" }, label: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1 }, typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, typeCard: { width: "31%", minWidth: 105, flexGrow: 1, minHeight: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.sm }, typeText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "800", textAlign: "center" }, card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }, row: { flexDirection: "row", gap: spacing.sm }, fieldLabel: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700", marginBottom: spacing.xs }, input: { minHeight: 44, color: colors.onSurface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md }, multiline: { minHeight: 84, paddingTop: spacing.md, textAlignVertical: "top" }, templateList: { gap: spacing.sm }, template: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }, templateActive: { borderColor: colors.brandPrimary }, templateTitle: { color: colors.onSurface, fontWeight: "800" }, templateMeta: { color: colors.onSurfaceTertiary, fontSize: 11 }, empty: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }, save: { minHeight: 50, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, saveText: { color: colors.onBrandPrimary, fontWeight: "900" }, error: { color: colors.error, fontWeight: "700" } });
