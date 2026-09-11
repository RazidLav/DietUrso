import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FoodCatalogItem } from "../types/plan";
import { matchesSearch } from "../utils/search";
import { breakpoints, colors, radius, spacing } from "../theme";

export function filterFoodCatalog(items: FoodCatalogItem[], query: string) {
  return items.filter((food) => matchesSearch(query, food.name, food.brand, food.category, food.source));
}

export default function FoodCatalogPicker({
  visible,
  foods,
  selectedId,
  loading = false,
  error,
  title = "Banco de alimentos",
  onClose,
  onSelect,
}: {
  visible: boolean;
  foods: FoodCatalogItem[];
  selectedId?: string;
  loading?: boolean;
  error?: string | null;
  title?: string;
  onClose: () => void;
  onSelect: (food: FoodCatalogItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const desktop = width >= breakpoints.tablet;
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const results = useMemo(() => filterFoodCatalog(foods.filter((food) => !food.archived), query), [foods, query]);

  const close = () => { setQuery(""); onClose(); };
  const select = (food: FoodCatalogItem) => { setQuery(""); onSelect(food); };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={desktop ? "fade" : "slide"}
      onRequestClose={close}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.backdrop, desktop && styles.backdropDesktop]}>
        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.sheet,
            desktop && styles.dialog,
            { height: Math.min(Math.max(420, height * (desktop ? 0.76 : 0.88)), desktop ? 740 : 760), paddingBottom: Math.max(insets.bottom, spacing.md) },
          ]}
          testID="food-catalog-picker"
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}><Text style={styles.eyebrow}>SELECIONAR ALIMENTO</Text><Text style={styles.title}>{title}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar banco de alimentos" onPress={close} style={styles.closeButton} testID="food-picker-close">
              <MaterialDesignIcons name="close" size={23} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={styles.searchWrap}>
            <MaterialDesignIcons name="magnify" size={21} color={colors.onSurfaceTertiary} />
            <TextInput
              ref={inputRef}
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar por nome, marca ou categoria"
              placeholderTextColor={colors.onSurfaceTertiary}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Pesquisar no banco de alimentos"
              style={styles.searchInput}
              testID="food-picker-search"
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Limpar pesquisa" onPress={() => { setQuery(""); inputRef.current?.focus(); }} style={styles.clearButton} testID="food-picker-clear">
                <MaterialDesignIcons name="close-circle" size={20} color={colors.onSurfaceTertiary} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.resultHeader}><Text style={styles.resultCount}>{loading ? "Carregando…" : `${results.length} resultado${results.length === 1 ? "" : "s"}`}</Text><Text style={styles.resultHint}>Role para ver todos</Text></View>
          <View style={styles.listFrame}>
            {loading ? <View style={styles.state}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.stateText}>Carregando alimentos…</Text></View> : error ? <View style={styles.state}><MaterialDesignIcons name="alert-circle-outline" size={30} color={colors.error} /><Text style={styles.errorText}>{error}</Text></View> : !results.length ? <View style={styles.state}><MaterialDesignIcons name="magnify-close" size={31} color={colors.onSurfaceTertiary} /><Text style={styles.stateTitle}>Nenhum alimento encontrado</Text><Text style={styles.stateText}>Tente outro nome, marca ou categoria.</Text></View> : (
              <ScrollView
                style={styles.list}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
                nestedScrollEnabled
                testID="food-picker-results"
              >
                {results.map((food) => {
                  const selected = food.id === selectedId;
                  return (
                    <Pressable
                      key={food.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Selecionar ${food.name}${food.brand ? `, marca ${food.brand}` : ""}`}
                      accessibilityState={{ selected }}
                      onPress={() => select(food)}
                      style={({ pressed }) => [styles.result, selected && styles.resultSelected, pressed && { opacity: 0.74 }]}
                      testID={`food-picker-result-${food.id}`}
                    >
                      <View style={[styles.foodIcon, selected && styles.foodIconSelected]}><MaterialDesignIcons name={selected ? "check" : "food-apple-outline"} size={20} color={selected ? colors.onBrandPrimary : colors.brandPrimary} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.foodName} numberOfLines={2}>{food.name}</Text>
                        <Text style={styles.foodMeta} numberOfLines={2}>{food.brand ? `${food.brand} · ` : ""}{food.referenceQuantity} {food.referenceUnit} · {Math.round(food.nutrients.kcal)} kcal</Text>
                      </View>
                      <Text style={styles.selectText}>{selected ? "Selecionado" : "Selecionar"}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.76)" },
  backdropDesktop: { justifyContent: "center", alignItems: "center", padding: spacing.xl },
  sheet: { width: "100%", maxWidth: 720, alignSelf: "center", minHeight: 0, paddingTop: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, overflow: "hidden" },
  dialog: { borderRadius: radius.lg, paddingTop: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  eyebrow: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginTop: 2 },
  closeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  searchWrap: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  searchInput: { flex: 1, minWidth: 0, color: colors.onSurface, fontSize: 15, paddingVertical: spacing.md, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : {}) },
  clearButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  resultHeader: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  resultCount: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "800" },
  resultHint: { color: colors.onSurfaceTertiary, fontSize: 10 },
  listFrame: { flex: 1, minHeight: 0, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface },
  list: { flex: 1, minHeight: 0 },
  listContent: { padding: spacing.sm, gap: spacing.xs, paddingBottom: spacing.lg },
  result: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: "transparent" },
  resultSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandPrimary + "12" },
  foodIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary + "18" },
  foodIconSelected: { backgroundColor: colors.brandPrimary },
  foodName: { color: colors.onSurface, fontSize: 13, fontWeight: "800" },
  foodMeta: { color: colors.onSurfaceTertiary, fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  selectText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" },
  state: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
  stateTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800", textAlign: "center" },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", lineHeight: 17 },
  errorText: { color: colors.error, fontSize: 12, textAlign: "center" },
});
