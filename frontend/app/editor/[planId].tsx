import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../src/theme";
import {
  deleteFood,
  deleteMeal,
  deleteOption,
  listPlans,
  optionMacros,
  upsertFood,
  upsertMeal,
  upsertOption,
  updatePlan,
} from "../../src/store/planStore";
import { MEAL_TYPES } from "../../src/data/dietData";
import type { Food, Meal, MealOption, Plan, Substitution, Unit } from "../../src/types/plan";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

type ModalMode =
  | { kind: "none" }
  | { kind: "meal"; meal?: Meal }
  | { kind: "option"; mealId: string; option?: MealOption }
  | { kind: "food"; mealId: string; optionId: string; food?: Food };

export default function EditorScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [modal, setModal] = useState<ModalMode>({ kind: "none" });

  const load = useCallback(async () => {
    const all = await listPlans();
    setPlan(all.find((p) => p.id === planId) ?? null);
  }, [planId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!plan) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.emptyText}>Plano não encontrado.</Text>
      </View>
    );
  }

  const savePlanName = async (name: string) => {
    await updatePlan({ ...plan, name });
    await load();
  };

  const doDeleteMeal = async (mealId: string) => {
    await deleteMeal(plan.id, mealId);
    await load();
  };
  const doDeleteOption = async (mealId: string, optId: string) => {
    await deleteOption(plan.id, mealId, optId);
    await load();
  };
  const doDeleteFood = async (mealId: string, optId: string, foodId: string) => {
    await deleteFood(plan.id, mealId, optId, foodId);
    await load();
  };
  const doDuplicateMeal = async (meal: Meal) => {
    const copy: Meal = {
      ...meal,
      id: uid(),
      name: meal.name + " (cópia)",
      options: meal.options.map((o) => ({
        ...o,
        id: uid(),
        foods: o.foods.map((f) => ({ ...f, id: uid() })),
      })),
    };
    await upsertMeal(plan.id, copy);
    await load();
  };
  const doDuplicateOption = async (mealId: string, opt: MealOption) => {
    const copy: MealOption = {
      ...opt,
      id: uid(),
      name: opt.name + " (cópia)",
      foods: opt.foods.map((f) => ({ ...f, id: uid() })),
    };
    await upsertOption(plan.id, mealId, copy);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="editor-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} testID="editor-back-btn">
            <MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>EDITAR PLANO</Text>
            <PlanNameInput value={plan.name} onSave={savePlanName} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md }}>
        <Pressable
          style={styles.addBtn}
          onPress={() => setModal({ kind: "meal" })}
          testID="add-meal-btn"
        >
          <MaterialDesignIcons name="plus" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.addBtnText}>Adicionar refeição</Text>
        </Pressable>

        {plan.meals.map((meal) => (
          <View key={meal.id} style={styles.mealBlock} testID={`edit-meal-${meal.id}`}>
            <View style={styles.mealHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealMeta}>{meal.options.length} opções</Text>
              </View>
              <ActionsRow
                onEdit={() => setModal({ kind: "meal", meal })}
                onDuplicate={() => doDuplicateMeal(meal)}
                onDelete={() => doDeleteMeal(meal.id)}
              />
            </View>

            <View style={styles.optionsBlock}>
              {meal.options.map((opt, i) => {
                const mac = optionMacros(opt);
                return (
                  <View key={opt.id} style={styles.optionRow} testID={`edit-option-${opt.id}`}>
                    <View style={styles.optionHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.optionTitle}>Opção {i + 1} — {opt.name}</Text>
                        <Text style={styles.optionMeta}>
                          {Math.round(mac.kcal)} kcal · P {Math.round(mac.protein)}g · C {Math.round(mac.carbs)}g · G {Math.round(mac.fats)}g
                        </Text>
                      </View>
                      <ActionsRow
                        onEdit={() => setModal({ kind: "option", mealId: meal.id, option: opt })}
                        onDuplicate={() => doDuplicateOption(meal.id, opt)}
                        onDelete={() => doDeleteOption(meal.id, opt.id)}
                      />
                    </View>
                    <View style={{ gap: spacing.xs }}>
                      {opt.foods.map((food) => (
                        <View key={food.id} style={styles.foodEditRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.foodEditName}>{food.name}</Text>
                            <Text style={styles.foodEditMeta}>
                              {food.quantity} {food.unit} · {food.kcal !== null ? Math.round(food.kcal) : "—"} kcal
                              {food.substitutions.length > 0 ? ` · ${food.substitutions.length} sub.` : ""}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => setModal({ kind: "food", mealId: meal.id, optionId: opt.id, food })}
                            style={styles.smallIcon}
                            testID={`edit-food-${food.id}`}
                          >
                            <MaterialDesignIcons name="pencil" size={16} color={colors.onSurface} />
                          </Pressable>
                          <Pressable
                            onPress={() => doDeleteFood(meal.id, opt.id, food.id)}
                            style={styles.smallIcon}
                            testID={`delete-food-${food.id}`}
                          >
                            <MaterialDesignIcons name="trash-can-outline" size={16} color={colors.error} />
                          </Pressable>
                        </View>
                      ))}
                      <Pressable
                        style={styles.addSmall}
                        onPress={() => setModal({ kind: "food", mealId: meal.id, optionId: opt.id })}
                        testID={`add-food-${opt.id}`}
                      >
                        <MaterialDesignIcons name="plus" size={14} color={colors.brandPrimary} />
                        <Text style={styles.addSmallText}>Adicionar alimento</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              <Pressable
                style={styles.addSmall}
                onPress={() => setModal({ kind: "option", mealId: meal.id })}
                testID={`add-option-${meal.id}`}
              >
                <MaterialDesignIcons name="plus" size={14} color={colors.brandPrimary} />
                <Text style={styles.addSmallText}>Adicionar opção</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <EditorModals
        mode={modal}
        planId={plan.id}
        onClose={() => setModal({ kind: "none" })}
        onDone={async () => {
          setModal({ kind: "none" });
          await load();
        }}
      />
    </View>
  );
}

function PlanNameInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <TextInput
      style={styles.planNameInput}
      value={v}
      onChangeText={setV}
      onBlur={() => v.trim() && v.trim() !== value && onSave(v.trim())}
      testID="plan-name-input"
    />
  );
}

function ActionsRow({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.xs }}>
      <Pressable onPress={onEdit} style={styles.smallIcon}>
        <MaterialDesignIcons name="pencil" size={16} color={colors.onSurface} />
      </Pressable>
      <Pressable onPress={onDuplicate} style={styles.smallIcon}>
        <MaterialDesignIcons name="content-copy" size={16} color={colors.onSurface} />
      </Pressable>
      <Pressable onPress={onDelete} style={styles.smallIcon}>
        <MaterialDesignIcons name="trash-can-outline" size={16} color={colors.error} />
      </Pressable>
    </View>
  );
}

// ---------- Modals ----------
function EditorModals({
  mode,
  planId,
  onClose,
  onDone,
}: {
  mode: ModalMode;
  planId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  if (mode.kind === "none") return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={mStyles.wrap}
      >
        <View style={mStyles.card}>
          {mode.kind === "meal" ? (
            <MealForm planId={planId} meal={mode.meal} onDone={onDone} onCancel={onClose} />
          ) : mode.kind === "option" ? (
            <OptionForm planId={planId} mealId={mode.mealId} option={mode.option} onDone={onDone} onCancel={onClose} />
          ) : (
            <FoodForm
              planId={planId}
              mealId={mode.mealId}
              optionId={mode.optionId}
              food={mode.food}
              onDone={onDone}
              onCancel={onClose}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MealForm({ planId, meal, onDone, onCancel }: any) {
  const [name, setName] = useState<string>(meal?.name ?? "");
  const [type, setType] = useState<string>(meal?.type ?? "lanche");
  const submit = async () => {
    const m: Meal = {
      id: meal?.id ?? uid(),
      type,
      name: name.trim() || "Nova refeição",
      options: meal?.options ?? [],
    };
    await upsertMeal(planId, m);
    onDone();
  };
  return (
    <ScrollView>
      <Text style={mStyles.title}>{meal ? "Editar refeição" : "Nova refeição"}</Text>
      <Text style={mStyles.label}>Nome</Text>
      <TextInput style={mStyles.input} value={name} onChangeText={setName} testID="meal-name-input" />
      <Text style={mStyles.label}>Tipo</Text>
      <View style={mStyles.chipRow}>
        {MEAL_TYPES.map((t) => (
          <Pressable
            key={t.key}
            style={[mStyles.chip, type === t.key && mStyles.chipSelected]}
            onPress={() => setType(t.key)}
          >
            <Text style={[mStyles.chipText, type === t.key && mStyles.chipTextSel]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <FormActions onCancel={onCancel} onSave={submit} />
    </ScrollView>
  );
}

function OptionForm({ planId, mealId, option, onDone, onCancel }: any) {
  const [name, setName] = useState<string>(option?.name ?? "");
  const [notes, setNotes] = useState<string>(option?.notes ?? "");
  const submit = async () => {
    const o: MealOption = {
      id: option?.id ?? uid(),
      name: name.trim() || "Nova opção",
      notes,
      foods: option?.foods ?? [],
    };
    await upsertOption(planId, mealId, o);
    onDone();
  };
  return (
    <ScrollView>
      <Text style={mStyles.title}>{option ? "Editar opção" : "Nova opção"}</Text>
      <Text style={mStyles.label}>Nome</Text>
      <TextInput style={mStyles.input} value={name} onChangeText={setName} testID="option-name-input" />
      <Text style={mStyles.label}>Observações</Text>
      <TextInput
        style={[mStyles.input, { minHeight: 60 }]}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <FormActions onCancel={onCancel} onSave={submit} />
    </ScrollView>
  );
}

function FoodForm({ planId, mealId, optionId, food, onDone, onCancel }: any) {
  const [name, setName] = useState<string>(food?.name ?? "");
  const [qty, setQty] = useState<string>(String(food?.quantity ?? ""));
  const [unit, setUnit] = useState<Unit>(food?.unit ?? "g");
  const [kcal, setKcal] = useState<string>(food?.kcal !== null && food?.kcal !== undefined ? String(food.kcal) : "");
  const [p, setP] = useState<string>(food?.protein !== null && food?.protein !== undefined ? String(food.protein) : "");
  const [c, setC] = useState<string>(food?.carbs !== null && food?.carbs !== undefined ? String(food.carbs) : "");
  const [g, setG] = useState<string>(food?.fats !== null && food?.fats !== undefined ? String(food.fats) : "");
  const [notes, setNotes] = useState<string>(food?.notes ?? "");
  const [subs, setSubs] = useState<Substitution[]>(food?.substitutions ?? []);

  const addSub = () => {
    setSubs((prev) => [...prev, { id: uid(), name: "", quantity: 0, unit: "g", kcal: null, protein: null, carbs: null, fats: null }]);
  };
  const updateSub = (i: number, patch: Partial<Substitution>) => {
    setSubs((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const rmSub = (i: number) => setSubs((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async () => {
    const f: Food = {
      id: food?.id ?? uid(),
      name: name.trim() || "Alimento",
      quantity: Number(qty) || 0,
      unit,
      kcal: kcal === "" ? null : Number(kcal),
      protein: p === "" ? null : Number(p),
      carbs: c === "" ? null : Number(c),
      fats: g === "" ? null : Number(g),
      notes,
      substitutions: subs.filter((s) => s.name.trim()),
    };
    await upsertFood(planId, mealId, optionId, f);
    onDone();
  };

  return (
    <ScrollView>
      <Text style={mStyles.title}>{food ? "Editar alimento" : "Novo alimento"}</Text>
      <Text style={mStyles.label}>Nome</Text>
      <TextInput style={mStyles.input} value={name} onChangeText={setName} testID="food-name-input" />

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={mStyles.label}>Quantidade</Text>
          <TextInput
            style={mStyles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            testID="food-qty-input"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={mStyles.label}>Unidade</Text>
          <View style={mStyles.unitRow}>
            {(["g", "ml", "un"] as Unit[]).map((u) => (
              <Pressable
                key={u}
                style={[mStyles.unitChip, unit === u && mStyles.unitChipSel]}
                onPress={() => setUnit(u)}
              >
                <Text style={[mStyles.unitChipText, unit === u && { color: colors.onBrandPrimary }]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <SmallField label="kcal" v={kcal} on={setKcal} />
        <SmallField label="P (g)" v={p} on={setP} color={colors.protein} />
        <SmallField label="C (g)" v={c} on={setC} color={colors.carbs} />
        <SmallField label="G (g)" v={g} on={setG} color={colors.fats} />
      </View>

      <Text style={mStyles.label}>Observações</Text>
      <TextInput style={[mStyles.input, { minHeight: 50 }]} value={notes} onChangeText={setNotes} multiline />

      <View style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center" }}>
        <Text style={[mStyles.label, { flex: 1 }]}>Substituições</Text>
        <Pressable onPress={addSub} style={mStyles.addSubBtn} testID="add-sub-btn">
          <MaterialDesignIcons name="plus" size={14} color={colors.onBrandPrimary} />
          <Text style={mStyles.addSubText}>Nova</Text>
        </Pressable>
      </View>
      {subs.map((s, i) => (
        <View key={s.id} style={mStyles.subEdit}>
          <TextInput
            style={mStyles.input}
            placeholder="Nome da substituição"
            placeholderTextColor={colors.muted}
            value={s.name}
            onChangeText={(v) => updateSub(i, { name: v })}
          />
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              style={[mStyles.input, { flex: 1 }]}
              placeholder="Qtd"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={String(s.quantity || "")}
              onChangeText={(v) => updateSub(i, { quantity: Number(v) || 0 })}
            />
            <View style={[mStyles.unitRow, { flex: 1 }]}>
              {(["g", "ml", "un"] as Unit[]).map((u) => (
                <Pressable
                  key={u}
                  style={[mStyles.unitChip, s.unit === u && mStyles.unitChipSel]}
                  onPress={() => updateSub(i, { unit: u })}
                >
                  <Text style={[mStyles.unitChipText, s.unit === u && { color: colors.onBrandPrimary }]}>{u}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => rmSub(i)} style={mStyles.smallX}>
              <MaterialDesignIcons name="close" size={16} color={colors.error} />
            </Pressable>
          </View>
        </View>
      ))}

      <FormActions onCancel={onCancel} onSave={submit} />
    </ScrollView>
  );
}

function SmallField({ label, v, on, color }: { label: string; v: string; on: (v: string) => void; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[mStyles.label, color && { color }]}>{label}</Text>
      <TextInput style={mStyles.input} value={v} onChangeText={on} keyboardType="numeric" />
    </View>
  );
}

function FormActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <View style={mStyles.actions}>
      <Pressable style={mStyles.btnSec} onPress={onCancel}>
        <Text style={mStyles.btnSecText}>Cancelar</Text>
      </Pressable>
      <Pressable style={mStyles.btnPri} onPress={onSave} testID="form-save-btn">
        <Text style={mStyles.btnPriText}>Salvar</Text>
      </Pressable>
    </View>
  );
}

// ------- styles -------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  planNameInput: { color: colors.onSurface, fontSize: 18, fontWeight: "800", padding: 0, marginTop: 2 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.md, borderRadius: radius.pill,
  },
  addBtnText: { color: colors.onBrandPrimary, fontWeight: "800" },
  mealBlock: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  mealHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mealName: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  mealMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  optionsBlock: { gap: spacing.sm },
  optionRow: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  optionTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  optionMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  foodEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  foodEditName: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
  foodEditMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  smallIcon: {
    width: 30, height: 30, borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  addSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  addSmallText: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
  emptyText: { color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.xl },
});

const mStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 480,
    maxHeight: "90%",
  },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginBottom: spacing.md },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700", marginTop: spacing.sm, marginBottom: 4 },
  input: {
    backgroundColor: colors.surfaceTertiary,
    color: colors.onSurface,
    padding: spacing.sm,
    borderRadius: radius.sm,
    fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  chipSelected: { backgroundColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  chipTextSel: { color: colors.onBrandPrimary, fontWeight: "800" },
  unitRow: {
    flexDirection: "row", gap: 4,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    padding: 2,
  },
  unitChip: {
    flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: radius.sm,
  },
  unitChipSel: { backgroundColor: colors.brandPrimary },
  unitChipText: { color: colors.onSurfaceSecondary, fontWeight: "700" },
  addSubBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addSubText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "700" },
  subEdit: { gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: radius.sm },
  smallX: {
    width: 36, height: 36, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.lg },
  btnSec: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary,
  },
  btnSecText: { color: colors.onSurface, fontWeight: "600" },
  btnPri: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
  },
  btnPriText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
