import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { optionMacros } from "../store/planStore";
import { listFoodCatalog, listRecipes } from "../store/nutritionStore";
import { availableFoodUnits, changePlanFoodUnit, cloneMealOption, foodFromCatalog, foodFromRecipe, optionTemplates, resizePlanFood, UNIT_LABELS, updatePlanFoodUnitEquivalent, type MealOptionTemplate } from "../nutrition/planComposer";
import { colors, radius, spacing, withAlpha } from "../theme";
import type { Food, FoodCatalogItem, MealOption, Plan, Recipe, Unit } from "../types/plan";
import FoodCatalogPicker from "./FoodCatalogPicker";

type Picker = "food" | "recipe" | "template" | "manual" | null;
type ManualDraft = { name: string; quantity: string; unit: Unit; kcal: string; protein: string; carbs: string; fats: string };
const EMPTY_MANUAL: ManualDraft = { name: "", quantity: "", unit: "g", kcal: "", protein: "", carbs: "", fats: "" };
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const number = (value: string) => Number(value.replace(",", "."));

export default function MealOptionComposer({
  visible,
  option,
  plans,
  suggestedName = "Principal",
  onClose,
  onSave,
}: {
  visible: boolean;
  option?: MealOption;
  plans: Plan[];
  suggestedName?: string;
  onClose: () => void;
  onSave: (option: MealOption) => Promise<void> | void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(option?.name || suggestedName);
  const [notes, setNotes] = useState(option?.notes ?? "");
  const [foods, setFoods] = useState<Food[]>(() => option?.foods.map((food) => ({ ...food, substitutions: (food.substitutions ?? []).map((substitution) => ({ ...substitution })) })) ?? []);
  const [catalog, setCatalog] = useState<FoodCatalogItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [unitFoodId, setUnitFoodId] = useState<string | null>(null);
  const [unitEquivalentDraft, setUnitEquivalentDraft] = useState<string | null>(null);
  const [loading, setLoading] = useState(visible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<ManualDraft>(EMPTY_MANUAL);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    void Promise.all([listFoodCatalog(), listRecipes()])
      .then(([nextCatalog, nextRecipes]) => { if (mounted) { setCatalog(nextCatalog); setRecipes(nextRecipes); } })
      .catch(() => { if (mounted) setError("Não foi possível carregar alimentos e receitas agora."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [visible, option, suggestedName]);

  const draft = useMemo<MealOption>(() => ({ id: option?.id ?? "preview", name, notes, foods }), [option?.id, name, notes, foods]);
  const macros = useMemo(() => optionMacros(draft), [draft]);
  const templates = useMemo(() => optionTemplates(plans, option?.id), [plans, option?.id]);

  const addCatalogFood = (item: FoodCatalogItem) => {
    setFoods((current) => [...current, foodFromCatalog(item)]);
    setPicker(null);
  };
  const addRecipe = (recipe: Recipe) => {
    setFoods((current) => [...current, foodFromRecipe(recipe)]);
    setPicker(null);
  };
  const applyTemplate = (template: MealOptionTemplate) => {
    const copy = cloneMealOption(template.option, template.option.name);
    setName(copy.name);
    setNotes(copy.notes ?? "");
    setFoods(copy.foods);
    setPicker(null);
  };
  const updateQuantity = (food: Food, raw: string) => {
    const quantity = number(raw);
    const sourceFood = food.foodId ? catalog.find((item) => item.id === food.foodId) : undefined;
    const sourceRecipe = food.recipeId ? recipes.find((item) => item.id === food.recipeId) : undefined;
    setFoods((current) => current.map((item) => item.id === food.id ? resizePlanFood(item, Number.isFinite(quantity) ? quantity : 0, sourceFood, sourceRecipe) : item));
  };
  const changeUnit = (food: Food, unit: Unit) => {
    setFoods((current) => current.map((item) => item.id === food.id ? changePlanFoodUnit(item, unit) : item));
    setUnitEquivalentDraft(null);
    if (unit === (food.referenceUnit ?? food.unit)) setUnitFoodId(null);
  };
  const changeEquivalent = (food: Food, raw: string) => {
    setUnitEquivalentDraft(raw);
    const equivalent = number(raw);
    if (!Number.isFinite(equivalent) || equivalent <= 0) return;
    const sourceFood = food.foodId ? catalog.find((item) => item.id === food.foodId) : undefined;
    setFoods((current) => current.map((item) => item.id === food.id ? updatePlanFoodUnitEquivalent(item, equivalent, sourceFood) : item));
  };
  const addManual = () => {
    const quantity = Math.max(0, number(manual.quantity) || 0);
    if (!manual.name.trim() || !quantity) { setError("Informe o nome e uma quantidade para o alimento manual."); return; }
    const food: Food = {
      id: `manual-${uid()}`,
      name: manual.name.trim(),
      quantity,
      unit: manual.unit,
      referenceQuantity: quantity,
      referenceUnit: manual.unit,
      kcal: number(manual.kcal) || 0,
      protein: number(manual.protein) || 0,
      carbs: number(manual.carbs) || 0,
      fats: number(manual.fats) || 0,
      fiber: 0,
      sodium: 0,
      substitutions: [],
    };
    setFoods((current) => [...current, food]);
    setManual(EMPTY_MANUAL); setError(null); setPicker(null);
  };
  const save = async () => {
    if (!foods.length) { setError("Adicione pelo menos um alimento ou receita à opção."); return; }
    setSaving(true); setError(null);
    try {
      await onSave({ id: option?.id ?? `option-${uid()}`, name: name.trim() || suggestedName, notes: notes.trim() || undefined, foods });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a opção.");
    } finally { setSaving(false); }
  };

  return <>
    <Modal visible={visible} transparent animationType={Platform.OS === "web" ? "fade" : "slide"} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} accessibilityViewIsModal testID="meal-option-composer">
          <View style={styles.header}>
            <View style={{ flex: 1 }}><Text style={styles.eyebrow}>{option ? "EDITAR OPÇÃO" : "MONTAR OPÇÃO"}</Text><Text style={styles.title}>{option ? option.name : "O que entra nesta refeição?"}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar editor da opção" style={styles.iconButton} onPress={onClose}><MaterialDesignIcons name="close" size={23} color={colors.onSurface} /></Pressable>
          </View>
          <View style={styles.macroStrip} testID="option-live-macros">
            <Macro value={`${Math.round(macros.kcal)}`} label="kcal" accent={colors.brandPrimary} />
            <Macro value={`${macros.protein.toFixed(1)}g`} label="proteína" accent={colors.protein} />
            <Macro value={`${macros.carbs.toFixed(1)}g`} label="carbo" accent={colors.carbs} />
            <Macro value={`${macros.fats.toFixed(1)}g`} label="gordura" accent={colors.fats} />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View><Text style={styles.label}>Nome da opção</Text><TextInput value={name} onChangeText={setName} placeholder="Ex.: Torradas, doce de leite e café" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} testID="option-name-input" /></View>
            <View>
              <Text style={styles.sectionTitle}>Adicionar itens</Text>
              <Text style={styles.help}>Escolha alimentos já cadastrados, uma receita ou reaproveite outra opção como ponto de partida.</Text>
              <View style={styles.sourceGrid}>
                <SourceButton icon="food-apple-outline" label="Alimento" onPress={() => setPicker("food")} testID="option-add-food" />
                <SourceButton icon="chef-hat" label="Receita" onPress={() => setPicker("recipe")} testID="option-add-recipe" />
                <SourceButton icon="content-copy" label="Usar como base" onPress={() => setPicker("template")} testID="option-use-template" />
                <SourceButton icon="pencil-plus-outline" label="Manual" onPress={() => setPicker("manual")} testID="option-add-manual" />
              </View>
            </View>
            <View style={styles.ingredientsHeader}><Text style={styles.sectionTitle}>Ingredientes</Text><Text style={styles.count}>{foods.length} {foods.length === 1 ? "item" : "itens"}</Text></View>
            {loading ? <View style={styles.loading}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.help}>Carregando sua despensa…</Text></View> : foods.map((food) => (
              <View key={food.id} style={styles.ingredient} testID={`option-ingredient-${food.id}`}>
                <View style={[styles.itemIcon, { backgroundColor: withAlpha(food.recipeId ? colors.brandSecondary : colors.brandPrimary, 0.13) }]}><MaterialDesignIcons name={food.recipeId ? "chef-hat" : "food-apple-outline"} size={20} color={food.recipeId ? colors.brandSecondary : colors.brandPrimary} /></View>
                <View style={styles.itemCopy}><Text style={styles.itemName} numberOfLines={2}>{food.name}</Text><Text style={styles.itemMacros}>{Math.round(food.kcal ?? 0)} kcal · P {(food.protein ?? 0).toFixed(1)} · C {(food.carbs ?? 0).toFixed(1)} · G {(food.fats ?? 0).toFixed(1)}</Text></View>
                <View style={styles.quantityWrap}>
                  <TextInput accessibilityLabel={`Quantidade de ${food.name}`} value={String(food.quantity)} onChangeText={(value) => updateQuantity(food, value)} keyboardType="decimal-pad" style={styles.quantityInput} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`Alterar unidade de ${food.name}`} style={styles.unitButton} onPress={() => { setUnitEquivalentDraft(null); setUnitFoodId(food.id); }} testID={`option-unit-${food.id}`}>
                    <Text style={styles.unit}>{UNIT_LABELS[food.unit]}</Text><MaterialDesignIcons name="chevron-down" size={15} color={colors.onSurfaceSecondary} />
                  </Pressable>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${food.name}`} style={styles.removeButton} onPress={() => setFoods((current) => current.filter((item) => item.id !== food.id))}><MaterialDesignIcons name="close" size={19} color={colors.error} /></Pressable>
              </View>
            ))}
            {!loading && !foods.length ? <View style={styles.empty}><MaterialDesignIcons name="silverware-fork-knife" size={30} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>Sua opção ainda está vazia</Text><Text style={styles.help}>Por exemplo: adicione torradas, doce de leite e café. Os macros serão somados automaticamente.</Text></View> : null}
            <View><Text style={styles.label}>Observações da opção</Text><TextInput value={notes} onChangeText={setNotes} placeholder="Ex.: usar café sem açúcar" placeholderTextColor={colors.onSurfaceTertiary} multiline style={[styles.input, styles.notes]} /></View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.footer}><Pressable style={styles.secondaryButton} onPress={onClose} disabled={saving}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={[styles.primaryButton, (saving || !foods.length) && styles.disabled]} onPress={() => void save()} disabled={saving || !foods.length} testID="option-save"><Text style={styles.primaryText}>{saving ? "Salvando…" : "Salvar opção"}</Text></Pressable></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <FoodCatalogPicker visible={picker === "food"} foods={catalog} loading={loading} error={error} title="Adicionar alimento à opção" onClose={() => setPicker(null)} onSelect={addCatalogFood} />
    <SelectionSheet visible={picker === "recipe"} eyebrow="RECEITAS" title="Adicionar uma preparação" onClose={() => setPicker(null)}>
      {recipes.map((recipe) => { const macro = recipeNutrientsLabel(recipe); return <Pressable key={recipe.id} style={styles.pickRow} onPress={() => addRecipe(recipe)} testID={`option-recipe-${recipe.id}`}><View style={styles.pickIcon}><MaterialDesignIcons name="chef-hat" size={20} color={colors.brandSecondary} /></View><View style={{ flex: 1 }}><Text style={styles.pickTitle}>{recipe.name}</Text><Text style={styles.pickMeta}>1 porção · {macro}</Text></View><MaterialDesignIcons name="plus-circle" size={24} color={colors.brandPrimary} /></Pressable>; })}
      {!recipes.length ? <EmptyPicker text="Nenhuma receita cadastrada. Crie uma receita na área Dieta para reutilizá-la aqui." /> : null}
    </SelectionSheet>
    <SelectionSheet visible={picker === "template"} eyebrow="USAR COMO BASE" title="Opções já criadas" onClose={() => setPicker(null)}>
      {templates.map((template) => { const macro = optionMacros(template.option); return <Pressable key={template.id} style={styles.pickRow} onPress={() => applyTemplate(template)} testID={`option-template-${template.option.id}`}><View style={styles.pickIcon}><MaterialDesignIcons name="content-copy" size={20} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.pickTitle}>{template.option.name}</Text><Text style={styles.pickMeta}>{template.planName} · {template.mealName} · {template.option.foods.length} itens · {Math.round(macro.kcal)} kcal</Text></View><Text style={styles.useText}>Usar</Text></Pressable>; })}
      {!templates.length ? <EmptyPicker text="Ainda não há outra opção preenchida para usar como base." /> : null}
    </SelectionSheet>
    <SelectionSheet visible={picker === "manual"} eyebrow="CADASTRO RÁPIDO" title="Alimento manual" onClose={() => setPicker(null)}>
      <View style={styles.manualForm}>
        <LabeledInput label="Nome" value={manual.name} onChangeText={(value) => setManual((current) => ({ ...current, name: value }))} />
        <View style={styles.manualRow}><View style={{ flex: 1 }}><LabeledInput label="Quantidade" value={manual.quantity} onChangeText={(value) => setManual((current) => ({ ...current, quantity: value }))} numeric /></View><View style={{ flex: 1 }}><Text style={styles.label}>Unidade</Text><View style={styles.unitChoices}>{(["g", "ml", "un", "porcao"] as Unit[]).map((unit) => <Pressable key={unit} onPress={() => setManual((current) => ({ ...current, unit }))} style={[styles.unitChoice, manual.unit === unit && styles.unitChoiceActive]}><Text style={[styles.unitChoiceText, manual.unit === unit && styles.unitChoiceTextActive]}>{unit}</Text></Pressable>)}</View></View></View>
        <View style={styles.manualRow}>{([ ["kcal", "Calorias"], ["protein", "Proteína"], ["carbs", "Carbo"], ["fats", "Gordura"] ] as [keyof ManualDraft, string][]).map(([key, label]) => <View key={key} style={{ flex: 1 }}><LabeledInput label={label} value={manual[key]} onChangeText={(value) => setManual((current) => ({ ...current, [key]: value }))} numeric /></View>)}</View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.primaryButton} onPress={addManual}><Text style={styles.primaryText}>Adicionar à opção</Text></Pressable>
      </View>
    </SelectionSheet>
    <SelectionSheet visible={Boolean(unitFoodId)} eyebrow="COMO MEDIR" title={foods.find((food) => food.id === unitFoodId)?.name ?? "Escolha a unidade"} onClose={() => { setUnitEquivalentDraft(null); setUnitFoodId(null); }}>
      {(() => {
        const food = foods.find((item) => item.id === unitFoodId);
        if (!food) return null;
        return <>
          <Text style={styles.unitHelp}>Escolha como você costuma medir este alimento. O UrsoFit preserva os macros e guarda a equivalência para os próximos ajustes.</Text>
          {availableFoodUnits(food).map((unit) => {
            const selected = food.unit === unit;
            const detail = unit === food.referenceUnit
              ? "Medida original do alimento"
              : unit === "un" ? "Contar unidades, como 1 ovo ou 2 torradas"
              : unit === "porcao" ? "Contar porções desta quantidade"
              : unit === "ml" ? "Medir o volume em mililitros"
              : "Medir o peso em gramas";
            return <Pressable key={unit} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.unitPickRow, selected && styles.unitPickRowActive]} onPress={() => changeUnit(food, unit)} testID={`option-unit-choice-${unit}`}>
              <View style={[styles.unitBadge, selected && styles.unitBadgeActive]}><Text style={[styles.unitBadgeText, selected && styles.unitBadgeTextActive]}>{UNIT_LABELS[unit]}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.pickTitle}>{unit === "un" ? "Unidade" : unit === "porcao" ? "Porção" : unit === "ml" ? "Mililitros" : "Gramas"}</Text><Text style={styles.pickMeta}>{detail}</Text></View>
              {selected ? <MaterialDesignIcons name="check-circle" size={22} color={colors.brandPrimary} /> : <MaterialDesignIcons name="chevron-right" size={21} color={colors.onSurfaceTertiary} />}
            </Pressable>;
          })}
          {food.unit !== (food.referenceUnit ?? food.unit) && ((food.referenceUnit ?? food.unit) === "g" || (food.referenceUnit ?? food.unit) === "ml") ? <View style={styles.equivalentEditor} testID="option-unit-equivalent">
            <View style={{ flex: 1 }}><Text style={styles.equivalentTitle}>Quanto vale 1 {UNIT_LABELS[food.unit]}?</Text><Text style={styles.pickMeta}>Assim os macros continuam corretos quando você informar 1, 2 ou mais.</Text></View>
            <View style={styles.equivalentControl}><TextInput accessibilityLabel={`Equivalência de ${food.name}`} value={unitEquivalentDraft ?? String(food.unitEquivalents?.[food.unit] ?? food.referenceQuantity ?? 1)} onChangeText={(value) => changeEquivalent(food, value)} keyboardType="decimal-pad" style={styles.equivalentInput} /><Text style={styles.equivalentUnit}>{UNIT_LABELS[food.referenceUnit ?? food.unit]}</Text></View>
          </View> : null}
          <Pressable style={styles.primaryButton} onPress={() => { setUnitEquivalentDraft(null); setUnitFoodId(null); }}><Text style={styles.primaryText}>Usar esta medida</Text></Pressable>
        </>;
      })()}
    </SelectionSheet>
  </>;
}

function recipeNutrientsLabel(recipe: Recipe) {
  const food = foodFromRecipe(recipe);
  return `${Math.round(food.kcal ?? 0)} kcal · P ${(food.protein ?? 0).toFixed(1)}g`;
}
function Macro({ value, label, accent }: { value: string; label: string; accent: string }) { return <View style={styles.macro}><View style={[styles.dot, { backgroundColor: accent }]} /><Text style={styles.macroValue}>{value}</Text><Text style={styles.macroLabel}>{label}</Text></View>; }
function SourceButton({ icon, label, onPress, testID }: { icon: string; label: string; onPress: () => void; testID: string }) { return <Pressable accessibilityRole="button" style={({ pressed }) => [styles.sourceButton, pressed && { opacity: 0.72 }]} onPress={onPress} testID={testID}><MaterialDesignIcons name={icon as never} size={21} color={colors.brandPrimary} /><Text style={styles.sourceLabel}>{label}</Text></Pressable>; }
function EmptyPicker({ text }: { text: string }) { return <View style={styles.pickerEmpty}><MaterialDesignIcons name="tray" size={30} color={colors.onSurfaceTertiary} /><Text style={styles.help}>{text}</Text></View>; }
function LabeledInput({ label, value, onChangeText, numeric }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean }) { return <View><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={numeric ? "decimal-pad" : "default"} style={styles.input} /></View>; }

function SelectionSheet({ visible, eyebrow, title, onClose, children }: { visible: boolean; eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent><View style={styles.pickerBackdrop}><View style={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]} accessibilityViewIsModal><View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.title}>{title}</Text></View><Pressable style={styles.iconButton} onPress={onClose}><MaterialDesignIcons name="close" size={23} color={colors.onSurface} /></Pressable></View><ScrollView contentContainerStyle={styles.pickerContent} keyboardShouldPersistTaps="handled">{children}</ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  sheet: { width: "100%", maxWidth: 860, maxHeight: "94%", minHeight: 560, alignSelf: "center", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.md },
  eyebrow: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.3 }, title: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginTop: 2 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  macroStrip: { flexDirection: "row", marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }, macro: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 }, dot: { width: 6, height: 6, borderRadius: radius.pill }, macroValue: { color: colors.onSurface, fontSize: 13, fontWeight: "900" }, macroLabel: { color: colors.onSurfaceTertiary, fontSize: 8 },
  scroll: { flex: 1, minHeight: 0 }, content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.lg },
  label: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "800", marginBottom: 6 }, input: { minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : {}) }, notes: { minHeight: 72, paddingTop: spacing.md, textAlignVertical: "top" },
  sectionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900" }, help: { color: colors.onSurfaceTertiary, fontSize: 10.5, lineHeight: 16, marginTop: 3 }, sourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, sourceButton: { minWidth: 120, flexGrow: 1, minHeight: 66, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: withAlpha(colors.brandPrimary, 0.09) }, sourceLabel: { color: colors.onSurface, fontSize: 10.5, fontWeight: "800" },
  ingredientsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, count: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" }, loading: { minHeight: 100, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  ingredient: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, itemIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md }, itemCopy: { flex: 1, minWidth: 88 }, itemName: { color: colors.onSurface, fontSize: 12, fontWeight: "800" }, itemMacros: { color: colors.onSurfaceTertiary, fontSize: 9, lineHeight: 13, marginTop: 3 }, quantityWrap: { width: 132, flexDirection: "row", alignItems: "center", gap: 5 }, quantityInput: { width: 62, minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.onSurface, textAlign: "right", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : {}) }, unitButton: { minWidth: 62, minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface }, unit: { color: colors.onSurface, fontSize: 10, fontWeight: "800" }, removeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surface },
  empty: { minHeight: 130, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong }, emptyTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800" }, error: { color: colors.error, fontSize: 11, lineHeight: 16 },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }, secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, secondaryText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, primaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, primaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" }, disabled: { opacity: 0.45 },
  pickerBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.78)" }, pickerSheet: { width: "100%", maxWidth: 760, maxHeight: "84%", minHeight: 360, alignSelf: "center", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }, pickerContent: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm }, pickRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, pickIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surface }, pickTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "800" }, pickMeta: { color: colors.onSurfaceTertiary, fontSize: 9.5, lineHeight: 14, marginTop: 3 }, useText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" }, pickerEmpty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  manualForm: { gap: spacing.md }, manualRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, unitChoices: { minHeight: 46, flexDirection: "row", padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, unitChoice: { flex: 1, minWidth: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm }, unitChoiceActive: { backgroundColor: colors.brandPrimary }, unitChoiceText: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "800" }, unitChoiceTextActive: { color: colors.onBrandPrimary }, unitHelp: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17, marginBottom: spacing.sm }, unitPickRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surfaceTertiary }, unitPickRowActive: { borderColor: withAlpha(colors.brandPrimary, 0.65), backgroundColor: withAlpha(colors.brandPrimary, 0.08) }, unitBadge: { minWidth: 48, height: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }, unitBadgeActive: { backgroundColor: colors.brandPrimary }, unitBadgeText: { color: colors.onSurface, fontSize: 11, fontWeight: "900" }, unitBadgeTextActive: { color: colors.onBrandPrimary }, equivalentEditor: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, marginVertical: spacing.sm, borderRadius: radius.md, backgroundColor: withAlpha(colors.brandSecondary, 0.1) }, equivalentTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900" }, equivalentControl: { flexDirection: "row", alignItems: "center", gap: spacing.xs }, equivalentInput: { width: 72, minHeight: 42, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface, color: colors.onSurface, textAlign: "right", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : {}) }, equivalentUnit: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "800" },
});
