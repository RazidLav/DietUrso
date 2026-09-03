import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  kcal?: number;
  onPress?: () => void;
  status?: "planned" | "as_planned" | "modified";
  testID?: string;
  right?: React.ReactNode;
}

export default function MealCard({ title, subtitle, icon, kcal, onPress, status, testID, right }: Props) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          <MaterialDesignIcons name={(icon as any) ?? "silverware-fork-knife"} size={22} color={colors.onSurface} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        {kcal !== undefined ? (
          <View style={styles.kcalWrap}>
            <Text style={styles.kcal}>{Math.round(kcal)}</Text>
            <Text style={styles.kcalUnit}>kcal</Text>
          </View>
        ) : null}
        {status === "as_planned" ? (
          <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
            <MaterialDesignIcons name="check" size={14} color={colors.onBrandPrimary} />
          </View>
        ) : status === "modified" ? (
          <View style={[styles.badge, { backgroundColor: colors.warning }]}>
            <MaterialDesignIcons name="pencil" size={14} color={colors.onWarning} />
          </View>
        ) : null}
        {right}
      </View>
    </Pressable>
  );
}

const MEAL_ICON: Record<string, string> = {
  pre_treino: "run-fast",
  pos_treino: "dumbbell",
  cafe: "coffee",
  almoco: "food-turkey",
  lanche: "food-apple",
  jantar: "food-variant",
  ceia: "moon-waning-crescent",
};

export function iconForMeal(type: string) {
  return MEAL_ICON[type] ?? "silverware-fork-knife";
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.85 },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1 },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  kcalWrap: { alignItems: "flex-end" },
  kcal: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  kcalUnit: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: -2 },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
