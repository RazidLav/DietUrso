import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, withAlpha } from "../theme";

export type DashboardPeriod = "week" | "month" | "year";

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "week", label: "Semanal" },
  { id: "month", label: "Mensal" },
  { id: "year", label: "Anual" },
];

export function DashboardPeriodControl({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  const currentIndex = PERIODS.findIndex((period) => period.id === value);
  const current = PERIODS[currentIndex] ?? PERIODS[1];
  const selectNext = () => onChange(PERIODS[(currentIndex + 1) % PERIODS.length].id);

  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`Período: ${current.label}. Toque para alterar`}
    onPress={selectNext}
    style={({ pressed }) => [styles.period, pressed && styles.pressed]}
    testID="dashboard-period-control"
  >
    <Text style={styles.periodText}>{current.label}</Text>
    <MaterialDesignIcons name="chevron-down" size={15} color={colors.onSurfaceSecondary} />
  </Pressable>;
}

export function DashboardPanelHeader({
  title,
  hint,
  period,
  onPeriodChange,
  onOptions,
}: {
  title: string;
  hint?: string;
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
  onOptions?: () => void;
}) {
  return <View style={styles.header}>
    <View style={styles.copy}>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
    <View style={styles.actions}>
      {onOptions ? <Pressable accessibilityRole="button" accessibilityLabel={`Opções de ${title}`} onPress={onOptions} style={({ pressed }) => [styles.options, pressed && styles.pressed]}>
        <MaterialDesignIcons name="tune-variant" size={17} color={colors.onSurfaceSecondary} />
      </Pressable> : null}
      {period && onPeriodChange ? <DashboardPeriodControl value={period} onChange={onPeriodChange} /> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  hint: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 3 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  options: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive },
  period: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: withAlpha(colors.onSurface, 0.08), backgroundColor: colors.surfaceInteractive },
  periodText: { color: colors.onSurfaceSecondary, fontSize: 9, fontWeight: "800" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});
