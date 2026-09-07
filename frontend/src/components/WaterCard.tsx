import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatHydrationVolume, summaryMessage } from "../hydration/calculations";
import type { HydrationSummary } from "../hydration/types";
import { colors, radius, spacing } from "../theme";

export default function WaterCard({ summary, onQuickAdd, onPress, saving = false }: { summary: HydrationSummary; onQuickAdd: () => void; onPress: () => void; saving?: boolean }) {
  const progress = Math.min(summary.percentage, 100);
  const paceColor = summary.pace === "ahead" ? colors.brandPrimary : summary.pace === "behind" ? colors.brandTertiary : colors.brandSecondary;

  return (
    <View style={styles.card} testID="water-card">
      <Pressable style={styles.mainRow} onPress={onPress} accessibilityRole="button" accessibilityLabel="Abrir hidratação inteligente">
        <View style={styles.iconWrap}><MaterialDesignIcons name="water" size={22} color={colors.brandSecondary} /></View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}><Text style={styles.title}>HidratUrso</Text><Text style={[styles.pace, { color: paceColor }]}>{summary.pace === "ahead" ? "ADIANTADO" : summary.pace === "behind" ? "ATRASADO" : "NO RITMO"}</Text></View>
          <Text style={styles.amount}>{formatHydrationVolume(summary.consumedMl)} <Text style={styles.goal}>de {formatHydrationVolume(summary.goalMl)} · {Math.round(summary.percentage)}%</Text></Text>
          <Text style={styles.subtitle}>{summaryMessage(summary)}</Text>
        </View>
        <MaterialDesignIcons name="chevron-right" size={22} color={colors.onSurfaceTertiary} />
      </Pressable>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(progress, summary.consumedMl > 0 ? 2 : 0)}%` }]} /></View>
      <View style={styles.footer}>
        <Text style={styles.expected}>Esperado agora: {formatHydrationVolume(summary.expectedMl)}</Text>
        <Pressable disabled={saving} style={[styles.add, saving && { opacity: 0.55 }]} onPress={onQuickAdd} accessibilityLabel="Adicionar 250 ml" testID="home-water-add-250">
          <MaterialDesignIcons name="plus" size={17} color={colors.onBrandPrimary} /><Text style={styles.addText}>{saving ? "Salvando" : "250 ml"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  mainRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconWrap: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSecondary + "22", alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  pace: { fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  amount: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: 3 },
  goal: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "600" },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3, lineHeight: 14 },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandSecondary },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  expected: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 10 },
  add: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "900" },
});
