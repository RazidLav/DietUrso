import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, TextInput, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../src/theme";
import {
  createEmptyPlan,
  deletePlan,
  getActivePlanId,
  listPlans,
  setActivePlanId,
  toggleArchivePlan,
} from "../../src/store/planStore";
import type { Plan } from "../../src/types/plan";

export default function AjustesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDel, setConfirmDel] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    setPlans(await listPlans());
    setActiveIdState(await getActivePlanId());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleActivate = async (id: string) => {
    await setActivePlanId(id);
    await load();
  };
  const handleArchive = async (id: string) => {
    await toggleArchivePlan(id);
    await load();
  };
  const handleDelete = async () => {
    if (!confirmDel) return;
    await deletePlan(confirmDel.id);
    setConfirmDel(null);
    await load();
  };
  const handleCreate = async () => {
    const name = newName.trim() || "Novo plano";
    const plan = await createEmptyPlan(name);
    setNewName("");
    setShowCreate(false);
    await load();
    router.push(`/editor/${plan.id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="ajustes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.eyebrow}>AJUSTES</Text>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Meus planos</Text>
          <Pressable
            style={styles.newBtn}
            onPress={() => setShowCreate(true)}
            testID="new-plan-btn"
          >
            <MaterialDesignIcons name="plus" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.newBtnText}>Novo</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm }}>
        {plans.map((p) => {
          const active = p.id === activeId;
          return (
            <View
              key={p.id}
              style={[styles.planCard, active && styles.planCardActive]}
              testID={`plan-item-${p.id}`}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.planTitleRow}>
                  <Text style={styles.planName} numberOfLines={1}>{p.name}</Text>
                  {active ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ATIVO</Text>
                    </View>
                  ) : null}
                  {p.archived ? (
                    <View style={styles.archBadge}>
                      <Text style={styles.archBadgeText}>arquivado</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.planMeta}>{p.meals.length} refeições</Text>
              </View>
              <View style={styles.planActions}>
                {!active ? (
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => handleActivate(p.id)}
                    testID={`activate-${p.id}`}
                  >
                    <MaterialDesignIcons name="check-circle-outline" size={22} color={colors.brandPrimary} />
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => router.push(`/editor/${p.id}`)}
                  testID={`edit-${p.id}`}
                >
                  <MaterialDesignIcons name="pencil-outline" size={22} color={colors.onSurface} />
                </Pressable>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => handleArchive(p.id)}
                  testID={`archive-${p.id}`}
                >
                  <MaterialDesignIcons
                    name={p.archived ? "archive-arrow-up-outline" : "archive-outline"}
                    size={22}
                    color={colors.onSurfaceSecondary}
                  />
                </Pressable>
                <Pressable
                  style={styles.iconBtn}
                  onPress={() => setConfirmDel(p)}
                  testID={`delete-${p.id}`}
                >
                  <MaterialDesignIcons name="trash-can-outline" size={22} color={colors.error} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Create modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Novo plano</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do plano"
              placeholderTextColor={colors.muted}
              value={newName}
              onChangeText={setNewName}
              testID="new-plan-name-input"
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setShowCreate(false)}>
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.modalBtnPrimary} onPress={handleCreate} testID="new-plan-confirm-btn">
                <Text style={styles.modalBtnPrimaryText}>Criar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm */}
      <Modal visible={!!confirmDel} transparent animationType="fade" onRequestClose={() => setConfirmDel(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Excluir plano?</Text>
            <Text style={styles.modalDesc}>
              {confirmDel?.name} será removido permanentemente.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnSecondary} onPress={() => setConfirmDel(null)}>
                <Text style={styles.modalBtnSecondaryText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtnPrimary, { backgroundColor: colors.error }]}
                onPress={handleDelete}
                testID="confirm-delete-btn"
              >
                <Text style={[styles.modalBtnPrimaryText, { color: colors.onError }]}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  newBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  planCard: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  planCardActive: { borderColor: colors.brandPrimary },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  planName: { color: colors.onSurface, fontSize: 16, fontWeight: "700", flexShrink: 1 },
  planMeta: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 4 },
  activeBadge: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 10 },
  archBadge: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  archBadgeText: { color: colors.onSurfaceTertiary, fontWeight: "700", fontSize: 10 },
  planActions: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  modalTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  modalDesc: { color: colors.onSurfaceTertiary, fontSize: 14 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    padding: spacing.md,
    borderRadius: radius.md,
    fontSize: 15,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
  modalBtnSecondary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  modalBtnSecondaryText: { color: colors.onSurface, fontWeight: "600" },
  modalBtnPrimary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  modalBtnPrimaryText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
