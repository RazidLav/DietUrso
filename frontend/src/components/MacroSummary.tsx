import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

interface Props {
  kcal: number;
  protein: number;
  carbs: number;
  fats: number;
  compact?: boolean;
}

export default function MacroSummary({ kcal, protein, carbs, fats, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} testID="macro-summary">
      <View style={styles.kcalRow}>
        <Text style={styles.kcalValue}>{Math.round(kcal).toLocaleString("pt-BR")}</Text>
        <Text style={styles.kcalLabel}>kcal</Text>
      </View>
      <View style={styles.macrosRow}>
        <MacroPill label="Proteína" value={protein} color={colors.protein} testID="macro-protein" />
        <MacroPill label="Carbo" value={carbs} color={colors.carbs} testID="macro-carbs" />
        <MacroPill label="Gordura" value={fats} color={colors.fats} testID="macro-fats" />
      </View>
    </View>
  );
}

function MacroPill({ label, value, color, testID }: { label: string; value: number; color: string; testID: string }) {
  return (
    <View style={styles.pill} testID={testID}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <View>
        <Text style={styles.pillValue}>{Math.round(value)}g</Text>
        <Text style={styles.pillLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapCompact: {
    padding: spacing.md,
  },
  kcalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  kcalValue: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.onSurface,
    letterSpacing: -1,
  },
  kcalLabel: {
    fontSize: 16,
    color: colors.onSurfaceTertiary,
    fontWeight: "600",
  },
  macrosRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  pillValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onSurface,
  },
  pillLabel: {
    fontSize: 11,
    color: colors.onSurfaceTertiary,
    marginTop: 1,
  },
});
