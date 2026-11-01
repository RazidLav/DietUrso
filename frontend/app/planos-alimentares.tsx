import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentContainer, PageHeader, PrimaryButton, StatusBadge } from "../src/components/DesignSystem";
import { useResponsiveLayout } from "../src/responsive";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import {
  createEmptyPlan,
  deletePlan,
  duplicatePlan,
  getActivePlanId,
  listPlans,
  setActivePlanId,
  toggleArchivePlan,
  updatePlan,
} from "../src/store/planStore";
import { areaColors, colors, radius, spacing, withAlpha } from "../src/theme";
import type { Plan } from "../src/types/plan";

export default function FoodPlansScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextPlans, nextActive] = await Promise.all([listPlans(), getActivePlanId()]);
    setPlans(nextPlans);
    setActiveId(nextActive);
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const create = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const plan = await createEmptyPlan(name.trim());
      if (description.trim()) await updatePlan({ ...plan, description: description.trim(), updatedAt: new Date().toISOString() });
      if (!activeId) await setActivePlanId(plan.id);
      setName(""); setDescription(""); setCreateOpen(false);
      router.push(`/editor/${plan.id}`);
    } finally { setSaving(false); }
  };
  const activate = async (id: string) => { await setActivePlanId(id); await load(); };
  const duplicate = async (id: string) => { const copy = await duplicatePlan(id); await load(); router.push(`/editor/${copy.id}`); };
  const archive = async (id: string) => { await toggleArchivePlan(id); await load(); };
  const remove = async () => { if (!deleteTarget) return; await deletePlan(deleteTarget.id); setDeleteTarget(null); await load(); };

  const activePlans = plans.filter((plan) => !plan.archived);
  const archivedPlans = plans.filter((plan) => plan.archived);
  return <View style={styles.screen} testID="food-plans-screen">
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxxl }}>
      <ContentContainer maxWidth={1080} style={styles.content}>
        <PageHeader eyebrow="DIETA" title="Planos alimentares" description="Crie sua rotina, monte cada refeição com alimentos e receitas e acompanhe os macros antes de ativar." onBack={() => router.back()} action={<PrimaryButton icon="plus" label="Criar plano" onPress={() => setCreateOpen(true)} />} accent={areaColors.food} />
        <Text style={styles.sectionTitle}>Planos ativos</Text>
        {activePlans.length ? activePlans.map((plan) => <PlanRow key={plan.id} plan={plan} active={plan.id === activeId} onActivate={() => void activate(plan.id)} onEdit={() => router.push(`/editor/${plan.id}`)} onDuplicate={() => void duplicate(plan.id)} onArchive={() => void archive(plan.id)} onDelete={() => setDeleteTarget(plan)} />) : <EmptyPlans onCreate={() => setCreateOpen(true)} />}
        {archivedPlans.length ? <><Text style={styles.sectionTitle}>Arquivados</Text>{archivedPlans.map((plan) => <PlanRow key={plan.id} plan={plan} active={false} onActivate={() => void activate(plan.id)} onEdit={() => router.push(`/editor/${plan.id}`)} onDuplicate={() => void duplicate(plan.id)} onArchive={() => void archive(plan.id)} onDelete={() => setDeleteTarget(plan)} />)}</> : null}
      </ContentContainer>
    </ScrollView>
    <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}><View style={styles.overlay}><View style={styles.modal} testID="create-food-plan-modal"><Text style={styles.modalEyebrow}>NOVO PLANO ALIMENTAR</Text><Text style={styles.modalTitle}>Como vamos chamar este plano?</Text><Text style={styles.label}>Nome</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Ex.: Rotina de novembro" placeholderTextColor={colors.onSurfaceTertiary} autoFocus testID="new-plan-name-input" /><Text style={styles.label}>Descrição (opcional)</Text><TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.multiline]} placeholder="Objetivo ou observações gerais" placeholderTextColor={colors.onSurfaceTertiary} multiline /><View style={styles.modalActions}><Pressable style={styles.secondary} onPress={() => setCreateOpen(false)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable disabled={!name.trim() || saving} style={[styles.primary, (!name.trim() || saving) && styles.disabled]} onPress={() => void create()} testID="new-plan-confirm-btn"><Text style={styles.primaryText}>{saving ? "Criando…" : "Criar e montar"}</Text></Pressable></View></View></View></Modal>
    <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Excluir plano?</Text><Text style={styles.modalDescription}>“{deleteTarget?.name}” será removido. Seus registros alimentares já feitos continuam no histórico.</Text><View style={styles.modalActions}><Pressable style={styles.secondary} onPress={() => setDeleteTarget(null)}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={[styles.primary, { backgroundColor: colors.error }]} onPress={() => void remove()} testID="confirm-delete-btn"><Text style={[styles.primaryText, { color: colors.onError }]}>Excluir</Text></Pressable></View></View></View></Modal>
  </View>;
}

function PlanRow({ plan, active, onActivate, onEdit, onDuplicate, onArchive, onDelete }: { plan: Plan; active: boolean; onActivate: () => void; onEdit: () => void; onDuplicate: () => void; onArchive: () => void; onDelete: () => void }) {
  const { isPhone } = useResponsiveLayout();
  const options = plan.meals.reduce((total, meal) => total + meal.options.length, 0);
  return <View style={[styles.plan, isPhone && styles.planPhone, active && styles.planActive]} testID={`plan-item-${plan.id}`}>
    <View style={styles.planIcon}><MaterialDesignIcons name="clipboard-text-outline" size={23} color={areaColors.food} /></View>
    <View style={[styles.planCopy, isPhone && styles.planCopyPhone]}><View style={styles.planTitleRow}><Text style={styles.planTitle}>{plan.name}</Text>{active ? <StatusBadge label="ATIVO" tone="success" /> : null}{plan.archived ? <StatusBadge label="ARQUIVADO" /> : null}</View><Text style={styles.planMeta}>{plan.meals.length} refeições · {options} opções{plan.description ? ` · ${plan.description}` : ""}</Text></View>
    <View style={[styles.actions, isPhone && styles.actionsPhone]}>{!active && !plan.archived ? <Action icon="check-circle-outline" label="Ativar" onPress={onActivate} primary /> : null}<Action icon="pencil-outline" label="Editar" onPress={onEdit} /><Action icon="content-copy" label="Duplicar" onPress={onDuplicate} /><Action icon={plan.archived ? "archive-arrow-up-outline" : "archive-outline"} label={plan.archived ? "Desarquivar" : "Arquivar"} onPress={onArchive} /><Action icon="trash-can-outline" label="Excluir" onPress={onDelete} danger /></View>
  </View>;
}
function Action({ icon, label, onPress, danger, primary }: { icon: string; label: string; onPress: () => void; danger?: boolean; primary?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.action, primary && styles.actionPrimary]}><MaterialDesignIcons name={icon as never} size={19} color={danger ? colors.error : primary ? colors.onBrandPrimary : colors.onSurfaceSecondary} /></Pressable>; }
function EmptyPlans({ onCreate }: { onCreate: () => void }) { return <View style={styles.empty}><MaterialDesignIcons name="silverware-fork-knife" size={34} color={areaColors.food} /><Text style={styles.emptyTitle}>Nenhum plano alimentar</Text><Text style={styles.modalDescription}>Crie o primeiro plano e monte as refeições sem sair da área Dieta.</Text><PrimaryButton icon="plus" label="Criar plano" onPress={onCreate} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { gap: spacing.md }, sectionTitle: { marginTop: spacing.md, color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  plan: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }, planPhone: { flexWrap: "wrap", alignItems: "flex-start" }, planActive: { borderColor: withAlpha(areaColors.food, 0.75), backgroundColor: withAlpha(areaColors.food, 0.07) }, planIcon: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: withAlpha(areaColors.food, 0.13) }, planCopy: { flex: 1, minWidth: 120 }, planCopyPhone: { flexBasis: 220 }, planTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }, planTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", flexShrink: 1 }, planMeta: { color: colors.onSurfaceTertiary, fontSize: 10.5, lineHeight: 15, marginTop: 4 }, actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: spacing.xs }, actionsPhone: { width: "100%", justifyContent: "flex-end" }, action: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, actionPrimary: { backgroundColor: colors.brandPrimary },
  empty: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong, borderRadius: radius.lg }, emptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, backgroundColor: colors.overlay }, modal: { width: "100%", maxWidth: 470, gap: spacing.md, padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated }, modalEyebrow: { color: areaColors.food, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, modalTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900" }, modalDescription: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 17, textAlign: "center" }, label: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "800", marginBottom: -6 }, input: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface }, multiline: { minHeight: 76, paddingTop: spacing.md, textAlignVertical: "top" }, modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm }, secondary: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, secondaryText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, primary: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, primaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.45 },
});
