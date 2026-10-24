import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { ContentContainer, IconButton, PageHeader, ResponsiveSheet } from "../src/components/DesignSystem";
import { ACHIEVEMENTS, RARITY_COLORS } from "../src/gamification/achievements";
import { evaluateGamification } from "../src/gamification/engine";
import { CHAPTERS, getLevelDefinition, LEVEL_DEFINITIONS } from "../src/gamification/journey";
import type { LevelDefinition } from "../src/gamification/journey";
import type { AchievementDefinition, GamificationSummary } from "../src/gamification/types";
import { useResponsiveLayout } from "../src/responsive";
import { colors, radius, spacing, withAlpha } from "../src/theme";

type CaveRoom = "Jornada" | "Salão" | "Segredos" | "Fogueira" | "Relíquias";
type LoadState = "loading" | "ready" | "error";

const ROOMS: { id: CaveRoom; icon: string; label: string }[] = [
  { id: "Jornada", icon: "map-marker-path", label: "Jornada" },
  { id: "Salão", icon: "trophy-outline", label: "Salão" },
  { id: "Segredos", icon: "lock-question", label: "Segredos" },
  { id: "Fogueira", icon: "campfire", label: "Fogueira" },
  { id: "Relíquias", icon: "diamond-stone", label: "Relíquias" },
];

export default function TrophyCaveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const [status, setStatus] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [room, setRoom] = useState<CaveRoom>("Jornada");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const desktop = responsive.isDesktop;

  const load = useCallback(async () => {
    try {
      const next = await evaluateGamification();
      setSummary(next);
      setSelectedLevel((current) => current === 1 ? next.narrativeLevel : current);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const selected = getLevelDefinition(selectedLevel);

  return (
    <View style={styles.screen} testID="trophy-cave-screen">
      <ContentContainer style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <PageHeader eyebrow="JORNADA URSOFIT" title="Caverna de Troféus" onBack={() => router.back()} action={<IconButton icon="teddy-bear" label="Abrir Meu Urso" onPress={() => router.push("/meu-urso" as never)} />} />
      </ContentContainer>

      {status === "loading" ? <LoadingState /> : null}
      {status === "error" ? <ErrorState onRetry={load} /> : null}
      {status === "ready" && summary ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}>
          <JourneyHero summary={summary} compact={responsive.width < 560} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rooms}>
            {ROOMS.map((item) => {
              const active = item.id === room;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setRoom(item.id)}
                  style={[styles.roomButton, active && styles.roomButtonActive]}
                >
                  <MaterialDesignIcons name={item.icon as any} size={18} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                  <Text style={[styles.roomLabel, active && styles.roomLabelActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {room === "Jornada" ? (
            <View style={[styles.journeyLayout, desktop && styles.journeyLayoutDesktop]}>
              <JourneyMap summary={summary} selectedLevel={selectedLevel} onSelect={setSelectedLevel} />
              <LevelDetail level={selected} summary={summary} />
            </View>
          ) : null}
          {room === "Salão" ? <TrophyHall summary={summary} /> : null}
          {room === "Segredos" ? <PreparedRoom icon="lock-question" title="Segredos da Caverna" text="Conquistas secretas aparecem aqui conforme você as descobre." /> : null}
          {room === "Fogueira" ? <PreparedRoom icon="campfire" title="Fogueira" text="Um espaço preparado para recapitular marcos, histórias e sequências da sua jornada." /> : null}
          {room === "Relíquias" ? <PreparedRoom icon="diamond-stone" title="Relíquias" text="Colecionáveis especiais e recompensas futuras ficarão guardados aqui." /> : null}
        </ScrollView>
      ) : null}
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.centerState} testID="journey-loading">
      <ActivityIndicator color={colors.brandPrimary} size="small" />
      <View style={styles.skeletonHero}><View style={styles.skeletonLineWide} /><View style={styles.skeletonLine} /><View style={styles.skeletonArt} /></View>
      <View style={styles.skeletonCard}><View style={styles.skeletonLine} /><View style={styles.skeletonLineWide} /><View style={styles.skeletonLine} /></View>
      <Text style={styles.stateText}>Iluminando a caverna e organizando sua jornada…</Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void | Promise<void> }) {
  return (
    <View style={styles.centerState} testID="journey-error">
      <MaterialDesignIcons name="cloud-alert" size={38} color={colors.error} />
      <Text style={styles.stateTitle}>Não foi possível abrir a jornada</Text>
      <Text style={styles.stateText}>Seus dados continuam seguros. Verifique a conexão e tente novamente.</Text>
      <Pressable style={styles.primaryButton} onPress={() => void onRetry()}><Text style={styles.primaryButtonText}>Tentar novamente</Text></Pressable>
    </View>
  );
}

function JourneyHero({ summary, compact }: { summary: GamificationSummary; compact: boolean }) {
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <View style={styles.heroCopy}>
        <Text style={styles.heroChapter}>CAPÍTULO {summary.chapterNumber} · {summary.chapterTitle.toUpperCase()}</Text>
        <Text style={styles.heroTitle}>{summary.title}</Text>
        <Text style={styles.heroSubtitle}>Nível {summary.narrativeLevel} de 100</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(3, summary.progress * 100)}%` }]} />
        </View>
        <View style={styles.heroStats}>
          <Text style={styles.heroStat}>{summary.isMaxLevel ? `${summary.overflowXp} XP além da lenda` : `${summary.xpIntoLevel}/${summary.xpForNextLevel} XP`}</Text>
          <Text style={styles.heroStat}>{summary.unlockedCount}/{summary.totalAchievements} troféus</Text>
        </View>
      </View>
      <Image source={require("../assets/images/home-progress-v2.png")} style={[styles.heroMascot, compact && styles.heroMascotCompact]} resizeMode="contain" />
    </View>
  );
}

function JourneyMap({ summary, selectedLevel, onSelect }: { summary: GamificationSummary; selectedLevel: number; onSelect: (level: number) => void }) {
  return (
    <View style={styles.mapColumn} accessibilityLabel="Mapa dos 100 níveis">
      <View style={styles.mapHeading}>
        <Text style={styles.mapTitle}>Sua jornada</Text>
        <Text style={styles.mapHint}>Deslize para explorar os capítulos</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapterRail}>
      {CHAPTERS.map((chapter) => {
        const completed = summary.narrativeLevel >= chapter.lastLevel;
        const current = summary.chapterNumber === chapter.number;
        const levels = LEVEL_DEFINITIONS.slice(chapter.firstLevel - 1, chapter.lastLevel);
        return (
          <View key={chapter.id} style={[styles.chapterCard, current && styles.chapterCardCurrent]} testID={`chapter-${chapter.number}`}>
            <View style={styles.chapterHeader}>
              <View style={[styles.medallion, completed && styles.medallionCompleted]}>
                <Text style={[styles.medallionText, completed && styles.medallionTextCompleted]}>{chapter.number}</Text>
              </View>
              <View style={styles.chapterCopy}>
                <Text style={styles.chapterEyebrow}>CAPÍTULO {chapter.number}</Text>
                <Text style={styles.chapterTitle}>{chapter.title}</Text>
                <Text style={styles.chapterDescription}>{chapter.description}</Text>
              </View>
              {completed ? <MaterialDesignIcons name="check-decagram" size={24} color="#FFD166" /> : null}
            </View>
            <View style={styles.compactLevelGrid}>
              {levels.map((level) => {
                const done = level.number < summary.narrativeLevel;
                const active = level.number === summary.narrativeLevel;
                const selected = selectedLevel === level.number;
                return <Pressable key={level.id} accessibilityRole="button" accessibilityLabel={`Nível ${level.number}, ${active ? "atual" : done ? "concluído" : "bloqueado"}`} onPress={() => onSelect(level.number)} style={[styles.compactLevel, done && styles.compactLevelDone, active && styles.compactLevelActive, selected && styles.compactLevelSelected]} testID={`level-node-${level.number}`}>
                  {done ? <MaterialDesignIcons name="check" size={15} color={colors.onBrandPrimary} /> : <Text style={[styles.compactLevelText, active && styles.compactLevelTextActive]}>{level.number}</Text>}
                </Pressable>;
              })}
            </View>
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

function LevelDetail({ level, summary }: { level: LevelDefinition; summary: GamificationSummary }) {
  const state = level.number < summary.narrativeLevel ? "Concluído" : level.number === summary.narrativeLevel ? "Atual" : "Bloqueado";
  return (
    <View style={styles.detailCard} testID="level-detail">
      <View style={styles.detailBadge}>
        <MaterialDesignIcons name={level.special ? "star-circle" : "paw"} size={31} color={colors.brandPrimary} />
      </View>
      <Text style={styles.detailEyebrow}>NÍVEL {level.number} · {state.toUpperCase()}</Text>
      <Text style={styles.detailTitle}>{level.title}</Text>
      <Text style={styles.detailDescription}>{level.description}</Text>
      <View style={styles.detailDivider} />
      <Text style={styles.detailLabel}>Capítulo</Text>
      <Text style={styles.detailValue}>{level.chapterNumber} · {CHAPTERS[level.chapterNumber - 1].title}</Text>
      <Text style={styles.detailLabel}>Marco de XP</Text>
      <Text style={styles.detailValue}>{level.minXp} XP acumulados</Text>
      {level.rewardId ? <Text style={styles.rewardText}>Recompensa: medalhão do capítulo</Text> : null}
      {level.contentStatus === "awaiting_master_document" ? (
        <View style={styles.pendingNotice}><MaterialDesignIcons name="book-clock-outline" size={17} color={colors.warning} /><Text style={styles.pendingText}>Narrativa oficial reservada para importação do documento-mestre.</Text></View>
      ) : null}
    </View>
  );
}

function TrophyHall({ summary }: { summary: GamificationSummary }) {
  const achievements = useMemo(() => [...ACHIEVEMENTS].sort((a, b) => Number(Boolean(summary.state.unlockedAt[b.id])) - Number(Boolean(summary.state.unlockedAt[a.id]))), [summary]);
  const [showAll, setShowAll] = useState(false);
  const featured = achievements.slice(0, 3);
  return (
    <View style={styles.hall}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Salão de Troféus</Text>
        <Text style={styles.sectionMeta}>{summary.unlockedCount} de {summary.totalAchievements} descobertos</Text>
      </View>
      <View style={styles.trophyShelf} testID="trophy-shelf">
        {featured.map((achievement) => <AchievementPeek key={achievement.id} achievement={achievement} unlockedAt={summary.state.unlockedAt[achievement.id] ?? null} />)}
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver mais ${Math.max(0, achievements.length - 3)} conquistas`} onPress={() => setShowAll(true)} style={({ pressed }) => [styles.moreTrophies, pressed && styles.moreTrophiesPressed]} testID="trophy-more-card">
          <View style={styles.trophyStackBackTwo} /><View style={styles.trophyStackBackOne} />
          <View style={styles.trophyStackFront}><MaterialDesignIcons name="plus" size={26} color={colors.onBrandPrimary} /></View>
          <Text style={styles.moreTrophiesTitle}>Ver todas</Text>
          <Text style={styles.moreTrophiesCount}>+{Math.max(0, achievements.length - 3)}</Text>
        </Pressable>
      </View>
      <ResponsiveSheet visible={showAll} title="Todos os troféus" description={`${summary.unlockedCount} de ${summary.totalAchievements} descobertos`} onClose={() => setShowAll(false)} width={760}>
        <View style={styles.trophyGrid}>{achievements.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} unlockedAt={summary.state.unlockedAt[achievement.id] ?? null} />)}</View>
      </ResponsiveSheet>
    </View>
  );
}

function AchievementPeek({ achievement, unlockedAt }: { achievement: AchievementDefinition; unlockedAt: string | null }) {
  const unlocked = Boolean(unlockedAt);
  const secret = achievement.hidden && !unlocked;
  const rarityColor = RARITY_COLORS[achievement.rarity];
  return <View style={[styles.trophyPeek, unlocked && { borderColor: withAlpha(rarityColor, 0.62) }]}>
    <View style={[styles.trophyPeekIcon, { backgroundColor: unlocked ? withAlpha(rarityColor, 0.14) : colors.surfaceTertiary }]}><MaterialDesignIcons name={(secret ? "lock-question" : achievement.icon) as any} size={22} color={unlocked ? rarityColor : colors.onSurfaceTertiary} /></View>
    <Text numberOfLines={2} style={[styles.trophyPeekTitle, !unlocked && styles.lockedText]}>{secret ? "Conquista secreta" : achievement.title}</Text>
    <Text numberOfLines={1} style={[styles.trophyPeekMeta, { color: rarityColor }]}>{unlockedAt ? "Conquistada" : `+${achievement.xpReward} XP`}</Text>
  </View>;
}

function AchievementCard({ achievement, unlockedAt }: { achievement: AchievementDefinition; unlockedAt: string | null }) {
  const unlocked = Boolean(unlockedAt);
  const secret = achievement.hidden && !unlocked;
  const rarityColor = RARITY_COLORS[achievement.rarity];
  return (
    <View style={[styles.trophyCard, unlocked && { borderColor: withAlpha(rarityColor, 0.62) }]} testID={`achievement-${achievement.id}`}>
      <View style={[styles.trophyIcon, { backgroundColor: unlocked ? withAlpha(rarityColor, 0.14) : colors.surfaceTertiary }]}>
        <MaterialDesignIcons name={(secret ? "lock-question" : achievement.icon) as any} size={27} color={unlocked ? rarityColor : colors.onSurfaceTertiary} />
      </View>
      <View style={styles.trophyCopy}>
        <Text style={[styles.trophyTitle, !unlocked && styles.lockedText]}>{secret ? "Conquista secreta" : achievement.title}</Text>
        <Text style={styles.trophyDescription}>{unlocked ? achievement.description : achievement.lockedHint}</Text>
        <Text style={[styles.trophyReward, { color: rarityColor }]}>{unlockedAt ? new Date(unlockedAt).toLocaleDateString("pt-BR") : `+${achievement.xpReward} XP`}</Text>
      </View>
    </View>
  );
}

function PreparedRoom({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.preparedRoom}>
      <View style={styles.preparedIcon}><MaterialDesignIcons name={icon as any} size={34} color={colors.brandPrimary} /></View>
      <Text style={styles.preparedTitle}>{title}</Text>
      <Text style={styles.preparedText}>{text}</Text>
      <Text style={styles.preparedTag}>ESPAÇO PREPARADO PARA AS PRÓXIMAS EXPEDIÇÕES</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingBottom: spacing.md, backgroundColor: colors.surface },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: spacing.lg, gap: spacing.lg },
  centerState: { flex: 1, minHeight: 360, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  stateTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, maxWidth: 360, textAlign: "center" },
  skeletonHero: { width: "100%", maxWidth: 760, height: 180, overflow: "hidden", padding: spacing.xl, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  skeletonCard: { width: "100%", maxWidth: 760, padding: spacing.xl, gap: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  skeletonLine: { width: "42%", height: 11, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  skeletonLineWide: { width: "68%", height: 18, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  skeletonArt: { position: "absolute", right: spacing.xl, bottom: spacing.lg, width: 110, height: 110, borderRadius: 55, backgroundColor: colors.surfaceTertiary },
  primaryButton: { marginTop: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.pill },
  primaryButtonText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "900" },
  hero: { minHeight: 190, flexDirection: "row", overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  heroCompact: { flexDirection: "column", minHeight: 0 },
  heroCopy: { flex: 1.15, minWidth: 220, padding: spacing.lg, justifyContent: "center", zIndex: 1 },
  heroChapter: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: colors.onSurface, fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: spacing.xs },
  heroSubtitle: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.xs },
  progressTrack: { height: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: spacing.lg },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  heroStats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  heroStat: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  heroMascot: { flex: 0, width: "38%", minWidth: 140, height: 205 },
  heroMascotCompact: { width: "100%", minWidth: 0, height: 185 },
  rooms: { gap: spacing.sm, paddingVertical: 1 },
  roomButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  roomButtonActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roomLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800" },
  roomLabelActive: { color: colors.onBrandPrimary },
  journeyLayout: { gap: spacing.lg },
  journeyLayoutDesktop: { flexDirection: "row", alignItems: "flex-start" },
  mapColumn: { flex: 1, minWidth: 0, gap: spacing.sm },
  mapHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md },
  mapTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  mapHint: { color: colors.onSurfaceTertiary, fontSize: 9 },
  chapterRail: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  chapterCard: { width: 268, minHeight: 214, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  chapterCardCurrent: { backgroundColor: withAlpha(colors.brandPrimary, 0.07) },
  chapterHeader: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  medallion: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  medallionCompleted: { backgroundColor: "#FFD166", borderColor: "#FFD166" },
  medallionText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "900" },
  medallionTextCompleted: { color: "#392A00" },
  chapterCopy: { flex: 1 },
  chapterEyebrow: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  chapterTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  chapterDescription: { color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 14, marginTop: 3 },
  compactLevelGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingTop: spacing.md },
  compactLevel: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  compactLevelDone: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  compactLevelActive: { backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.brandPrimary },
  compactLevelSelected: { borderColor: colors.brandSecondary, transform: [{ scale: 1.07 }] },
  compactLevelText: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "900" },
  compactLevelTextActive: { color: colors.onSurface },
  levelPath: { paddingTop: spacing.md },
  levelRow: { minHeight: 62, flexDirection: "row", gap: spacing.md },
  pathRail: { width: 42, alignItems: "center" },
  levelNode: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 2, borderColor: colors.borderStrong, zIndex: 1 },
  levelNodeCompleted: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  levelNodeCurrent: { backgroundColor: colors.surfaceSecondary, borderColor: colors.brandPrimary },
  levelNodeLocked: { opacity: 0.58 },
  levelNodeSelected: { transform: [{ scale: 1.08 }], borderColor: colors.brandSecondary },
  levelNumber: { color: colors.onSurface, fontSize: 11, fontWeight: "900" },
  levelNumberLocked: { color: colors.onSurfaceTertiary },
  connector: { width: 2, flex: 1, minHeight: 24, backgroundColor: colors.border },
  connectorCompleted: { backgroundColor: colors.brandPrimary },
  levelCopy: { flex: 1, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  levelCopySelected: { backgroundColor: withAlpha(colors.brandSecondary, 0.1) },
  levelTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900" },
  levelMeta: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 },
  lockedText: { color: colors.onSurfaceTertiary },
  detailCard: { width: "100%", maxWidth: 340, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignSelf: "flex-start" },
  detailBadge: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.brandPrimary, 0.12), marginBottom: spacing.md },
  detailEyebrow: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  detailTitle: { color: colors.onSurface, fontSize: 23, lineHeight: 27, fontWeight: "900", marginTop: spacing.xs },
  detailDescription: { color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
  detailDivider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.lg },
  detailLabel: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "800", textTransform: "uppercase", marginTop: spacing.sm },
  detailValue: { color: colors.onSurface, fontSize: 12, fontWeight: "700", marginTop: 2 },
  rewardText: { color: "#C79315", fontSize: 10, fontWeight: "900", marginTop: spacing.lg },
  pendingNotice: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.warning, 0.1) },
  pendingText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 9, lineHeight: 14 },
  hall: { gap: spacing.lg },
  sectionHeading: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  sectionMeta: { color: colors.onSurfaceTertiary, fontSize: 10 },
  trophyShelf: { flexDirection: "row", gap: spacing.sm, alignItems: "stretch" },
  trophyPeek: { flex: 1, minWidth: 0, minHeight: 126, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  trophyPeekIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  trophyPeekTitle: { color: colors.onSurface, fontSize: 9, lineHeight: 12, fontWeight: "900", textAlign: "center" },
  trophyPeekMeta: { maxWidth: "100%", fontSize: 8, fontWeight: "900", textAlign: "center" },
  moreTrophies: { flex: 1, minWidth: 0, minHeight: 126, alignItems: "center", justifyContent: "center", gap: 3, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  moreTrophiesPressed: { opacity: 0.72 },
  trophyStackBackTwo: { position: "absolute", top: 25, width: 42, height: 38, borderRadius: radius.sm, transform: [{ rotate: "8deg" }], backgroundColor: withAlpha(colors.brandPrimary, 0.16) },
  trophyStackBackOne: { position: "absolute", top: 22, width: 42, height: 38, borderRadius: radius.sm, transform: [{ rotate: "-7deg" }], backgroundColor: withAlpha(colors.brandPrimary, 0.32) },
  trophyStackFront: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary },
  moreTrophiesTitle: { color: colors.onSurface, fontSize: 9, fontWeight: "900", textAlign: "center" },
  moreTrophiesCount: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900" },
  trophyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  trophyCard: { flexGrow: 1, flexBasis: 280, minWidth: 260, maxWidth: 570, flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  trophyIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  trophyCopy: { flex: 1 },
  trophyTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "900" },
  trophyDescription: { color: colors.onSurfaceTertiary, fontSize: 9, lineHeight: 14, marginTop: 3 },
  trophyReward: { fontSize: 9, fontWeight: "900", marginTop: spacing.sm },
  preparedRoom: { minHeight: 320, alignItems: "center", justifyContent: "center", padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  preparedIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.brandPrimary, 0.1) },
  preparedTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900", marginTop: spacing.lg },
  preparedText: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, maxWidth: 430, textAlign: "center", marginTop: spacing.sm },
  preparedTag: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", letterSpacing: 1.1, textAlign: "center", marginTop: spacing.lg },
});
