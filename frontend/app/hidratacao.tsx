import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { formatHydrationVolume, hydrationClock, hydrationSummary, selectHydrationAlert, snapshotFromConfig } from "../src/hydration/calculations";
import type { HydrationAlert, HydrationRecord, HydrationState } from "../src/hydration/types";
import {
  addHydrationRecord,
  deleteHydrationRecord,
  getHydrationState,
  recordHydrationAlert,
  undoLastHydrationRecord,
  updateHydrationRecord,
} from "../src/store/hydrationStore";
import { colors, radius, spacing } from "../src/theme";

const QUICK_AMOUNTS = [100, 200, 250, 300, 500, 1000];

export default function HydrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<HydrationState | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [editing, setEditing] = useState<HydrationRecord | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAlert, setActiveAlert] = useState<HydrationAlert | null>(null);
  const actionLock = useRef(false);

  const load = useCallback(async () => {
    const next = await getHydrationState();
    setState(next);
    const summary = hydrationSummary(next);
    const alert = selectHydrationAlert(next, summary);
    if (alert) {
      setActiveAlert(alert);
      void recordHydrationAlert(alert, "shown").catch(() => undefined);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const summary = useMemo(() => state ? hydrationSummary(state) : null, [state]);
  const todayRecords = useMemo(() => !state || !summary ? [] : state.records.filter((record) => record.localDate === summary.date).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), [state, summary]);
  const favorites = useMemo(() => state?.containers.filter((item) => item.isFavorite && !item.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder) ?? [], [state]);

  const optimisticAdd = async (amountMl: number, source: "quick" | "manual" | "container", containerId?: string) => {
    if (!state || actionLock.current) return;
    if (!Number.isFinite(amountMl) || amountMl <= 0) { setError("Informe uma quantidade válida."); return; }
    actionLock.current = true;
    setSaving(true);
    setError(null);
    const previous = state;
    const now = new Date();
    const timestamp = now.toISOString();
    const clock = hydrationClock(now, state.config);
    const container = containerId ? state.containers.find((item) => item.id === containerId) : undefined;
    const temporary: HydrationRecord = {
      id: `pending-${timestamp}`,
      amountMl,
      occurredAt: timestamp,
      localDate: clock.date,
      source,
      containerId,
      containerSnapshot: container ? { name: container.name, volumeMl: container.volumeMl, icon: container.icon, color: container.color } : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setState({ ...state, records: [...state.records, temporary], daySnapshots: state.daySnapshots[clock.date] ? state.daySnapshots : { ...state.daySnapshots, [clock.date]: snapshotFromConfig(state.config, clock.date, timestamp) } });
    try {
      await addHydrationRecord({ amountMl, source, containerId, idempotencyKey: `hydration-tap:${timestamp}:${amountMl}:${containerId ?? source}` });
      setManualAmount("");
      await load();
    } catch (cause) {
      setState(previous);
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar. A alteração foi desfeita.");
    } finally {
      actionLock.current = false;
      setSaving(false);
    }
  };

  const removeRecord = async (record: HydrationRecord) => {
    if (!state || actionLock.current) return;
    actionLock.current = true;
    const previous = state;
    setState({ ...state, records: state.records.filter((item) => item.id !== record.id) });
    try { await deleteHydrationRecord(record.id); await load(); }
    catch (cause) { setState(previous); setError(cause instanceof Error ? cause.message : "Não foi possível excluir. A alteração foi desfeita."); }
    finally { actionLock.current = false; }
  };

  const undo = async () => {
    if (!summary || actionLock.current) return;
    actionLock.current = true;
    setSaving(true);
    try {
      const removed = await undoLastHydrationRecord(summary.date);
      if (!removed) setError("Ainda não há registro para desfazer hoje.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível desfazer."); }
    finally { actionLock.current = false; setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editing || actionLock.current) return;
    const amountMl = Number(editAmount.replace(",", "."));
    if (!Number.isFinite(amountMl) || amountMl <= 0) { setError("Informe uma quantidade válida."); return; }
    actionLock.current = true;
    setSaving(true);
    try { await updateHydrationRecord(editing.id, { amountMl, notes: editNotes }); setEditing(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível editar."); }
    finally { actionLock.current = false; setSaving(false); }
  };

  const handleAlert = async (action: "dismiss" | "snooze") => {
    if (!activeAlert) return;
    const alert = activeAlert;
    setActiveAlert(null);
    try { await recordHydrationAlert(alert, action); } catch { setError("Não foi possível atualizar o lembrete."); }
  };

  if (!state || !summary) return <View style={styles.loading}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>;
  const paceColor = summary.pace === "ahead" ? colors.brandPrimary : summary.pace === "behind" ? colors.brandTertiary : colors.brandSecondary;

  return (
    <View style={styles.screen} testID="hydration-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>HIDRATAÇÃO INTELIGENTE</Text><Text style={styles.title}>HidratUrso</Text></View>
        <Pressable style={styles.iconButton} onPress={() => router.push("/hidratacao-historico")} accessibilityLabel="Histórico"><MaterialDesignIcons name="chart-timeline-variant" size={20} color={colors.onSurface} /></Pressable>
        <Pressable style={styles.iconButton} onPress={() => router.push("/hidratacao-config")} accessibilityLabel="Configurações"><MaterialDesignIcons name="cog-outline" size={20} color={colors.onSurface} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.lg }}>
        {error ? <Pressable style={styles.error} onPress={() => setError(null)}><MaterialDesignIcons name="alert-circle-outline" size={18} color={colors.error} /><Text style={styles.errorText}>{error}</Text><MaterialDesignIcons name="close" size={16} color={colors.onSurfaceTertiary} /></Pressable> : null}
        {activeAlert ? <View style={styles.alert}><View style={styles.alertIcon}><MaterialDesignIcons name="water-alert-outline" size={24} color={colors.brandSecondary} /></View><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{activeAlert.title}</Text><Text style={styles.alertText}>{activeAlert.message}</Text><View style={styles.alertActions}><Pressable onPress={() => void handleAlert("snooze")}><Text style={styles.alertAction}>Lembrar depois</Text></Pressable><Pressable onPress={() => void handleAlert("dismiss")}><Text style={styles.alertAction}>Dispensar</Text></Pressable></View></View></View> : null}

        <View style={styles.hero}>
          <View style={styles.heroTop}><View><Text style={styles.heroLabel}>CONSUMIDO HOJE</Text><Text style={styles.heroAmount}>{formatHydrationVolume(summary.consumedMl)}</Text><Text style={styles.heroGoal}>Meta {formatHydrationVolume(summary.goalMl)} · {Math.round(summary.percentage)}%</Text></View><View style={[styles.paceBadge, { borderColor: paceColor }]}><MaterialDesignIcons name={summary.pace === "ahead" ? "arrow-up-bold" : summary.pace === "behind" ? "arrow-down-bold" : "check-bold"} size={15} color={paceColor} /><Text style={[styles.paceText, { color: paceColor }]}>{summary.pace === "ahead" ? "Adiantado" : summary.pace === "behind" ? "Abaixo do ritmo" : "No ritmo"}</Text></View></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(summary.percentage, summary.consumedMl ? 2 : 0))}%` }]} /></View>
          <View style={styles.metrics}><Metric label="Esperado agora" value={formatHydrationVolume(summary.expectedMl)} /><Metric label={summary.remainingMl ? "Falta para a meta" : "Acima da meta"} value={formatHydrationVolume(summary.remainingMl || Math.max(0, summary.consumedMl - summary.goalMl))} /><Metric label="Janela ativa" value={`${Math.round(summary.activeProgress * 100)}%`} /></View>
        </View>

        <View><Text style={styles.sectionTitle}>REGISTRO RÁPIDO</Text><View style={styles.quickGrid}>{QUICK_AMOUNTS.map((amount) => <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar ${amount === 1000 ? "1 litro" : `${amount} mililitros`}`} disabled={saving} key={amount} style={[styles.quickButton, saving && { opacity: 0.55 }]} onPress={() => void optimisticAdd(amount, "quick")} testID={`quick-water-${amount}`}><MaterialDesignIcons name="water-plus-outline" size={19} color={colors.brandSecondary} /><Text style={styles.quickAmount}>+{amount === 1000 ? "1" : amount}</Text><Text style={styles.quickUnit}>{amount === 1000 ? "L" : "ml"}</Text></Pressable>)}</View></View>

        {favorites.length ? <View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>MEUS RECIPIENTES</Text><Pressable accessibilityRole="button" onPress={() => router.push("/hidratacao-recipientes")}><Text style={styles.manage}>Gerenciar</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{favorites.map((container) => <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar ${container.volumeMl} mililitros usando ${container.name}`} key={container.id} disabled={saving} style={styles.container} onPress={() => void optimisticAdd(container.volumeMl, "container", container.id)}><View style={[styles.containerIcon, { backgroundColor: `${container.color ?? colors.brandSecondary}22` }]}><MaterialDesignIcons name={(container.icon ?? "cup-water") as never} size={22} color={container.color ?? colors.brandSecondary} /></View><Text style={styles.containerName}>{container.name}</Text><Text style={styles.containerVolume}>+{container.volumeMl} ml</Text></Pressable>)}</ScrollView></View> : null}

        <View><Text style={styles.sectionTitle}>OUTRA QUANTIDADE</Text><View style={styles.manual}><TextInput accessibilityLabel="Quantidade manual de água em mililitros" value={manualAmount} onChangeText={setManualAmount} keyboardType="numeric" placeholder="Ex.: 350" placeholderTextColor={colors.onSurfaceTertiary} style={styles.manualInput} /><Text style={styles.manualUnit}>ml</Text><Pressable accessibilityRole="button" disabled={saving} style={styles.manualButton} onPress={() => void optimisticAdd(Number(manualAmount.replace(",", ".")), "manual")}><Text style={styles.manualButtonText}>Adicionar</Text></Pressable></View></View>

        <View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>REGISTROS DE HOJE · {todayRecords.length}</Text><Pressable accessibilityRole="button" disabled={!todayRecords.length || saving} onPress={() => void undo()}><Text style={[styles.manage, !todayRecords.length && { opacity: 0.4 }]}>Desfazer último</Text></Pressable></View>{todayRecords.length ? <View style={{ gap: spacing.sm }}>{todayRecords.map((record) => <View key={record.id} style={styles.record}><View style={styles.recordIcon}><MaterialDesignIcons name={record.source === "container" ? "bottle-soda-classic-outline" : "water"} size={19} color={colors.brandSecondary} /></View><View style={{ flex: 1 }}><Text style={styles.recordAmount}>{formatHydrationVolume(record.amountMl)}</Text><Text style={styles.recordMeta}>{record.containerSnapshot?.name ?? (record.source === "manual" ? "Quantidade manual" : record.source === "legacy" ? "Registro anterior" : "Registro rápido")} · {new Date(record.occurredAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</Text>{record.notes ? <Text style={styles.recordNote}>{record.notes}</Text> : null}</View><Pressable accessibilityRole="button" accessibilityLabel={`Editar registro de ${record.amountMl} mililitros`} style={styles.smallAction} onPress={() => { setEditing(record); setEditAmount(String(record.amountMl)); setEditNotes(record.notes ?? ""); }}><MaterialDesignIcons name="pencil-outline" size={17} color={colors.onSurfaceSecondary} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Excluir registro de ${record.amountMl} mililitros`} style={styles.smallAction} onPress={() => void removeRecord(record)}><MaterialDesignIcons name="trash-can-outline" size={17} color={colors.error} /></Pressable></View>)}</View> : <View style={styles.empty}><MaterialDesignIcons name="cup-water" size={34} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>Seu primeiro gole aparece aqui</Text><Text style={styles.emptyText}>Use um atalho, recipiente favorito ou informe outra quantidade.</Text></View>}</View>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Editar registro</Text><Text style={styles.fieldLabel}>Quantidade (ml)</Text><TextInput value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" style={styles.input} /><Text style={styles.fieldLabel}>Observação opcional</Text><TextInput value={editNotes} onChangeText={setEditNotes} style={styles.input} placeholder="Ex.: durante o treino" placeholderTextColor={colors.onSurfaceTertiary} /><View style={styles.modalActions}><Pressable style={styles.cancel} onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={styles.save} onPress={() => void saveEdit()}><Text style={styles.saveText}>Salvar</Text></Pressable></View></View></View></Modal>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandSecondary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  error: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.error + "18", borderWidth: 1, borderColor: colors.error + "55", padding: spacing.md, borderRadius: radius.md }, errorText: { color: colors.onSurfaceSecondary, flex: 1, fontSize: 11, lineHeight: 16 },
  alert: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.brandSecondary + "16", borderWidth: 1, borderColor: colors.brandSecondary + "55", borderRadius: radius.lg, padding: spacing.md }, alertIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandSecondary + "22" }, alertTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, alertText: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16, marginTop: 3 }, alertActions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm }, alertAction: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800" },
  hero: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brandSecondary + "55", padding: spacing.lg, gap: spacing.lg }, heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }, heroLabel: { color: colors.brandSecondary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, heroAmount: { color: colors.onSurface, fontSize: 38, fontWeight: "900", marginTop: 2 }, heroGoal: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600" }, paceBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 }, paceText: { fontSize: 9, fontWeight: "900" }, progressTrack: { height: 10, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, overflow: "hidden" }, progressFill: { height: "100%", backgroundColor: colors.brandSecondary, borderRadius: radius.pill }, metrics: { flexDirection: "row", gap: spacing.sm }, metric: { flex: 1 }, metricValue: { color: colors.onSurface, fontSize: 13, fontWeight: "800" }, metricLabel: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginBottom: spacing.sm }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, manage: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800", marginBottom: spacing.sm }, quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, quickButton: { width: "31%", minWidth: 92, flexGrow: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 3, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md }, quickAmount: { color: colors.onSurface, fontSize: 16, fontWeight: "900" }, quickUnit: { color: colors.onSurfaceTertiary, fontSize: 9 },
  container: { width: 112, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, containerIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm }, containerName: { color: colors.onSurface, fontSize: 12, fontWeight: "800" }, containerVolume: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  manual: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingLeft: spacing.md }, manualInput: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md, fontSize: 15 }, manualUnit: { color: colors.onSurfaceTertiary, fontSize: 11 }, manualButton: { backgroundColor: colors.brandPrimary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, margin: 4 }, manualButtonText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" },
  record: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, recordIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandSecondary + "1F", alignItems: "center", justifyContent: "center" }, recordAmount: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, recordMeta: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 }, recordNote: { color: colors.onSurfaceSecondary, fontSize: 9, marginTop: 3, fontStyle: "italic" }, smallAction: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }, empty: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xxl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, emptyText: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "#000B", alignItems: "center", justifyContent: "center", padding: spacing.lg }, modal: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm }, modalTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "900", marginBottom: spacing.sm }, fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" }, input: { color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }, modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }, cancel: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, cancelText: { color: colors.onSurface, fontWeight: "700" }, save: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandPrimary }, saveText: { color: colors.onBrandPrimary, fontWeight: "900" },
});
