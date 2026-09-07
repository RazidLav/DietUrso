import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseClock } from "../src/hydration/calculations";
import type { HydrationConfig } from "../src/hydration/types";
import { getHydrationState, updateHydrationConfig } from "../src/store/hydrationStore";
import { colors, radius, spacing } from "../src/theme";

const INTERVALS = [60, 90, 120, 180];

export default function HydrationConfigScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<HydrationConfig | null>(null);
  const [goal, setGoal] = useState("");
  const [goalUnit, setGoalUnit] = useState<"ml" | "l">("ml");
  const [wake, setWake] = useState("");
  const [sleep, setSleep] = useState("");
  const [timezone, setTimezone] = useState("");
  const [alerts, setAlerts] = useState(true);
  const [interval, setInterval] = useState(120);
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState("22:30");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmUnusual, setConfirmUnusual] = useState(false);

  useFocusEffect(useCallback(() => {
    void getHydrationState().then((state) => {
      const value = state.config;
      setConfig(value); setGoal(String(value.dailyGoalMl)); setWake(value.wakeTime); setSleep(value.sleepTime); setTimezone(value.timezone); setAlerts(value.internalAlertsEnabled); setInterval(value.alertIntervalMinutes); setQuietEnabled(Boolean(value.quietStart && value.quietEnd)); setQuietStart(value.quietStart ?? "22:30"); setQuietEnd(value.quietEnd ?? "07:00");
    });
  }, []));

  const changeGoalUnit = (next: "ml" | "l") => {
    if (next === goalUnit) return;
    const current = Number(goal.replace(",", "."));
    if (Number.isFinite(current)) setGoal(next === "l" ? String(current / 1000).replace(".", ",") : String(Math.round(current * 1000)));
    setGoalUnit(next);
  };

  const save = async (confirmed = false) => {
    const enteredGoal = Number(goal.replace(",", "."));
    const dailyGoalMl = Math.round(goalUnit === "l" ? enteredGoal * 1000 : enteredGoal);
    if (!Number.isFinite(dailyGoalMl) || dailyGoalMl <= 0 || dailyGoalMl > 50000) { setError("Informe uma meta válida em mililitros."); return; }
    if (parseClock(wake) === null || parseClock(sleep) === null || (quietEnabled && (parseClock(quietStart) === null || parseClock(quietEnd) === null))) { setError("Use o formato HH:MM nos horários."); return; }
    try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }).format(); } catch { setError("Informe um fuso horário IANA válido, como America/Fortaleza."); return; }
    if (!confirmed && (dailyGoalMl < 1000 || dailyGoalMl > 6000)) { setConfirmUnusual(true); return; }
    setSaving(true); setError(null); setConfirmUnusual(false);
    try {
      await updateHydrationConfig({ dailyGoalMl, wakeTime: wake, sleepTime: sleep, timezone, internalAlertsEnabled: alerts, alertIntervalMinutes: interval, quietStart: quietEnabled ? quietStart : undefined, quietEnd: quietEnabled ? quietEnd : undefined });
      router.back();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar as configurações."); }
    finally { setSaving(false); }
  };

  if (!config) return <View style={styles.loading}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>;
  return <View style={styles.screen} testID="hydration-config-screen">
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><Pressable style={styles.iconButton} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>HIDRATURSO</Text><Text style={styles.title}>Preferências</Text></View></View>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.lg }}>
      {error ? <View style={styles.error}><MaterialDesignIcons name="alert-circle-outline" size={18} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View> : null}
      <Section title="META DIÁRIA" subtitle="A meta atual foi preservada. Mudanças valem para hoje e os próximos dias; o histórico mantém a meta de cada data.">
        <View style={styles.unitRow}><Text style={styles.fieldLabel}>Unidade de entrada</Text><View style={styles.unitPicker}><Pressable accessibilityRole="button" accessibilityState={{ selected: goalUnit === "ml" }} style={[styles.unitOption, goalUnit === "ml" && styles.unitOptionOn]} onPress={() => changeGoalUnit("ml")}><Text style={[styles.unitText, goalUnit === "ml" && styles.unitTextOn]}>ml</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: goalUnit === "l" }} style={[styles.unitOption, goalUnit === "l" && styles.unitOptionOn]} onPress={() => changeGoalUnit("l")}><Text style={[styles.unitText, goalUnit === "l" && styles.unitTextOn]}>litros</Text></Pressable></View></View>
        <LabeledInput label={`Quantidade em ${goalUnit === "ml" ? "mililitros" : "litros"}`} value={goal} onChangeText={setGoal} keyboardType="decimal-pad" suffix={goalUnit} />
        <Text style={styles.preview}>{Number(goal.replace(",", ".")) > 0 ? `${(goalUnit === "l" ? Number(goal.replace(",", ".")) : Number(goal.replace(",", ".")) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} litros por dia` : "—"}</Text>
      </Section>
      <Section title="ROTINA E FUSO" subtitle="O esperado do dia cresce proporcionalmente entre a hora de acordar e dormir, inclusive quando a janela cruza a meia-noite.">
        <View style={styles.twoColumns}><View style={{ flex: 1 }}><LabeledInput label="Acordar" value={wake} onChangeText={setWake} placeholder="07:00" /></View><View style={{ flex: 1 }}><LabeledInput label="Dormir" value={sleep} onChangeText={setSleep} placeholder="23:00" /></View></View>
        <LabeledInput label="Fuso horário" value={timezone} onChangeText={setTimezone} placeholder="America/Fortaleza" />
      </Section>
      <Section title="LEMBRETES INTERNOS" subtitle="Aparecem apenas dentro do DietUrso. Não são notificações do sistema e respeitam o período silencioso.">
        <ToggleRow label="Ativar lembretes" value={alerts} onPress={() => setAlerts((value) => !value)} />
        {alerts ? <><Text style={styles.fieldLabel}>Intervalo mínimo</Text><View style={styles.chips}>{INTERVALS.map((value) => <Pressable key={value} style={[styles.chip, interval === value && styles.chipOn]} onPress={() => setInterval(value)}><Text style={[styles.chipText, interval === value && styles.chipTextOn]}>{value < 120 ? `${value} min` : `${value / 60} h`}</Text></Pressable>)}</View><ToggleRow label="Período silencioso" value={quietEnabled} onPress={() => setQuietEnabled((value) => !value)} />{quietEnabled ? <View style={styles.twoColumns}><View style={{ flex: 1 }}><LabeledInput label="Início" value={quietStart} onChangeText={setQuietStart} /></View><View style={{ flex: 1 }}><LabeledInput label="Fim" value={quietEnd} onChangeText={setQuietEnd} /></View></View> : null}</> : null}
      </Section>
      <View style={styles.safety}><MaterialDesignIcons name="information-outline" size={20} color={colors.brandSecondary} /><Text style={styles.safetyText}>O DietUrso acompanha a meta que você escolheu, sem sugerir diagnóstico ou substituir orientação profissional.</Text></View>
      <Pressable disabled={saving} style={[styles.saveButton, saving && { opacity: 0.55 }]} onPress={() => void save()}><Text style={styles.saveText}>{saving ? "Salvando…" : "Salvar preferências"}</Text></Pressable>
    </ScrollView>
    <Modal visible={confirmUnusual} transparent animationType="fade"><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Confirmar meta</Text><Text style={styles.modalText}>Você informou {goal} {goalUnit} por dia. Quer manter exatamente esse valor?</Text><Text style={styles.modalHint}>Esta confirmação é apenas para evitar erro de digitação.</Text><View style={styles.actions}><Pressable style={styles.cancel} onPress={() => setConfirmUnusual(false)}><Text style={styles.cancelText}>Revisar</Text></Pressable><Pressable style={styles.confirm} onPress={() => void save(true)}><Text style={styles.confirmText}>Confirmar</Text></Pressable></View></View></View></Modal>
  </View>;
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text>{children}</View>; }
function LabeledInput({ label, suffix, ...props }: React.ComponentProps<typeof TextInput> & { label: string; suffix?: string }) { return <View><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputWrap}><TextInput {...props} placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} />{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></View>; }
function ToggleRow({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) { return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} style={styles.toggleRow} onPress={onPress}><Text style={styles.toggleLabel}>{label}</Text><View style={[styles.toggle, value && styles.toggleOn]}><View style={[styles.toggleKnob, value && styles.toggleKnobOn]} /></View></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandSecondary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  error: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.error + "18", borderWidth: 1, borderColor: colors.error + "55", borderRadius: radius.md, padding: spacing.md }, errorText: { color: colors.onSurfaceSecondary, fontSize: 11, flex: 1 }, section: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }, sectionTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "900", letterSpacing: 1 }, sectionSubtitle: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, marginTop: -spacing.sm }, fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700", marginBottom: 5 }, unitRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, unitPicker: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 2 }, unitOption: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill }, unitOptionOn: { backgroundColor: colors.brandSecondary }, unitText: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "800" }, unitTextOn: { color: colors.onBrandSecondary }, inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingHorizontal: spacing.md }, input: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md, fontSize: 13 }, suffix: { color: colors.onSurfaceTertiary, fontSize: 11 }, preview: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700", textAlign: "right" }, twoColumns: { flexDirection: "row", gap: spacing.sm }, toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 }, toggleLabel: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" }, toggle: { width: 44, height: 25, padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, toggleOn: { backgroundColor: colors.brandPrimary }, toggleKnob: { width: 19, height: 19, borderRadius: radius.pill, backgroundColor: colors.onSurfaceTertiary }, toggleKnobOn: { backgroundColor: colors.onBrandPrimary, alignSelf: "flex-end" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, chipOn: { backgroundColor: colors.brandSecondary }, chipText: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" }, chipTextOn: { color: colors.onBrandSecondary }, safety: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.sm }, safetyText: { color: colors.onSurfaceTertiary, flex: 1, fontSize: 10, lineHeight: 15 }, saveButton: { backgroundColor: colors.brandPrimary, borderRadius: radius.md, alignItems: "center", padding: spacing.md }, saveText: { color: colors.onBrandPrimary, fontWeight: "900", fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "#000B", alignItems: "center", justifyContent: "center", padding: spacing.lg }, modal: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }, modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900" }, modalText: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 }, modalHint: { color: colors.onSurfaceTertiary, fontSize: 10 }, actions: { flexDirection: "row", gap: spacing.sm }, cancel: { flex: 1, alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }, cancelText: { color: colors.onSurface, fontWeight: "700" }, confirm: { flex: 1, alignItems: "center", backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md }, confirmText: { color: colors.onBrandPrimary, fontWeight: "900" },
});
