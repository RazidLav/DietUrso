import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { getSignedInUser } from "../src/cloud/cloudSync";
import { normalizeNutrients } from "../src/nutrition/calculations";
import { createPersonalFood, duplicateFood, listFoodCatalog, setFoodArchived, updatePersonalFood } from "../src/store/nutritionStore";
import { colors, radius, spacing } from "../src/theme";
import type { FoodCatalogItem, Unit } from "../src/types/plan";
import { matchesSearch } from "../src/utils/search";

const CATEGORIES = ["Proteínas", "Carboidratos", "Frutas", "Vegetais", "Laticínios", "Gorduras & Temperos", "Outros"];
const UNITS: { value: Unit; label: string }[] = [
  { value: "g", label: "Grama" }, { value: "ml", label: "Mililitro" }, { value: "un", label: "Unidade" }, { value: "porcao", label: "Porção" },
];

type ScopeFilter = "all" | "global" | "personal" | "archived";
type Draft = {
  name: string; brand: string; category: string; referenceQuantity: string; referenceUnit: Unit;
  kcal: string; protein: string; carbs: string; fats: string; fiber: string; sodium: string;
  notes: string; source: string;
};

const EMPTY_DRAFT: Draft = {
  name: "", brand: "", category: "Outros", referenceQuantity: "100", referenceUnit: "g",
  kcal: "", protein: "", carbs: "", fats: "", fiber: "", sodium: "", notes: "", source: "Cadastro manual",
};

const parseNumber = (value: string) => Number(value.replace(",", "."));

export default function AlimentosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<FoodCatalogItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScopeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FoodCatalogItem | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    try {
      setItems(await listFoodCatalog(true));
      setError(null);
    } catch {
      setError("Não foi possível carregar sua despensa agora.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const visible = useMemo(() => {
    return items.filter((item) => {
      const matchesQuery = matchesSearch(query, item.name, item.brand, item.category, item.source);
      const matchesFilter = filter === "archived" ? item.archived : !item.archived && (filter === "all" || item.scope === filter);
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter]);

  const openCreate = () => { setDraft(EMPTY_DRAFT); setEditing(null); setError(null); };
  const openEdit = (item: FoodCatalogItem) => {
    setDraft({
      name: item.name, brand: item.brand ?? "", category: item.category,
      referenceQuantity: String(item.referenceQuantity), referenceUnit: item.referenceUnit,
      kcal: String(item.nutrients.kcal), protein: String(item.nutrients.protein), carbs: String(item.nutrients.carbs),
      fats: String(item.nutrients.fats), fiber: String(item.nutrients.fiber), sodium: String(item.nutrients.sodium),
      notes: item.notes ?? "", source: item.source ?? "Cadastro manual",
    });
    setEditing(item);
    setError(null);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const quantity = parseNumber(draft.referenceQuantity);
      const ownerId = editing?.ownerId ?? (await getSignedInUser())?.id;
      const payload = {
        name: draft.name,
        brand: draft.brand.trim() || undefined,
        category: draft.category,
        referenceQuantity: quantity,
        referenceUnit: draft.referenceUnit,
        nutrients: normalizeNutrients({
          kcal: parseNumber(draft.kcal), protein: parseNumber(draft.protein), carbs: parseNumber(draft.carbs),
          fats: parseNumber(draft.fats), fiber: parseNumber(draft.fiber), sodium: parseNumber(draft.sodium),
        }),
        notes: draft.notes.trim() || undefined,
        source: draft.source.trim() || "Cadastro manual",
        ownerId,
      };
      if (editing) await updatePersonalFood({ ...editing, ...payload });
      else await createPersonalFood(payload);
      setEditing(undefined);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o alimento.");
    } finally { setSaving(false); }
  };

  const duplicate = async (item: FoodCatalogItem) => {
    try { await duplicateFood(item.id, (await getSignedInUser())?.id); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível duplicar."); }
  };

  const archive = async (item: FoodCatalogItem) => {
    try { await setFoodArchived(item.id, !item.archived); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível arquivar."); }
  };

  return (
    <View style={styles.screen} testID="foods-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable style={styles.back} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>DESPENSA</Text><Text style={styles.title}>Banco de alimentos</Text></View>
        <Pressable style={styles.primaryIcon} onPress={openCreate} testID="new-food-btn"><MaterialDesignIcons name="plus" size={24} color={colors.onBrandPrimary} /></Pressable>
      </View>
      <View style={styles.searchWrap}>
        <MaterialDesignIcons name="magnify" size={20} color={colors.onSurfaceTertiary} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Pesquisar alimento ou marca" placeholderTextColor={colors.onSurfaceTertiary} style={styles.search} testID="food-search-input" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={styles.filters}>
        {([ ["all", "Todos"], ["global", "Globais"], ["personal", "Meus"], ["archived", "Arquivados"] ] as [ScopeFilter, string][]).map(([value, label]) => (
          <Pressable key={value} onPress={() => setFilter(value)} style={[styles.chip, filter === value && styles.chipOn]}><Text style={[styles.chipText, filter === value && styles.chipTextOn]}>{label}</Text></Pressable>
        ))}
      </ScrollView>
      {error && editing === undefined ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.brandPrimary} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}>
          {visible.map((item) => <FoodCard key={item.id} item={item} onEdit={() => openEdit(item)} onDuplicate={() => void duplicate(item)} onArchive={() => void archive(item)} />)}
          {!visible.length ? <View style={styles.empty}><MaterialDesignIcons name="basket-outline" size={38} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>Nada por aqui</Text><Text style={styles.emptyText}>Ajuste a busca ou cadastre seu primeiro alimento pessoal.</Text></View> : null}
        </ScrollView>
      )}

      <FoodModal visible={editing !== undefined} draft={draft} setDraft={setDraft} editing={editing ?? null} saving={saving} error={error} onClose={() => { setEditing(undefined); setError(null); }} onSave={() => void save()} />
    </View>
  );
}

function FoodCard({ item, onEdit, onDuplicate, onArchive }: { item: FoodCatalogItem; onEdit: () => void; onDuplicate: () => void; onArchive: () => void }) {
  return (
    <View style={[styles.card, item.archived && { opacity: 0.62 }]} testID={`food-card-${item.id}`}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={[styles.foodIcon, { backgroundColor: (item.scope === "global" ? colors.brandSecondary : colors.brandPrimary) + "22" }]}><MaterialDesignIcons name={item.scope === "global" ? "earth" : "account"} size={20} color={item.scope === "global" ? colors.brandSecondary : colors.brandPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.cardMeta}>{item.brand ? `${item.brand} · ` : ""}{item.category} · {item.referenceQuantity} {item.referenceUnit}</Text>
          <Text style={styles.macros}>{Math.round(item.nutrients.kcal)} kcal  ·  P {item.nutrients.protein.toFixed(1)}  ·  C {item.nutrients.carbs.toFixed(1)}  ·  G {item.nutrients.fats.toFixed(1)}  ·  Fibras {item.nutrients.fiber.toFixed(1)}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.scope === "personal" ? <Pressable style={styles.action} onPress={onEdit}><MaterialDesignIcons name="pencil" size={16} color={colors.onSurfaceSecondary} /><Text style={styles.actionText}>Editar</Text></Pressable> : null}
        <Pressable style={styles.action} onPress={onDuplicate}><MaterialDesignIcons name="content-copy" size={16} color={colors.onSurfaceSecondary} /><Text style={styles.actionText}>Duplicar</Text></Pressable>
        {item.scope === "personal" ? <Pressable style={styles.action} onPress={onArchive}><MaterialDesignIcons name={item.archived ? "archive-arrow-up" : "archive-outline"} size={16} color={colors.onSurfaceSecondary} /><Text style={styles.actionText}>{item.archived ? "Restaurar" : "Arquivar"}</Text></Pressable> : null}
      </View>
    </View>
  );
}

function FoodModal({ visible, draft, setDraft, editing, saving, error, onClose, onSave }: { visible: boolean; draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>; editing: FoodCatalogItem | null; saving: boolean; error: string | null; onClose: () => void; onSave: () => void }) {
  const set = (key: keyof Draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}><View style={styles.modal} accessibilityViewIsModal>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>{editing ? "Editar alimento" : "Novo alimento"}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar formulário" onPress={onClose}><MaterialDesignIcons name="close" size={24} color={colors.onSurface} /></Pressable></View>
        <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          <Field label="Nome *" value={draft.name} onChangeText={(value) => set("name", value)} testID="food-form-name" />
          <Field label="Marca (opcional)" value={draft.brand} onChangeText={(value) => set("brand", value)} />
          <Text style={styles.label}>Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>{CATEGORIES.map((category) => <Pressable key={category} onPress={() => set("category", category)} style={[styles.chip, draft.category === category && styles.chipOn]}><Text style={[styles.chipText, draft.category === category && styles.chipTextOn]}>{category}</Text></Pressable>)}</ScrollView>
          <View style={styles.row}><View style={{ flex: 1 }}><Field label="Quantidade de referência *" value={draft.referenceQuantity} onChangeText={(value) => set("referenceQuantity", value)} numeric testID="food-form-reference" /></View></View>
          <Text style={styles.label}>Unidade de referência</Text>
          <View style={styles.wrap}>{UNITS.map((unit) => <Pressable key={unit.value} onPress={() => setDraft((current) => ({ ...current, referenceUnit: unit.value }))} style={[styles.chip, draft.referenceUnit === unit.value && styles.chipOn]}><Text style={[styles.chipText, draft.referenceUnit === unit.value && styles.chipTextOn]}>{unit.label}</Text></Pressable>)}</View>
          <Text style={styles.sectionLabel}>VALORES NA QUANTIDADE DE REFERÊNCIA</Text>
          <View style={styles.grid}>
            <SmallField label="Calorias" value={draft.kcal} onChangeText={(value) => set("kcal", value)} />
            <SmallField label="Proteínas (g)" value={draft.protein} onChangeText={(value) => set("protein", value)} />
            <SmallField label="Carboidratos (g)" value={draft.carbs} onChangeText={(value) => set("carbs", value)} />
            <SmallField label="Gorduras (g)" value={draft.fats} onChangeText={(value) => set("fats", value)} />
            <SmallField label="Fibras (g)" value={draft.fiber} onChangeText={(value) => set("fiber", value)} />
            <SmallField label="Sódio (mg)" value={draft.sodium} onChangeText={(value) => set("sodium", value)} />
          </View>
          <Field label="Fonte dos dados" value={draft.source} onChangeText={(value) => set("source", value)} />
          <Field label="Observações" value={draft.notes} onChangeText={(value) => set("notes", value)} multiline />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}><Pressable style={styles.secondaryBtn} onPress={onClose}><Text style={styles.secondaryText}>Cancelar</Text></Pressable><Pressable style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving} testID="food-form-save"><Text style={styles.primaryText}>{saving ? "Salvando..." : "Salvar alimento"}</Text></Pressable></View>
        </ScrollView>
      </View></KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChangeText, numeric, multiline, testID }: { label: string; value: string; onChangeText: (value: string) => void; numeric?: boolean; multiline?: boolean; testID?: string }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType={numeric ? "decimal-pad" : "default"} multiline={multiline} placeholderTextColor={colors.onSurfaceTertiary} style={[styles.input, multiline && { minHeight: 72, textAlignVertical: "top" }]} testID={testID} /></View>;
}
function SmallField(props: { label: string; value: string; onChangeText: (value: string) => void }) { return <View style={styles.smallField}><Field {...props} numeric /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  primaryIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.onSurface, fontSize: 21, fontWeight: "800" },
  searchWrap: { margin: spacing.lg, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md },
  search: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md, outlineStyle: "none" } as any,
  filters: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border }, chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" }, chipTextOn: { color: colors.onBrandPrimary },
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  foodIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }, cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, cardMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }, macros: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }, action: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, actionText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" }, emptyText: { color: colors.onSurfaceTertiary, fontSize: 12, textAlign: "center" },
  error: { color: colors.error, fontSize: 12, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  overlay: { flex: 1, backgroundColor: "#000A", justifyContent: "flex-end" }, modal: { maxHeight: "92%", minHeight: 0, width: "100%", maxWidth: 720, alignSelf: "center", backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }, modalScroll: { minHeight: 0 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }, modalTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800" }, label: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700", marginBottom: 6 },
  input: { color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, smallField: { flexBasis: "47%", flexGrow: 1 }, sectionLabel: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }, secondaryBtn: { flex: 1, alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md }, secondaryText: { color: colors.onSurfaceSecondary, fontWeight: "700" }, primaryBtn: { flex: 2, alignItems: "center", padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.md }, primaryText: { color: colors.onBrandPrimary, fontWeight: "800" },
});
