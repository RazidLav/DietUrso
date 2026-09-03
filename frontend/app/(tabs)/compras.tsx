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

interface Agg {
  key: string;
  name: string;
  totalG: number;
  totalMl: number;
  totalUn: number;
}

export default function ComprasScreen() {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setPlan(await getActivePlan());
    setChecked(await getShoppingChecked());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleDay = (i: number) => {
    setSelectedDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()
    );
  };
  const toggleAll = () => {
    setSelectedDays((prev) => (prev.length === 7 ? [] : [0, 1, 2, 3, 4, 5, 6]));
  };

  const items = useMemo<Agg[]>(() => {
    if (!plan) return [];
    const map = new Map<string, Agg>();
    const daysCount = selectedDays.length;
    // Since plan is same all days (option 1 used), sum by multiplying quantity * daysCount
    for (const meal of plan.meals) {
      const opt = meal.options[0];
      if (!opt) continue;
      for (const food of opt.foods) {
        const key = food.name.trim().toLowerCase();
        const entry = map.get(key) ?? { key, name: food.name, totalG: 0, totalMl: 0, totalUn: 0 };
        if (food.unit === "g") entry.totalG += food.quantity * daysCount;
        else if (food.unit === "ml") entry.totalMl += food.quantity * daysCount;
        else entry.totalUn += food.quantity * daysCount;
        map.set(key, entry);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [plan, selectedDays]);

  const toggleItem = async (key: string) => {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    await setShoppingChecked(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="compras-screen">
      <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>LISTA DE COMPRAS</Text>
            <Text style={styles.title}>Semanal</Text>
          </View>
          <Pressable style={styles.toggleAll} onPress={toggleAll} testID="toggle-all-days-btn">
            <Text style={styles.toggleAllText}>
              {selectedDays.length === 7 ? "Limpar" : "Selecionar 7 dias"}
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

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        {items.length === 0 ? (
          <Text style={styles.empty}>
            {plan ? "Selecione ao menos um dia." : "Nenhum plano ativo."}
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
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
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
