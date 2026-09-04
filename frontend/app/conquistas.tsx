import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { ACHIEVEMENTS, RARITY_COLORS } from "../src/gamification/achievements";
import { evaluateGamification } from "../src/gamification/engine";
import { MASCOT_QUOTES } from "../src/gamification/config";
import type { AchievementCategory, AchievementDefinition, GamificationSummary } from "../src/gamification/types";
import { colors, radius, spacing } from "../src/theme";

const FILTERS: ("Todas" | AchievementCategory)[] = ["Todas", "Primeiros passos", "Proteína", "Alimentação", "Água", "Secretas"];

export default function AchievementsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todas");
  const load = useCallback(() => evaluateGamification().then(setSummary), []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const visible = useMemo(
    () => ACHIEVEMENTS.filter((achievement) => filter === "Todas" || achievement.category === filter),
    [filter]
  );
  const quote = MASCOT_QUOTES[(summary?.state.totalXp ?? 0) % MASCOT_QUOTES.length];

  return (
    <View style={styles.screen} testID="achievements-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()} testID="achievements-back-btn">
          <MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>PROGRESSO</Text>
          <Text style={styles.headerTitle}>Caverna de Troféus</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxxl }}>
        <View style={styles.hero}>
          <Image source={require("../assets/images/mascot-trophy.jpg")} style={styles.mascot} resizeMode="contain" />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroTitle}>{summary?.title ?? "Ursinho Recém-Acordado"}</Text>
            <Text style={styles.heroLevel}>Nível {summary?.level ?? 1}</Text>
            <Text style={styles.quote}>“{quote}”</Text>
          </View>
        </View>

        {summary ? (
          <View style={styles.levelCard}>
            <View style={styles.levelTop}>
              <Text style={styles.levelLabel}>{summary.xpIntoLevel} / {summary.xpForNextLevel} XP</Text>
              <Text style={styles.totalXp}>{summary.state.totalXp} XP total</Text>
            </View>
            <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(summary.progress * 100, 2)}%` }]} /></View>
            <View style={styles.statsRow}>
              <SmallStat icon="fire" value={`${summary.context.currentStreak} ${summary.context.currentStreak === 1 ? "dia" : "dias"}`} label="Sequência" color={colors.brandTertiary} />
              <SmallStat icon="trophy" value={`${summary.unlockedCount}/${summary.totalAchievements}`} label="Conquistas" color="#FFD166" />
              <SmallStat icon="water" value={`${summary.context.waterCurrentStreak} ${summary.context.waterCurrentStreak === 1 ? "dia" : "dias"}`} label="Hidratação" color={colors.brandSecondary} />
            </View>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => (
            <Pressable key={item} style={[styles.filter, filter === item && styles.filterActive]} onPress={() => setFilter(item)}>
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.list}>
          {visible.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} unlockedAt={summary?.state.unlockedAt[achievement.id] ?? null} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function SmallStat({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.smallStat}>
      <MaterialDesignIcons name={icon as any} size={17} color={color} />
      <Text style={styles.smallValue}>{value}</Text>
      <Text style={styles.smallLabel}>{label}</Text>
    </View>
  );
}

function AchievementCard({ achievement, unlockedAt }: { achievement: AchievementDefinition; unlockedAt: string | null }) {
  const unlocked = Boolean(unlockedAt);
  const secret = achievement.hidden && !unlocked;
  const rarityColor = RARITY_COLORS[achievement.rarity];
  return (
    <View style={[styles.achievement, unlocked && { borderColor: rarityColor + "99" }]} testID={`achievement-${achievement.id}`}>
      <View style={[styles.achievementIcon, { backgroundColor: unlocked ? rarityColor + "22" : colors.surfaceTertiary }]}>
        <MaterialDesignIcons name={(secret ? "lock-question" : achievement.icon) as any} size={27} color={unlocked ? rarityColor : colors.onSurfaceTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.achievementTop}>
          <Text style={[styles.achievementTitle, !unlocked && styles.lockedText]}>{secret ? "??? — Conquista secreta" : achievement.title}</Text>
          <View style={[styles.rarity, { borderColor: rarityColor + "88" }]}><Text style={[styles.rarityText, { color: rarityColor }]}>{achievement.rarity}</Text></View>
        </View>
        <Text style={styles.achievementDescription}>{unlocked ? achievement.description : achievement.lockedHint}</Text>
        <View style={styles.achievementFooter}>
          <Text style={styles.category}>{achievement.category}</Text>
          {unlockedAt ? <Text style={styles.date}>{new Date(unlockedAt).toLocaleDateString("pt-BR")}</Text> : null}
          <Text style={[styles.reward, { color: rarityColor }]}>+{achievement.xpReward} XP</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  headerTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  hero: { margin: spacing.lg, borderRadius: radius.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.brandPrimary + "66", backgroundColor: colors.surfaceSecondary },
  mascot: { width: "100%", height: 210, backgroundColor: "#B7FF2A" },
  heroOverlay: { padding: spacing.lg, backgroundColor: colors.surfaceSecondary },
  heroTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "900" },
  heroLevel: { color: colors.brandPrimary, fontSize: 12, fontWeight: "900", marginTop: 2 },
  quote: { color: colors.onSurfaceSecondary, fontSize: 11, fontStyle: "italic", marginTop: spacing.xs },
  levelCard: { marginHorizontal: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  levelTop: { flexDirection: "row", justifyContent: "space-between" },
  levelLabel: { color: colors.onSurface, fontSize: 12, fontWeight: "900" },
  totalXp: { color: colors.onSurfaceTertiary, fontSize: 11 },
  track: { height: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  statsRow: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, paddingVertical: spacing.sm },
  smallStat: { flex: 1, alignItems: "center", gap: 2 },
  smallValue: { color: colors.onSurface, fontSize: 11, fontWeight: "900" },
  smallLabel: { color: colors.onSurfaceTertiary, fontSize: 8 },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm },
  filter: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800" },
  filterTextActive: { color: colors.onBrandPrimary },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  achievement: { flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  achievementIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  achievementTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  achievementTitle: { flex: 1, color: colors.onSurface, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  lockedText: { color: colors.onSurfaceSecondary },
  achievementDescription: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, marginTop: 3 },
  rarity: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  rarityText: { fontSize: 8, fontWeight: "900" },
  achievementFooter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  category: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 8, fontWeight: "700", textTransform: "uppercase" },
  date: { color: colors.onSurfaceTertiary, fontSize: 8 },
  reward: { fontSize: 9, fontWeight: "900" },
});
