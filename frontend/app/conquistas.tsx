import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { ACHIEVEMENTS, RARITY_COLORS } from "../src/gamification/achievements";
import { evaluateGamification } from "../src/gamification/engine";
import { CHAPTERS, getLevelDefinition, LEVEL_DEFINITIONS } from "../src/gamification/journey";
import type { LevelDefinition } from "../src/gamification/journey";
import type { AchievementDefinition, GamificationSummary } from "../src/gamification/types";
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
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [status, setStatus] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [room, setRoom] = useState<CaveRoom>("Jornada");
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [reduceMotion, setReduceMotion] = useState(false);
  const desktop = width >= 900;

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

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (status !== "ready" || room !== "Jornada" || !summary) return;
    const chapterIndex = Math.floor((summary.narrativeLevel - 1) / 10);
    const levelIndex = (summary.narrativeLevel - 1) % 10;
    const estimatedY = summary.narrativeLevel <= 3 ? 0 : 330 + chapterIndex * 760 + levelIndex * 64;
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, estimatedY - 120), animated: !reduceMotion }), reduceMotion ? 0 : 220);
    return () => clearTimeout(timer);
  }, [reduceMotion, room, status, summary]);

  const selected = getLevelDefinition(selectedLevel);

  return (
    <View style={styles.screen} testID="trophy-cave-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable accessibilityLabel="Voltar" style={styles.iconButton} onPress={() => router.back()}>
          <MaterialDesignIcons name="chevron-left" size={28} color={colors.onSurface} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>JORNADA URSOFIT</Text>
          <Text style={styles.headerTitle}>Caverna de Troféus</Text>
        </View>
        <Pressable accessibilityLabel="Abrir Meu Urso" style={styles.iconButton} onPress={() => router.push("/meu-urso" as never)}>
          <MaterialDesignIcons name="teddy-bear" size={23} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {status === "loading" ? <LoadingState /> : null}
      {status === "error" ? <ErrorState onRetry={load} /> : null}
      {status === "ready" && summary ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}>
          <JourneyHero summary={summary} compact={width < 560} />

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
              {!desktop ? <LevelDetail level={selected} summary={summary} /> : null}
              <JourneyMap summary={summary} selectedLevel={selectedLevel} onSelect={setSelectedLevel} />
              {desktop ? <LevelDetail level={selected} summary={summary} /> : null}
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
            <View style={styles.levelPath}>
              {levels.map((level, index) => (
                <LevelNode
                  key={level.id}
                  level={level}
                  currentLevel={summary.narrativeLevel}
                  selected={selectedLevel === level.number}
                  last={index === levels.length - 1}
                  onPress={() => onSelect(level.number)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function LevelNode({ level, currentLevel, selected, last, onPress }: { level: LevelDefinition; currentLevel: number; selected: boolean; last: boolean; onPress: () => void }) {
  const completed = level.number < currentLevel;
  const current = level.number === currentLevel;
  const locked = level.number > currentLevel;
  return (
    <View style={styles.levelRow}>
      <View style={styles.pathRail}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Nível ${level.number}, ${current ? "atual" : completed ? "concluído" : "bloqueado"}`}
          onPress={onPress}
          style={[
            styles.levelNode,
            completed && styles.levelNodeCompleted,
            current && styles.levelNodeCurrent,
            locked && styles.levelNodeLocked,
            selected && styles.levelNodeSelected,
          ]}
          testID={`level-node-${level.number}`}
        >
          {completed ? <MaterialDesignIcons name="check" size={18} color={colors.onBrandPrimary} /> : <Text style={[styles.levelNumber, locked && styles.levelNumberLocked]}>{level.number}</Text>}
        </Pressable>
        {!last ? <View style={[styles.connector, completed && styles.connectorCompleted]} /> : null}
      </View>
      <Pressable onPress={onPress} style={[styles.levelCopy, selected && styles.levelCopySelected]}>
        <View style={styles.levelTitleRow}>
          <Text style={[styles.levelTitle, locked && styles.lockedText]}>{locked && level.contentStatus !== "official" ? `Nível ${level.number}` : level.title}</Text>
          {level.special ? <MaterialDesignIcons name="star-four-points" size={14} color="#FFD166" /> : null}
        </View>
        <Text style={styles.levelMeta}>{current ? "Seu nível atual" : completed ? "Concluído" : `${level.minXp} XP para alcançar`}</Text>
      </Pressable>
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
  return (
    <View style={styles.hall}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Salão de Troféus</Text>
        <Text style={styles.sectionMeta}>{summary.unlockedCount} de {summary.totalAchievements} descobertos</Text>
      </View>
      <View style={styles.trophyGrid}>
        {achievements.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} unlockedAt={summary.state.unlockedAt[achievement.id] ?? null} />)}
      </View>
    </View>
  );
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
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  iconButton: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  headerTitle: { color: colors.onSurface, fontSize: 21, fontWeight: "900" },
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
  hero: { minHeight: 230, flexDirection: "row", overflow: "hidden", borderRadius: radius.lg, borderWidth: 1, borderColor: withAlpha(colors.brandPrimary, 0.38), backgroundColor: colors.surfaceSecondary },
  heroCompact: { flexDirection: "column", minHeight: 0 },
  heroCopy: { flex: 1.15, minWidth: 220, padding: spacing.xl, justifyContent: "center", zIndex: 1 },
  heroChapter: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  heroTitle: { color: colors.onSurface, fontSize: 28, lineHeight: 32, fontWeight: "900", marginTop: spacing.xs },
  heroSubtitle: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginTop: spacing.xs },
  progressTrack: { height: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, overflow: "hidden", marginTop: spacing.lg },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  heroStats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.sm },
  heroStat: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  heroMascot: { flex: 0, width: "42%", minWidth: 150, height: 250 },
  heroMascotCompact: { width: "100%", minWidth: 0, height: 230 },
  rooms: { gap: spacing.sm, paddingVertical: 1 },
  roomButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  roomButtonActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  roomLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800" },
  roomLabelActive: { color: colors.onBrandPrimary },
  journeyLayout: { gap: spacing.lg },
  journeyLayoutDesktop: { flexDirection: "row", alignItems: "flex-start" },
  mapColumn: { flex: 1, gap: spacing.md },
  chapterCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  chapterCardCurrent: { borderColor: withAlpha(colors.brandPrimary, 0.62) },
  chapterHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  medallion: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.borderStrong },
  medallionCompleted: { backgroundColor: "#FFD166", borderColor: "#FFD166" },
  medallionText: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "900" },
  medallionTextCompleted: { color: "#392A00" },
  chapterCopy: { flex: 1 },
  chapterEyebrow: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  chapterTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  chapterDescription: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
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
  trophyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  trophyCard: { flexGrow: 1, flexBasis: 280, minWidth: 260, maxWidth: 570, flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
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
