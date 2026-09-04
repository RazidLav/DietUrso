import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { RARITY_COLORS } from "../gamification/achievements";
import type { AchievementDefinition } from "../gamification/types";
import { colors, radius, spacing } from "../theme";

export default function AchievementUnlockModal({
  achievement,
  onDismiss,
}: {
  achievement: AchievementDefinition | null;
  onDismiss: () => void;
}) {
  const rarityColor = achievement ? RARITY_COLORS[achievement.rarity] : colors.brandPrimary;
  return (
    <Modal visible={Boolean(achievement)} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        {achievement ? (
          <View style={[styles.card, { borderColor: rarityColor }]} testID="achievement-unlock-modal">
            <View style={styles.sparkles}>
              <Text style={styles.sparkle}>✦</Text><Text style={styles.sparkle}>✧</Text><Text style={styles.sparkle}>✦</Text>
            </View>
            <View style={[styles.iconWrap, { backgroundColor: rarityColor + "22" }]}>
              <MaterialDesignIcons name={achievement.icon as any} size={42} color={rarityColor} />
            </View>
            <Text style={styles.eyebrow}>🏆 CONQUISTA DESBLOQUEADA</Text>
            <Text style={styles.title}>{achievement.title}</Text>
            <Text style={styles.message}>“{achievement.unlockMessage}”</Text>
            <View style={[styles.xpPill, { backgroundColor: rarityColor }]}>
              <Text style={styles.xpText}>+{achievement.xpReward} XP</Text>
            </View>
            <Pressable style={styles.button} onPress={onDismiss} testID="dismiss-achievement-btn">
              <Text style={styles.buttonText}>Boa!</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  card: {
    width: "100%",
    maxWidth: 390,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sparkles: { width: "70%", flexDirection: "row", justifyContent: "space-between" },
  sparkle: { color: colors.brandPrimary, fontSize: 24 },
  iconWrap: { width: 82, height: 82, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, textAlign: "center" },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "900", textAlign: "center" },
  message: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
  xpPill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  xpText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "900" },
  button: { width: "100%", minHeight: 46, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, marginTop: spacing.xs },
  buttonText: { color: colors.onBrandPrimary, fontWeight: "900" },
});
