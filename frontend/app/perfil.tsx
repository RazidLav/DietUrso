import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AreaDashboardHeader } from "../src/components/AreaDashboard";
import { DashboardPanelHeader, type DashboardPeriod } from "../src/components/DashboardControls";
import { ResponsiveSheet } from "../src/components/DesignSystem";
import { FolderCard } from "../src/components/ProgressiveUI";
import { signOutFromCloud } from "../src/cloud/cloudSync";
import { ACHIEVEMENTS } from "../src/gamification/achievements";
import { evaluateGamification } from "../src/gamification/engine";
import { findCosmetic } from "../src/gamification/cosmetics";
import type { GamificationSummary } from "../src/gamification/types";
import { saveRemoteProfile } from "../src/profile/cloud";
import { removeProfilePhoto, resolveProfilePhotoUrl, uploadProfilePhoto } from "../src/profile/photo";
import { getProfileState, saveProfileState, safeFeaturedItems, setFeaturedItems, unlockEligibleCosmetics, validateUsername } from "../src/profile/store";
import type { ProfileContentArea, ProfileState, SocialVisibility } from "../src/profile/types";
import { useResponsiveLayout } from "../src/responsive";
import { getHydrationState } from "../src/store/hydrationStore";
import { listConsumption } from "../src/store/planStore";
import { getTrainingState } from "../src/store/trainingStore";
import { areaColors, breakpoints, colors, flatColors, layout, radius, spacing, withAlpha } from "../src/theme";
import { computeIntegratedStats, type IntegratedStats } from "../src/utils/integratedStats";
import { getAccessProfile } from "../src/admin/service";
import type { AccessRole } from "../src/admin/types";

type LoadState = "loading" | "success" | "error";
const VISIBILITY: { id: SocialVisibility; label: string }[] = [{ id: "private", label: "Privado" }, { id: "friends", label: "Amigos" }, { id: "public", label: "Público" }];
const CONTENT_AREAS: { id: ProfileContentArea; label: string }[] = [{ id: "workouts", label: "Treinos" }, { id: "nutrition", label: "Alimentação" }, { id: "hydration", label: "Hidratação" }, { id: "achievements", label: "Conquistas" }, { id: "evolution", label: "Evolução" }, { id: "photos", label: "Fotos" }, { id: "rugidos", label: "Rugidos" }, { id: "challenges", label: "Desafios" }];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const responsive = useResponsiveLayout();
  const desktop = responsive.width >= breakpoints.tablet;
  const [state, setState] = useState<ProfileState | null>(null);
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [activityStats, setActivityStats] = useState<IntegratedStats | null>(null);
  const [activityPeriod, setActivityPeriod] = useState<DashboardPeriod>("month");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [moreAreasOpen, setMoreAreasOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accessRole, setAccessRole] = useState<AccessRole>("user");

  const load = useCallback(async () => {
    setLoadState((current) => current === "success" ? current : "loading"); setNotice(null);
    try {
      const statsPromise = Promise.all([listConsumption(), getTrainingState(), getHydrationState()])
        .then(([consumption, training, hydration]) => computeIntegratedStats(consumption, training, hydration, activityPeriod))
        .catch(() => null);
      const accessPromise = getAccessProfile().catch(() => ({ role: "user" as const }));
      let [profile, game, integrated, access] = await Promise.all([getProfileState(), evaluateGamification(), statsPromise, accessPromise]);
      if (profile.profile.photoPath) {
        const refreshedUrl = await resolveProfilePhotoUrl(profile.profile.photoPath).catch(() => null);
        if (refreshedUrl) profile = { ...profile, profile: { ...profile.profile, photoUrl: refreshedUrl } };
      }
      const unlocked = unlockEligibleCosmetics(profile, game);
      if (Object.keys(unlocked.unlockedCosmetics).length !== Object.keys(profile.unlockedCosmetics).length) await saveProfileState(unlocked);
      setState(unlocked); setSummary(game); setActivityStats(integrated); setAccessRole(access.role); setLoadState("success");
    } catch (error) { setLoadState("error"); setNotice(error instanceof Error ? error.message : "Não foi possível carregar o perfil."); }
  }, [activityPeriod]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const recent = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.state.unlockedAt).sort((a, b) => b[1].localeCompare(a[1])).slice(0, 4).map(([id, date]) => ({ achievement: ACHIEVEMENTS.find((item) => item.id === id), date })).filter((item) => item.achievement);
  }, [summary]);
  const featured = state && summary ? safeFeaturedItems(state, Object.keys(summary.state.unlockedAt)) : [];

  const patchProfile = (patch: Partial<ProfileState["profile"]>) => setState((current) => current ? ({ ...current, profile: { ...current.profile, ...patch } }) : current);
  const persist = async () => {
    if (!state) return;
    const username = state.profile.username ? validateUsername(state.profile.username) : null;
    if (username && !username.valid) { setNotice(username.message); return; }
    setBusy(true); setNotice(null);
    try {
      const next = { ...state, profile: { ...state.profile, username: username?.normalized || null } };
      await saveRemoteProfile(next.profile);
      const saved = await saveProfileState(next);
      setState(saved); setEditing(false); setNotice("Perfil atualizado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  };

  const choosePhoto = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") { setNotice("O envio de foto está disponível na versão web por enquanto."); return; }
    const input = document.createElement("input"); input.type = "file"; input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file || !state) return;
      setBusy(true); setNotice(null);
      try {
        const uploaded = await uploadProfilePhoto(file, state.profile.photoPath);
        const next = { ...state, profile: { ...state.profile, photoPath: uploaded.path, photoUrl: uploaded.signedUrl, avatarMode: "photo" as const } };
        await saveRemoteProfile(next.profile); setState(await saveProfileState(next)); setNotice("Foto atualizada com segurança.");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Falha no envio da foto."); }
      finally { setBusy(false); }
    };
    input.click();
  };

  const removePhoto = async () => {
    if (!state) return; setBusy(true);
    try { await removeProfilePhoto(state.profile.photoPath); const next = { ...state, profile: { ...state.profile, photoPath: null, photoUrl: null, avatarMode: "bear" as const } }; await saveRemoteProfile(next.profile); setState(await saveProfileState(next)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível remover a foto."); }
    finally { setBusy(false); }
  };

  const persistFeatured = async (items: ProfileState["featured"]) => {
    if (!state || !summary) return;
    try {
      const next = setFeaturedItems(state, items, Object.keys(summary.state.unlockedAt));
      setState(await saveProfileState(next));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível alterar os destaques.");
    }
  };

  const moveFeatured = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= featured.length) return;
    const next = [...featured];
    [next[index], next[destination]] = [next[destination], next[index]];
    void persistFeatured(next);
  };

  const editProfile = () => {
    setProfileMenuOpen(false);
    setEditing(true);
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true); setNotice(null);
    try {
      await signOutFromCloud();
      setProfileMenuOpen(false);
      router.replace("/conta?mode=signin" as never);
    } catch (error) {
      setProfileMenuOpen(false);
      setNotice(error instanceof Error ? error.message : "Não foi possível sair da conta.");
    } finally {
      setSigningOut(false);
    }
  };

  if (loadState === "loading") return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.muted}>Preparando sua toca…</Text></View>;
  if (loadState === "error" || !state || !summary) return <View style={styles.center}><MaterialDesignIcons name="cloud-alert-outline" size={36} color={colors.error} /><Text style={styles.title}>Seu perfil não carregou</Text><Text style={styles.muted}>{notice}</Text><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryText}>Tentar novamente</Text></Pressable></View>;

  const equippedTitle = findCosmetic(state.equipped.title)?.name;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }]} testID="profile-screen">
    <AreaDashboardHeader
      title="Perfil UrsoFit"
      subtitle="Sua toca, seu progresso e suas preferências."
      accent={areaColors.profile}
      onBack={() => router.back()}
      onSettings={() => setProfileMenuOpen(true)}
      settingsLabel="Abrir menu do perfil"
      settingsIcon="menu"
      settingsTestID="profile-menu-button"
      actions={[]}
    />

    <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => !signingOut && setProfileMenuOpen(false)}>
      <View style={styles.menuLayer} testID="profile-menu">
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Fechar menu do perfil" onPress={() => !signingOut && setProfileMenuOpen(false)} />
        <View style={[styles.profileMenu, { top: insets.top + 68, right: desktop ? Math.max(spacing.lg, (responsive.width - layout.contentMax) / 2 + spacing.lg) : spacing.lg }]}>
          <Pressable accessibilityRole="menuitem" style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={editProfile} testID="profile-menu-edit">
            <View style={styles.menuIcon}><MaterialDesignIcons name="pencil-outline" size={19} color={colors.brandPrimary} /></View>
            <Text style={styles.menuText}>Editar perfil</Text>
          </Pressable>
          {accessRole === "admin" ? <>
            <View style={styles.menuDivider} />
            <Pressable accessibilityRole="menuitem" style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => { setProfileMenuOpen(false); router.push("/admin" as never); }} testID="profile-menu-admin">
              <View style={styles.menuIcon}><MaterialDesignIcons name="shield-crown-outline" size={19} color={colors.brandPrimary} /></View>
              <Text style={styles.menuText}>Painel administrativo</Text>
            </Pressable>
          </> : null}
          <View style={styles.menuDivider} />
          <Pressable accessibilityRole="menuitem" disabled={signingOut} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed, signingOut && styles.disabled]} onPress={() => void signOut()} testID="profile-menu-logout">
            <View style={[styles.menuIcon, styles.logoutIcon]}>{signingOut ? <ActivityIndicator size="small" color={colors.error} /> : <MaterialDesignIcons name="logout" size={19} color={colors.error} />}</View>
            <Text style={styles.logoutText}>{signingOut ? "Saindo…" : "Fazer logout"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
    {!desktop ? <View style={styles.areaShelf} testID="profile-area-shelf">
      <ProfileAreaTile icon="trophy-outline" label="Conquistas" onPress={() => router.push("/conquistas")} />
      <ProfileAreaTile icon="teddy-bear" label="Meu Urso" onPress={() => router.push("/meu-urso")} />
      <ProfileAreaTile icon="chart-line" label="Evolução" onPress={() => router.push("/evolucao")} />
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir mais áreas" onPress={() => setMoreAreasOpen(true)} style={styles.moreAreaTile} testID="profile-more-areas">
        <View style={styles.stackBackTwo} /><View style={styles.stackBackOne} />
        <View style={styles.stackFront}><MaterialDesignIcons name="plus" size={22} color={colors.onBrandPrimary} /></View>
        <Text style={styles.areaLabel}>Mais</Text>
      </Pressable>
    </View> : null}
    <ResponsiveSheet visible={moreAreasOpen} title="Mais espaços da sua toca" description="Recursos sociais e metas ficam guardados aqui para manter o perfil limpo." onClose={() => setMoreAreasOpen(false)}>
      <FolderCard icon="chart-box-outline" title="Estatísticas" description="Indicadores reais por período" onPress={() => { setMoreAreasOpen(false); router.push("/estatisticas"); }} />
      <FolderCard icon="clipboard-account-outline" title="Minhas preferências" description="Anamnese privada e editável" onPress={() => { setMoreAreasOpen(false); router.push("/anamnese" as never); }} />
      <FolderCard icon="account-group-outline" title="Social" description="Pessoas, perfil social e descobertas" onPress={() => { setMoreAreasOpen(false); router.push("/comunidade"); }} />
      <FolderCard icon="bullhorn-outline" title="Rugidos" description="Suas publicações e interações" onPress={() => { setMoreAreasOpen(false); router.push("/rugidos"); }} />
      <FolderCard icon="flag-checkered" title="Desafios" description="Metas coletivas e pessoais" onPress={() => { setMoreAreasOpen(false); router.push("/desafios"); }} />
    </ResponsiveSheet>
    {desktop ? <DesktopProfileDashboard
      profile={state.profile}
      summary={summary}
      stats={activityStats}
      period={activityPeriod}
      onPeriodChange={setActivityPeriod}
      equippedTitle={equippedTitle}
      onOpenStats={() => router.push("/estatisticas")}
      onOpenJourney={() => router.push("/conquistas")}
      onOpenBear={() => router.push("/meu-urso")}
      areas={[
        { id: "achievements", icon: "trophy-outline", label: "Conquistas", hint: `${summary.unlockedCount}/${summary.totalAchievements}`, color: flatColors.lime, onPress: () => router.push("/conquistas") },
        { id: "bear", icon: "teddy-bear", label: "Meu Urso", hint: "Coleção", color: flatColors.orange, onPress: () => router.push("/meu-urso") },
        { id: "evolution", icon: "chart-line", label: "Evolução", hint: "Registros físicos", color: flatColors.aqua, onPress: () => router.push("/evolucao") },
        { id: "stats", icon: "chart-box-outline", label: "Estatísticas", hint: "Visão integrada", color: flatColors.lavender, onPress: () => router.push("/estatisticas") },
        { id: "preferences", icon: "clipboard-account-outline", label: "Preferências", hint: "Anamnese", color: flatColors.amber, onPress: () => router.push("/anamnese" as never) },
        { id: "community", icon: "account-group-outline", label: "Social", hint: "Pessoas e perfil", color: flatColors.rose, onPress: () => router.push("/comunidade") },
        { id: "rugidos", icon: "bullhorn-outline", label: "Rugidos", hint: "Publicações", color: flatColors.orangeSoft, onPress: () => router.push("/rugidos") },
        { id: "challenges", icon: "flag-checkered", label: "Desafios", hint: "Metas", color: flatColors.lime, onPress: () => router.push("/desafios") },
      ]}
    /> : <View style={styles.showcase}>
        <View style={styles.banner}><View style={styles.bannerGlow} /></View>
        <View style={styles.avatarWrap}>{state.profile.avatarMode === "photo" && state.profile.photoUrl ? <Image source={{ uri: state.profile.photoUrl }} style={styles.avatar} accessibilityLabel="Foto do perfil" /> : <Image source={require("../assets/images/mascot-whey.jpg")} style={styles.avatar} accessibilityLabel="Avatar Urso da Toca" />}</View>
        <View style={styles.identity}><Text style={styles.name}>{state.profile.displayName}</Text><Text style={styles.username}>{state.profile.username ? `@${state.profile.username}` : "Username ainda não definido"}</Text>{equippedTitle ? <View style={styles.titlePill}><MaterialDesignIcons name="star-four-points" size={13} color="#F6C85F" /><Text style={styles.titlePillText}>{equippedTitle}</Text></View> : null}<Text style={styles.bio}>{state.profile.bio || "Conte um pouquinho sobre sua jornada."}</Text><Text style={styles.privateLabel}><MaterialDesignIcons name="lock-outline" size={13} color={colors.onSurfaceTertiary} /> Perfil privado por padrão</Text></View>
        <View style={styles.levelBlock}><View style={styles.levelTop}><Text style={styles.levelTitle}>Nível {summary.level} · {summary.chapterTitle}</Text><Text style={styles.levelXp}>{summary.state.totalXp} XP</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${summary.progress * 100}%` }]} /></View>{summary.legacyLevel > 100 ? <Text style={styles.legacy}>Legado preservado: nível {summary.legacyLevel}</Text> : null}</View>
        <View style={styles.stats}><Stat icon="fire" value={summary.context.currentStreak} label="sequência" /><Stat icon="calendar-check-outline" value={summary.context.bestStreak} label="recorde" /><Stat icon="trophy-outline" value={summary.unlockedCount} label="conquistas" /></View>
        <View style={styles.actions}><Pressable style={styles.primaryButton} onPress={() => router.push("/meu-urso")}><MaterialDesignIcons name="teddy-bear" size={18} color={colors.onBrandPrimary} /><Text style={styles.primaryText}>Meu Urso</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push("/conquistas")}><Text style={styles.secondaryText}>Ver jornada</Text></Pressable></View>
      </View>}

      <View style={[styles.sideColumn, desktop && styles.sideColumnDesktop]}>
        {editing ? <View style={[styles.card, desktop && styles.cardDesktop]} testID="profile-editor"><Text style={styles.cardTitle}>Editar vitrine</Text><Field label="Nome de exibição"><TextInput style={styles.input} value={state.profile.displayName} maxLength={50} onChangeText={(displayName) => patchProfile({ displayName })} placeholderTextColor={colors.muted} /></Field><Field label="Username"><TextInput style={styles.input} value={state.profile.username ?? ""} maxLength={24} autoCapitalize="none" onChangeText={(username) => patchProfile({ username })} placeholder="seu_username" placeholderTextColor={colors.muted} /></Field><Field label="Bio"><TextInput style={[styles.input, styles.bioInput]} multiline value={state.profile.bio} maxLength={160} onChangeText={(bio) => patchProfile({ bio })} placeholderTextColor={colors.muted} /></Field><Toggle label="Mostrar progresso numa futura vitrine pública" value={state.profile.showProgressStats} onValueChange={(showProgressStats) => patchProfile({ showProgressStats })} /><Toggle label="Mostrar sequências numa futura vitrine pública" value={state.profile.showStreakStats} onValueChange={(showStreakStats) => patchProfile({ showStreakStats })} /><View style={styles.photoActions}><Pressable style={styles.secondaryButton} onPress={choosePhoto}><Text style={styles.secondaryText}>Escolher foto</Text></Pressable>{state.profile.photoPath ? <Pressable style={styles.secondaryButton} onPress={() => void removePhoto()}><Text style={styles.dangerText}>Remover foto</Text></Pressable> : null}</View><Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void persist()}>{busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Salvar perfil</Text>}</Pressable></View> : null}

        {editing ? <View style={[styles.card, desktop && styles.cardDesktop]} testID="profile-privacy-editor"><Text style={styles.cardTitle}>Privacidade social</Text><Text style={styles.muted}>Tudo começa privado. Escolha quem pode ver cada parte.</Text><Text style={styles.label}>PERFIL</Text><View style={styles.achievementChoices}>{VISIBILITY.map((option) => <Pressable key={option.id} style={[styles.choice, state.profile.profileVisibility === option.id && styles.choiceActive]} onPress={() => patchProfile({ profileVisibility: option.id })}><Text style={[styles.choiceText, state.profile.profileVisibility === option.id && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View>{CONTENT_AREAS.map((area) => <View key={area.id} style={styles.toggle}><Text style={styles.toggleText}>{area.label}</Text><View style={styles.achievementChoices}>{VISIBILITY.map((option) => <Pressable accessibilityLabel={`${area.label}: ${option.label}`} key={option.id} style={[styles.choice, state.profile.contentVisibility[area.id] === option.id && styles.choiceActive]} onPress={() => patchProfile({ contentVisibility: { ...state.profile.contentVisibility, [area.id]: option.id } })}><Text style={[styles.choiceText, state.profile.contentVisibility[area.id] === option.id && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View></View>)}</View> : null}

        <View style={[styles.card, desktop && styles.cardDesktop]}>
          <View style={styles.cardHeading}><Text style={styles.cardTitle}>Destaques</Text><Text style={styles.counter}>{featured.length}/3</Text></View>
          {featured.length ? featured.map((item, index) => (
            <View key={`${item.type}:${item.id}`} style={styles.featured}>
              <Text style={styles.featuredIndex}>{index + 1}</Text>
              <Text style={styles.featuredText}>{ACHIEVEMENTS.find((achievement) => achievement.id === item.id)?.title ?? "Item indisponível"}</Text>
              <Pressable accessibilityLabel={`Mover destaque ${index + 1} para cima`} disabled={index === 0} onPress={() => moveFeatured(index, -1)} style={[styles.reorderButton, index === 0 && styles.disabled]}><MaterialDesignIcons name="chevron-up" size={18} color={colors.onSurfaceSecondary} /></Pressable>
              <Pressable accessibilityLabel={`Mover destaque ${index + 1} para baixo`} disabled={index === featured.length - 1} onPress={() => moveFeatured(index, 1)} style={[styles.reorderButton, index === featured.length - 1 && styles.disabled]}><MaterialDesignIcons name="chevron-down" size={18} color={colors.onSurfaceSecondary} /></Pressable>
            </View>
          )) : <Text style={styles.muted}>Escolha até três conquistas desbloqueadas.</Text>}
          <View style={styles.achievementChoices}>{ACHIEVEMENTS.filter((item) => summary.state.unlockedAt[item.id]).slice(0, 8).map((item) => { const selected = featured.some((entry) => entry.id === item.id); return <Pressable key={item.id} style={[styles.choice, selected && styles.choiceActive]} onPress={() => void persistFeatured(selected ? featured.filter((entry) => entry.id !== item.id) : [...featured, { id: item.id, type: "achievement" as const }])}><Text style={[styles.choiceText, selected && styles.choiceTextActive]} numberOfLines={1}>{item.title}</Text></Pressable>; })}</View>
        </View>

        <View style={[styles.card, desktop && styles.cardDesktop]}><Text style={styles.cardTitle}>Conquistas recentes</Text>{recent.length ? recent.map(({ achievement, date }) => <View key={achievement!.id} style={styles.recent}><View style={styles.recentIcon}><MaterialDesignIcons name={achievement!.icon as never} size={18} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.recentTitle}>{achievement!.title}</Text><Text style={styles.muted}>{new Date(date).toLocaleDateString("pt-BR")}</Text></View></View>) : <Text style={styles.muted}>Sua primeira conquista vai aparecer aqui.</Text>}</View>
      </View>
  </ScrollView>;
}

type DesktopArea = { id: string; icon: string; label: string; hint: string; color: string; onPress: () => void };
const WEEK_DAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

function DesktopProfileDashboard({
  profile,
  summary,
  stats,
  period,
  onPeriodChange,
  equippedTitle,
  areas,
  onOpenStats,
  onOpenJourney,
  onOpenBear,
}: {
  profile: ProfileState["profile"];
  summary: GamificationSummary;
  stats: IntegratedStats | null;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  equippedTitle?: string;
  areas: DesktopArea[];
  onOpenStats: () => void;
  onOpenJourney: () => void;
  onOpenBear: () => void;
}) {
  const calendar = stats?.calendar ?? [];
  const visibleCalendar = calendar.slice(-31);
  const activeDays = calendar.filter((day) => day.status === "complete" || day.status === "partial").length;
  const leadingDays = visibleCalendar.length ? (new Date(`${visibleCalendar[0].date}T12:00:00`).getDay() + 6) % 7 : 0;
  const monthLabel = visibleCalendar.length
    ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${visibleCalendar[visibleCalendar.length - 1].date}T12:00:00`))
    : "Este mês";
  const avatar = profile.avatarMode === "photo" && profile.photoUrl
    ? { uri: profile.photoUrl }
    : require("../assets/images/mascot-whey.jpg");

  return <View style={styles.desktopDashboard} testID="profile-desktop-dashboard">
    <View style={styles.desktopWelcome}>
      <View style={styles.desktopWelcomeIdentity}>
        <Image source={avatar} style={styles.desktopMiniAvatar} accessibilityLabel="Avatar do perfil" />
        <View><Text style={styles.desktopHello}>Olá, {profile.displayName}!</Text><Text style={styles.desktopWelcomeText}>Seu progresso e seus espaços, no mesmo painel.</Text></View>
      </View>
      <View style={styles.desktopPrivatePill}><MaterialDesignIcons name="lock-outline" size={15} color={colors.onSurfaceSecondary} /><Text style={styles.desktopPrivateText}>Perfil privado</Text></View>
    </View>

    <View style={styles.desktopTopGrid}>
      <View style={styles.desktopActivityCard}>
        <DashboardPanelHeader title="Atividade física" hint="Treinos, duração e dias ativos" period={period} onPeriodChange={onPeriodChange} onOptions={onOpenStats} />
        <View style={styles.desktopActivityGraph} accessibilityLabel={`${activeDays} dias com registros`}>
          {visibleCalendar.map((day) => <View key={day.date} style={styles.desktopGraphSlot}><View style={[styles.desktopGraphBar, day.status === "complete" && styles.desktopGraphComplete, day.status === "partial" && styles.desktopGraphPartial, { height: day.status === "complete" ? 48 : day.status === "partial" ? 30 : day.status === "future" ? 5 : 10 }]} /></View>)}
        </View>
        <View style={styles.desktopMetricRow}>
          <DesktopMetric label="Dias ativos" value={String(activeDays)} hint="com algum registro" />
          <DesktopMetric label="Treinos" value={String(stats?.workouts ?? 0)} hint={`${stats?.modalities ?? 0} modalidades`} />
          <DesktopMetric label="Tempo ativo" value={formatMinutes(stats?.trainingMinutes ?? 0)} hint="sessões registradas" />
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Abrir calendário de atividade" onPress={onOpenStats} style={({ pressed }) => [styles.desktopCalendarCard, pressed && styles.desktopPressed]}>
        <View style={styles.desktopCalendarHead}><View><Text style={styles.desktopCalendarTitle}>Seus dias ativos</Text><Text style={styles.desktopCalendarMonth}>{monthLabel}</Text></View><MaterialDesignIcons name="calendar-month-outline" size={22} color={colors.onBrandSecondary} /></View>
        <View style={styles.desktopWeekHead}>{WEEK_DAYS.map((day) => <Text key={day} style={styles.desktopWeekDay}>{day}</Text>)}</View>
        <View style={styles.desktopCalendarGrid}>
          {Array.from({ length: leadingDays }).map((_, index) => <View key={`empty-${index}`} style={styles.desktopCalendarDay} />)}
          {visibleCalendar.map((day) => <View key={day.date} style={[styles.desktopCalendarDay, day.status === "complete" && styles.desktopCalendarDayComplete, day.status === "partial" && styles.desktopCalendarDayPartial, day.status === "future" && styles.desktopCalendarDayFuture]}><Text style={[styles.desktopCalendarDayText, day.status === "complete" && styles.desktopCalendarDayTextOn]}>{Number(day.date.slice(-2))}</Text></View>)}
        </View>
      </Pressable>
    </View>

    <View style={styles.desktopInsightRow}>
      <DesktopInsight icon="silverware-fork-knife" label="Refeições registradas" value={String(stats?.meals ?? 0)} color={flatColors.orange} />
      <DesktopInsight icon="water-outline" label="Média de hidratação" value={stats?.averageWaterMl == null ? "Sem dados" : `${Math.round(stats.averageWaterMl)} ml`} color={flatColors.lavender} />
      <DesktopInsight icon="fire" label="Sequência atual" value={`${summary.context.currentStreak} dia${summary.context.currentStreak === 1 ? "" : "s"}`} color={flatColors.lime} />
    </View>

    <View style={styles.desktopBottomGrid}>
      <View style={styles.desktopIdentityCard}>
        <View style={styles.desktopIdentityTop}><Image source={avatar} style={styles.desktopAvatar} accessibilityLabel="Avatar Urso da Toca" /><View style={styles.desktopIdentityCopy}><Text style={styles.desktopName}>{profile.displayName}</Text><Text style={styles.desktopUsername}>{profile.username ? `@${profile.username}` : "Username ainda não definido"}</Text>{equippedTitle ? <Text style={styles.desktopEquipped}>{equippedTitle}</Text> : null}</View></View>
        <Text style={styles.desktopBio}>{profile.bio || "Conte um pouquinho sobre sua jornada."}</Text>
        <View style={styles.desktopLevelHead}><Text style={styles.desktopLevelTitle}>Nível {summary.level} · {summary.chapterTitle}</Text><Text style={styles.desktopLevelXp}>{summary.state.totalXp} XP</Text></View>
        <View style={styles.desktopTrack}><View style={[styles.desktopFill, { width: `${summary.progress * 100}%` }]} /></View>
        <View style={styles.desktopIdentityStats}><DesktopIdentityStat value={summary.context.bestStreak} label="recorde" /><DesktopIdentityStat value={summary.unlockedCount} label="conquistas" /><DesktopIdentityStat value={summary.level} label="nível" /></View>
        <View style={styles.desktopIdentityActions}><Pressable style={styles.primaryButton} onPress={onOpenBear}><MaterialDesignIcons name="teddy-bear" size={17} color={colors.onBrandPrimary} /><Text style={styles.primaryText}>Meu Urso</Text></Pressable><Pressable style={styles.secondaryButton} onPress={onOpenJourney}><Text style={styles.secondaryText}>Ver jornada</Text></Pressable></View>
      </View>

      <View style={styles.desktopAreasCard}>
        <View style={styles.desktopAreasHeader}><View><Text style={styles.desktopCardTitle}>Minha toca</Text><Text style={styles.desktopCardHint}>Todas as funções do seu perfil</Text></View><Text style={styles.desktopAreaCount}>{areas.length} espaços</Text></View>
        <View style={styles.desktopAreasGrid}>{areas.map((area) => <Pressable key={area.id} accessibilityRole="button" accessibilityLabel={area.label} onPress={area.onPress} style={({ pressed }) => [styles.desktopAreaCard, { backgroundColor: withAlpha(area.color, 0.16) }, pressed && styles.desktopPressed]}><View style={styles.desktopAreaTop}><View style={[styles.desktopAreaIcon, { backgroundColor: area.color }]}><MaterialDesignIcons name={area.icon as never} size={20} color="#101114" /></View><MaterialDesignIcons name="arrow-top-right" size={16} color={colors.onSurfaceTertiary} /></View><View><Text style={styles.desktopAreaLabel}>{area.label}</Text><Text style={styles.desktopAreaHint}>{area.hint}</Text></View></Pressable>)}</View>
      </View>
    </View>
  </View>;
}

function DesktopMetric({ label, value, hint }: { label: string; value: string; hint: string }) { return <View style={styles.desktopMetric}><Text style={styles.desktopMetricLabel}>{label}</Text><Text style={styles.desktopMetricValue}>{value}</Text><Text style={styles.desktopMetricHint}>{hint}</Text></View>; }
function DesktopInsight({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) { return <View style={[styles.desktopInsight, { backgroundColor: withAlpha(color, 0.12) }]}><View style={[styles.desktopInsightIcon, { backgroundColor: withAlpha(color, 0.22) }]}><MaterialDesignIcons name={icon as never} size={19} color={color} /></View><View><Text style={styles.desktopInsightLabel}>{label}</Text><Text style={styles.desktopInsightValue}>{value}</Text></View></View>; }
function DesktopIdentityStat({ value, label }: { value: number; label: string }) { return <View style={styles.desktopIdentityStat}><Text style={styles.desktopIdentityStatValue}>{value}</Text><Text style={styles.desktopIdentityStatLabel}>{label}</Text></View>; }
function formatMinutes(minutes: number) { if (minutes < 60) return `${minutes} min`; const hours = Math.floor(minutes / 60); const rest = minutes % 60; return `${hours}h${rest ? ` ${rest}min` : ""}`; }

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) { return <View style={styles.stat}><MaterialDesignIcons name={icon as never} size={18} color={colors.brandPrimary} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function ProfileAreaTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.areaTile, pressed && styles.areaTilePressed]}><View style={styles.areaIcon}><MaterialDesignIcons name={icon as never} size={20} color={colors.brandPrimary} /></View><Text numberOfLines={2} style={styles.areaLabel}>{label}</Text></Pressable>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.toggle}><Text style={styles.toggleText}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: layout.contentMax, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg }, center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }, menuLayer: { flex: 1, backgroundColor: withAlpha("#000000", 0.28) }, profileMenu: { position: "absolute", width: 220, padding: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary, shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 12 }, menuItem: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm }, menuItemPressed: { backgroundColor: colors.surfaceTertiary }, menuIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: withAlpha(colors.brandPrimary, 0.1) }, logoutIcon: { backgroundColor: withAlpha(colors.error, 0.1) }, menuText: { flex: 1, color: colors.onSurface, fontSize: 12, fontWeight: "800" }, logoutText: { flex: 1, color: colors.error, fontSize: 12, fontWeight: "800" }, menuDivider: { height: 1, marginHorizontal: spacing.sm, backgroundColor: colors.borderSubtle }, areaShelf: { flexDirection: "row", gap: spacing.sm }, areaTile: { flex: 1, minWidth: 0, minHeight: 82, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, areaTilePressed: { opacity: 0.72 }, areaIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.brandPrimary, 0.1) }, areaLabel: { color: colors.onSurfaceSecondary, fontSize: 9, lineHeight: 12, fontWeight: "850" as never, textAlign: "center" }, moreAreaTile: { flex: 1, minWidth: 0, minHeight: 82, alignItems: "center", justifyContent: "center", gap: spacing.xs, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, stackBackTwo: { position: "absolute", top: 15, width: 30, height: 25, borderRadius: radius.sm, transform: [{ rotate: "8deg" }], backgroundColor: withAlpha(colors.brandPrimary, 0.18) }, stackBackOne: { position: "absolute", top: 13, width: 30, height: 27, borderRadius: radius.sm, transform: [{ rotate: "-6deg" }], backgroundColor: withAlpha(colors.brandPrimary, 0.34) }, stackFront: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary }, showcase: { overflow: "hidden", borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, banner: { height: 112, backgroundColor: withAlpha(colors.brandPrimary, 0.16), overflow: "hidden" }, bannerGlow: { width: 240, height: 240, borderRadius: 120, alignSelf: "flex-end", marginTop: -90, marginRight: -40, backgroundColor: withAlpha("#F6C85F", 0.22) }, avatarWrap: { width: 96, height: 96, marginTop: -48, marginLeft: spacing.xl, padding: 5, borderRadius: 32, backgroundColor: colors.surfaceSecondary, borderWidth: 3, borderColor: colors.brandPrimary }, avatar: { width: "100%", height: "100%", borderRadius: 26 }, identity: { padding: spacing.lg, paddingTop: spacing.md, gap: spacing.xs }, name: { color: colors.onSurface, fontSize: 23, fontWeight: "900" }, username: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" }, titlePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: withAlpha("#F6C85F", 0.14) }, titlePillText: { color: colors.onSurface, fontSize: 10, fontWeight: "800" }, bio: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18, marginTop: spacing.xs }, privateLabel: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: spacing.xs }, levelBlock: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, gap: spacing.sm }, levelTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, levelTitle: { flex: 1, color: colors.onSurface, fontSize: 12, fontWeight: "900" }, levelXp: { color: colors.onSurfaceTertiary, fontSize: 10 }, track: { height: 8, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surface }, fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, legacy: { color: colors.brandTertiary, fontSize: 9, fontWeight: "800" }, stats: { flexDirection: "row", margin: spacing.lg, borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: spacing.md }, stat: { flex: 1, alignItems: "center", gap: 2 }, statValue: { color: colors.onSurface, fontSize: 19, fontWeight: "900" }, statLabel: { color: colors.onSurfaceTertiary, fontSize: 9 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.lg, paddingTop: 0 }, sideColumn: { gap: spacing.md }, sideColumnDesktop: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }, card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }, cardDesktop: { flexBasis: "48%", flexGrow: 1 }, cardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900" }, counter: { color: colors.brandPrimary, fontSize: 11, fontWeight: "900" }, field: { gap: 6 }, label: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800" }, input: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, outlineStyle: "none" } as never, bioInput: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: "top" }, toggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md }, toggleText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 16 }, primaryButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, primaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" }, secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary }, secondaryText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, dangerText: { color: colors.error, fontSize: 11, fontWeight: "800" }, photoActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, featured: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, reorderButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary }, featuredIndex: { width: 28, height: 28, textAlign: "center", lineHeight: 28, borderRadius: radius.pill, overflow: "hidden", color: colors.onBrandPrimary, backgroundColor: colors.brandPrimary, fontWeight: "900" }, featuredText: { flex: 1, color: colors.onSurface, fontSize: 11, fontWeight: "800" }, achievementChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, choice: { maxWidth: "100%", paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary }, choiceActive: { borderColor: colors.brandPrimary, backgroundColor: withAlpha(colors.brandPrimary, 0.12) }, choiceText: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "700" }, choiceTextActive: { color: colors.brandPrimary }, recent: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, recentIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: withAlpha(colors.brandPrimary, 0.12) }, recentTitle: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, muted: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, textAlign: "center" }, title: { color: colors.onSurface, fontSize: 18, fontWeight: "900", textAlign: "center" }, notice: { padding: spacing.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.brandTertiary, 0.12), borderWidth: 1, borderColor: withAlpha(colors.brandTertiary, 0.35) }, noticeText: { color: colors.onSurfaceSecondary, fontSize: 11 },
  desktopDashboard: { gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.surfaceSecondary },
  desktopWelcome: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, paddingHorizontal: spacing.xs },
  desktopWelcomeIdentity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  desktopMiniAvatar: { width: 40, height: 40, borderRadius: radius.pill },
  desktopHello: { color: colors.onSurface, fontSize: 13, fontWeight: "900" },
  desktopWelcomeText: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 },
  desktopPrivatePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  desktopPrivateText: { color: colors.onSurfaceSecondary, fontSize: 9, fontWeight: "800" },
  desktopTopGrid: { flexDirection: "row", alignItems: "stretch", gap: spacing.md },
  desktopActivityCard: { flex: 1.72, minHeight: 252, justifyContent: "space-between", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary },
  desktopPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
  desktopCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  desktopCardTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  desktopCardHint: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 3 },
  desktopLinkPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive },
  desktopLinkText: { color: colors.onSurface, fontSize: 9, fontWeight: "800" },
  desktopActivityGraph: { height: 60, flexDirection: "row", alignItems: "flex-end", gap: 3, paddingHorizontal: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  desktopGraphSlot: { flex: 1, height: 58, justifyContent: "flex-end" },
  desktopGraphBar: { width: "100%", minWidth: 3, borderTopLeftRadius: radius.xs, borderTopRightRadius: radius.xs, backgroundColor: colors.borderStrong },
  desktopGraphComplete: { backgroundColor: colors.brandPrimary },
  desktopGraphPartial: { backgroundColor: colors.brandSecondary },
  desktopMetricRow: { flexDirection: "row", gap: spacing.sm },
  desktopMetric: { flex: 1, minWidth: 0, gap: 2 },
  desktopMetricLabel: { color: colors.onSurfaceTertiary, fontSize: 9 },
  desktopMetricValue: { color: colors.onSurface, fontSize: 23, lineHeight: 27, fontWeight: "900" },
  desktopMetricHint: { color: colors.onSurfaceTertiary, fontSize: 8 },
  desktopCalendarCard: { width: 310, minHeight: 252, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandSecondary },
  desktopCalendarHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  desktopCalendarTitle: { color: colors.onBrandSecondary, fontSize: 14, fontWeight: "900" },
  desktopCalendarMonth: { color: withAlpha(colors.onBrandSecondary, 0.7), fontSize: 9, marginTop: 3, textTransform: "capitalize" },
  desktopWeekHead: { flexDirection: "row", marginBottom: spacing.xs },
  desktopWeekDay: { width: "14.285%", color: withAlpha(colors.onBrandSecondary, 0.65), fontSize: 7, fontWeight: "900", textAlign: "center" },
  desktopCalendarGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 5 },
  desktopCalendarDay: { width: "14.285%", height: 25, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  desktopCalendarDayComplete: { backgroundColor: colors.onBrandSecondary },
  desktopCalendarDayPartial: { borderWidth: 1, borderColor: withAlpha(colors.onBrandSecondary, 0.75), backgroundColor: withAlpha(colors.onBrandSecondary, 0.14) },
  desktopCalendarDayFuture: { opacity: 0.35 },
  desktopCalendarDayText: { color: withAlpha(colors.onBrandSecondary, 0.78), fontSize: 8, fontWeight: "800" },
  desktopCalendarDayTextOn: { color: colors.brandSecondary },
  desktopInsightRow: { flexDirection: "row", gap: spacing.md },
  desktopInsight: { flex: 1, minHeight: 72, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg },
  desktopInsightIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  desktopInsightLabel: { color: colors.onSurfaceTertiary, fontSize: 8 },
  desktopInsightValue: { color: colors.onSurface, fontSize: 15, fontWeight: "900", marginTop: 3 },
  desktopBottomGrid: { flexDirection: "row", alignItems: "stretch", gap: spacing.md },
  desktopIdentityCard: { width: 330, gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary },
  desktopIdentityTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  desktopAvatar: { width: 68, height: 68, borderRadius: radius.lg, borderWidth: 3, borderColor: colors.brandPrimary },
  desktopIdentityCopy: { flex: 1, minWidth: 0 },
  desktopName: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  desktopUsername: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", marginTop: 2 },
  desktopEquipped: { alignSelf: "flex-start", color: colors.brandTertiary, fontSize: 8, fontWeight: "900", marginTop: 5 },
  desktopBio: { color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 15 },
  desktopLevelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  desktopLevelTitle: { flex: 1, color: colors.onSurface, fontSize: 10, fontWeight: "900" },
  desktopLevelXp: { color: colors.onSurfaceTertiary, fontSize: 8 },
  desktopTrack: { height: 7, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surface },
  desktopFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  desktopIdentityStats: { flexDirection: "row", paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSubtle },
  desktopIdentityStat: { flex: 1, alignItems: "center", gap: 2 },
  desktopIdentityStatValue: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  desktopIdentityStatLabel: { color: colors.onSurfaceTertiary, fontSize: 8 },
  desktopIdentityActions: { flexDirection: "row", gap: spacing.sm },
  desktopAreasCard: { flex: 1, gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceTertiary },
  desktopAreasHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  desktopAreaCount: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "800" },
  desktopAreasGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  desktopAreaCard: { flexBasis: "23%", flexGrow: 1, minWidth: 130, minHeight: 104, justifyContent: "space-between", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  desktopAreaTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  desktopAreaIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md },
  desktopAreaLabel: { color: colors.onSurface, fontSize: 11, fontWeight: "900" },
  desktopAreaHint: { color: colors.onSurfaceTertiary, fontSize: 8, marginTop: 3 },
  disabled: { opacity: 0.55 },
});
