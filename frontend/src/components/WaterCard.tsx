import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { WATER_GOAL_ML, WATER_STEP_ML } from "../gamification/config";
import { colors, radius, spacing } from "../theme";

export default function WaterCard({ amount, onChange }: { amount: number; onChange: (delta: number) => void }) {
  const progress = Math.min(amount / WATER_GOAL_ML, 1);
  const complete = amount >= WATER_GOAL_ML;

  return (
    <View style={styles.card} testID="water-card">
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <MaterialDesignIcons name="water" size={22} color={colors.brandSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>HidratUrso</Text>
          <Text style={styles.subtitle}>{complete ? "Meta de água batida! 💧" : `${amount} de ${WATER_GOAL_ML} ml`}</Text>
        </View>
        <Pressable style={styles.control} onPress={() => onChange(-WATER_STEP_ML)} accessibilityLabel="Remover 250 ml">
          <MaterialDesignIcons name="minus" size={18} color={colors.onSurface} />
        </Pressable>
        <Pressable style={[styles.control, styles.add]} onPress={() => onChange(WATER_STEP_ML)} accessibilityLabel="Adicionar 250 ml">
          <MaterialDesignIcons name="plus" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(progress * 100, amount > 0 ? 2 : 0)}%` }]} />
      </View>
      <Text style={styles.hint}>Cada toque adiciona {WATER_STEP_ML} ml</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brandSecondary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  control: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  add: { backgroundColor: colors.brandPrimary },
  track: { height: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandSecondary },
  hint: { color: colors.onSurfaceTertiary, fontSize: 9, textAlign: "right" },
});
