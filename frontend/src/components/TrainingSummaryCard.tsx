import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { TrainingDayEntry } from "../training/types";
import { colors, radius, spacing } from "../theme";

export default function TrainingSummaryCard({ entries, onPress }: { entries: TrainingDayEntry[]; onPress: () => void }) {
  const completed = entries.filter((entry) => entry.status === "completed").length;
  const active = entries.find((entry) => entry.status === "in_progress");
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel="Abrir treinos completos">
      <View style={styles.top}><View style={styles.icon}><MaterialDesignIcons name="arm-flex-outline" size={26} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.eyebrow}>URSOFIT · TREINOS</Text><Text style={styles.title}>{active ? `Continuar ${active.planned.name}` : entries.length ? `${completed}/${entries.length} sessões concluídas` : "Nenhuma sessão hoje"}</Text></View><MaterialDesignIcons name="chevron-right" size={24} color={colors.onSurfaceTertiary} /></View>
      <View style={styles.bottom}><Text style={styles.message}>{entries.length ? "Cada modalidade mantém seu próprio status e histórico." : "Planeje musculação, mobilidade, corrida, bike ou CrossFit."}</Text><View style={styles.cta}><Text style={styles.ctaText}>{active ? "CONTINUAR" : entries.length ? "VER DIA" : "ADICIONAR"}</Text></View></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: `${colors.brandPrimary}20`, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, letterSpacing: 1, fontWeight: "900" },
  title: { color: colors.onSurface, fontSize: 17, fontWeight: "800", marginTop: 2 },
  bottom: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  message: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },
  cta: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  ctaText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "900" },
});
