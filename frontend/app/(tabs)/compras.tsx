import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../../src/theme";
import {
  getActivePlan,
  getShoppingChecked,
  setShoppingChecked,
} from "../../src/store/planStore";
import { WEEKDAYS_SHORT } from "../../src/utils/date";
import type { Plan } from "../../src/types/plan";
import {
  categorizeFood,
  CATEGORY_ICONS,
  sortCategories,
  type Category,
} from "../../src/utils/categories";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";

interface Agg {
  key: string;
  name: string;
  totalG: number;
  totalMl: number;
  totalUn: number;
  category: Category;
}

export default function ComprasScreen() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setPlan(await getActivePlan());
    setChecked(await getShoppingChecked());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleDay = (i: number) => {
    setSelectedDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()
    );
  };
  const toggleAll = () => {
    setSelectedDays((prev) => (prev.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6]));
  };

  const grouped = useMemo<[Category, Agg[]][]>(() => {
    if (!plan) return [];
    const map = new Map<string, Agg>();
    const daysCount = selectedDays.length;
    for (const meal of plan.meals) {
      const opt = meal.options[0];
      if (!opt) continue;
      for (const food of opt.foods) {
        const key = food.name.trim().toLowerCase();
        const entry = map.get(key) ?? {
          key,
          name: food.name,
          totalG: 0,
          totalMl: 0,
          totalUn: 0,
          category: categorizeFood(food.name),
        };
        if (food.unit === "g") entry.totalG += food.quantity * daysCount;
        else if (food.unit === "ml") entry.totalMl += food.quantity * daysCount;
        else entry.totalUn += food.quantity * daysCount;
        map.set(key, entry);
      }
    }
    const bucket = new Map<Category, Agg[]>();
    Array.from(map.values()).forEach((it) => {
      const arr = bucket.get(it.category) ?? [];
      arr.push(it);
      bucket.set(it.category, arr);
    });
    const result = Array.from(bucket.entries()).map(
      ([cat, arr]) =>
        [cat, arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))] as [
          Category,
          Agg[]
        ]
    );
    result.sort(([a], [b]) => sortCategories(a, b));
    return result;
  }, [plan, selectedDays]);

  const totalItems = grouped.reduce((n, [, arr]) => n + arr.length, 0);
  const checkedCount = grouped.reduce(
    (n, [, arr]) => n + arr.filter((it) => checked[it.key]).length,
    0
  );

  const toggleItem = async (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    await setShoppingChecked(next);
  };
  const toggleCategory = (cat: Category) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="compras-screen">
      <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>LISTA DE COMPRAS</Text>
            <Text style={styles.title}>
              {checkedCount}/{totalItems} itens
            </Text>
          </View>
          <Pressable style={styles.toggleAll} onPress={toggleAll} testID="toggle-all-days-btn">
            <Text style={styles.toggleAllText}>
              {selectedDays.length === 7 ? "Limpar" : "7 dias"}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRowContent}
          style={styles.chipRow}
        >
          {WEEKDAYS_SHORT.map((d, i) => {
            const sel = selectedDays.includes(i);
            return (
              <Pressable
                key={i}
                style={[styles.chip, sel && styles.chipSelected]}
                onPress={() => toggleDay(i)}
                testID={`compras-day-chip-${i}`}
              >
                <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{d}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl,
          gap: spacing.md,
        }}
      >
        {grouped.length === 0 ? (
          <Text style={styles.empty}>
            {plan ? "Selecione ao menos um dia." : "Nenhum plano ativo."}
          </Text>
        ) : (
          grouped.map(([cat, items]) => {
            const catChecked = items.filter((it) => checked[it.key]).length;
            const isCollapsed = !!collapsed[cat];
            return (
              <View key={cat} style={styles.catBlock} testID={`cat-block-${cat}`}>
                <Pressable
                  style={styles.catHeader}
                  onPress={() => toggleCategory(cat)}
                  testID={`cat-toggle-${cat}`}
                >
                  <View style={styles.catIconWrap}>
                    <MaterialDesignIcons
                      name={CATEGORY_ICONS[cat] as any}
                      size={18}
                      color={colors.brandPrimary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catName}>{cat}</Text>
                    <Text style={styles.catMeta}>
                      {catChecked}/{items.length} itens
                    </Text>
                  </View>
                  <MaterialDesignIcons
                    name={isCollapsed ? "chevron-down" : "chevron-up"}
                    size={20}
                    color={colors.onSurfaceTertiary}
                  />
                </Pressable>

                {!isCollapsed ? (
                  <View style={styles.catItems}>
                    {items.map((it) => {
                      const isChecked = !!checked[it.key];
                      const parts: string[] = [];
                      if (it.totalG > 0) parts.push(`${formatQty(it.totalG)} g`);
                      if (it.totalMl > 0) parts.push(`${formatQty(it.totalMl)} ml`);
                      if (it.totalUn > 0) parts.push(`${formatQty(it.totalUn)} un`);
                      return (
                        <Pressable
                          key={it.key}
                          onPress={() => toggleItem(it.key)}
                          style={styles.itemRow}
                          testID={`shop-item-${it.key}`}
                        >
                          <View style={[styles.checkbox, isChecked && styles.checkboxOn]}>
                            {isChecked ? (
                              <MaterialDesignIcons name="check" size={16} color={colors.onBrandPrimary} />
                            ) : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.itemName, isChecked && styles.itemNameChecked]}
                              numberOfLines={1}
                            >
                              {it.name}
                            </Text>
                            <Text style={styles.itemQty}>{parts.join(" · ")}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function formatQty(v: number) {
  if (v >= 1000) return (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " k";
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.onSurface, fontSize: 20, fontWeight: "800", marginTop: 2 },
  toggleAll: {
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  toggleAllText: { color: colors.onSurface, fontSize: 12, fontWeight: "600" },
  chipRow: { height: 56 },
  chipRowContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipSelected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 },
  chipTextSelected: { color: colors.onBrandPrimary, fontWeight: "800" },
  catBlock: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  catIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.brandPrimary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  catMeta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  catItems: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, gap: 4 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  itemName: { color: colors.onSurface, fontSize: 15, fontWeight: "600" },
  itemNameChecked: {
    textDecorationLine: "line-through",
    color: colors.onSurfaceTertiary,
  },
  itemQty: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  empty: { color: colors.onSurfaceTertiary, textAlign: "center", marginTop: spacing.xl },
});
