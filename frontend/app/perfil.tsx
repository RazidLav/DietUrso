import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ACHIEVEMENTS } from "../src/gamification/achievements";
import { evaluateGamification } from "../src/gamification/engine";
import { findCosmetic } from "../src/gamification/cosmetics";
import type { GamificationSummary } from "../src/gamification/types";
import { saveRemoteProfile } from "../src/profile/cloud";
import { removeProfilePhoto, resolveProfilePhotoUrl, uploadProfilePhoto } from "../src/profile/photo";
import { getProfileState, saveProfileState, safeFeaturedItems, setFeaturedItems, unlockEligibleCosmetics, validateUsername } from "../src/profile/store";
import type { ProfileContentArea, ProfileState, SocialVisibility } from "../src/profile/types";
import { colors, radius, spacing, withAlpha } from "../src/theme";

type LoadState = "loading" | "success" | "error";
const VISIBILITY: { id: SocialVisibility; label: string }[] = [{ id: "private", label: "Privado" }, { id: "friends", label: "Amigos" }, { id: "public", label: "Público" }];
const CONTENT_AREAS: { id: ProfileContentArea; label: string }[] = [{ id: "workouts", label: "Treinos" }, { id: "nutrition", label: "Alimentação" }, { id: "hydration", label: "Hidratação" }, { id: "achievements", label: "Conquistas" }, { id: "evolution", label: "Evolução" }, { id: "photos", label: "Fotos" }, { id: "rugidos", label: "Rugidos" }, { id: "challenges", label: "Desafios" }];

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 960;
  const [state, setState] = useState<ProfileState | null>(null);
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading"); setNotice(null);
    try {
      let [profile, game] = await Promise.all([getProfileState(), evaluateGamification()]);
      if (profile.profile.photoPath) {
        const refreshedUrl = await resolveProfilePhotoUrl(profile.profile.photoPath).catch(() => null);
        if (refreshedUrl) profile = { ...profile, profile: { ...profile.profile, photoUrl: refreshedUrl } };
      }
      const unlocked = unlockEligibleCosmetics(profile, game);
      if (Object.keys(unlocked.unlockedCosmetics).length !== Object.keys(profile.unlockedCosmetics).length) await saveProfileState(unlocked);
      setState(unlocked); setSummary(game); setLoadState("success");
    } catch (error) { setLoadState("error"); setNotice(error instanceof Error ? error.message : "Não foi possível carregar o perfil."); }
  }, []);

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

  if (loadState === "loading") return <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.muted}>Preparando sua toca…</Text></View>;
  if (loadState === "error" || !state || !summary) return <View style={styles.center}><MaterialDesignIcons name="cloud-alert-outline" size={36} color={colors.error} /><Text style={styles.title}>Seu perfil não carregou</Text><Text style={styles.muted}>{notice}</Text><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryText}>Tentar novamente</Text></Pressable></View>;

  const equippedTitle = findCosmetic(state.equipped.title)?.name;
  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }]} testID="profile-screen">
    <View style={styles.topbar}><Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Voltar"><MaterialDesignIcons name="chevron-left" size={25} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>MINHA TOCA</Text><Text style={styles.headerTitle}>Perfil UrsoFit</Text></View><Pressable style={styles.iconButton} onPress={() => setEditing((value) => !value)} accessibilityLabel="Editar perfil"><MaterialDesignIcons name={editing ? "close" : "pencil-outline"} size={21} color={colors.onSurface} /></Pressable></View>

    {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}
    <View style={[styles.profileGrid, desktop && styles.profileGridDesktop]}>
      <View style={[styles.showcase, desktop && styles.showcaseDesktop]}>
        <View style={styles.banner}><View style={styles.bannerGlow} /></View>
        <View style={styles.avatarWrap}>{state.profile.avatarMode === "photo" && state.profile.photoUrl ? <Image source={{ uri: state.profile.photoUrl }} style={styles.avatar} accessibilityLabel="Foto do perfil" /> : <Image source={require("../assets/images/mascot-whey.jpg")} style={styles.avatar} accessibilityLabel="Avatar Urso da Toca" />}</View>
        <View style={styles.identity}><Text style={styles.name}>{state.profile.displayName}</Text><Text style={styles.username}>{state.profile.username ? `@${state.profile.username}` : "Username ainda não definido"}</Text>{equippedTitle ? <View style={styles.titlePill}><MaterialDesignIcons name="star-four-points" size={13} color="#F6C85F" /><Text style={styles.titlePillText}>{equippedTitle}</Text></View> : null}<Text style={styles.bio}>{state.profile.bio || "Conte um pouquinho sobre sua jornada."}</Text><Text style={styles.privateLabel}><MaterialDesignIcons name="lock-outline" size={13} color={colors.onSurfaceTertiary} /> Perfil privado por padrão</Text></View>
        <View style={styles.levelBlock}><View style={styles.levelTop}><Text style={styles.levelTitle}>Nível {summary.level} · {summary.chapterTitle}</Text><Text style={styles.levelXp}>{summary.state.totalXp} XP</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${summary.progress * 100}%` }]} /></View>{summary.legacyLevel > 100 ? <Text style={styles.legacy}>Legado preservado: nível {summary.legacyLevel}</Text> : null}</View>
        <View style={styles.stats}><Stat icon="fire" value={summary.context.currentStreak} label="sequência" /><Stat icon="calendar-check-outline" value={summary.context.bestStreak} label="recorde" /><Stat icon="trophy-outline" value={summary.unlockedCount} label="conquistas" /></View>
        <View style={styles.actions}><Pressable style={styles.primaryButton} onPress={() => router.push("/meu-urso")}><MaterialDesignIcons name="teddy-bear" size={18} color={colors.onBrandPrimary} /><Text style={styles.primaryText}>Meu Urso</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => router.push("/conquistas")}><Text style={styles.secondaryText}>Ver jornada</Text></Pressable></View>
      </View>

      <View style={[styles.sideColumn, desktop && styles.sideColumnDesktop]}>
        {editing ? <View style={styles.card} testID="profile-editor"><Text style={styles.cardTitle}>Editar vitrine</Text><Field label="Nome de exibição"><TextInput style={styles.input} value={state.profile.displayName} maxLength={50} onChangeText={(displayName) => patchProfile({ displayName })} placeholderTextColor={colors.muted} /></Field><Field label="Username"><TextInput style={styles.input} value={state.profile.username ?? ""} maxLength={24} autoCapitalize="none" onChangeText={(username) => patchProfile({ username })} placeholder="seu_username" placeholderTextColor={colors.muted} /></Field><Field label="Bio"><TextInput style={[styles.input, styles.bioInput]} multiline value={state.profile.bio} maxLength={160} onChangeText={(bio) => patchProfile({ bio })} placeholderTextColor={colors.muted} /></Field><Toggle label="Mostrar progresso numa futura vitrine pública" value={state.profile.showProgressStats} onValueChange={(showProgressStats) => patchProfile({ showProgressStats })} /><Toggle label="Mostrar sequências numa futura vitrine pública" value={state.profile.showStreakStats} onValueChange={(showStreakStats) => patchProfile({ showStreakStats })} /><View style={styles.photoActions}><Pressable style={styles.secondaryButton} onPress={choosePhoto}><Text style={styles.secondaryText}>Escolher foto</Text></Pressable>{state.profile.photoPath ? <Pressable style={styles.secondaryButton} onPress={() => void removePhoto()}><Text style={styles.dangerText}>Remover foto</Text></Pressable> : null}</View><Pressable style={[styles.primaryButton, busy && styles.disabled]} disabled={busy} onPress={() => void persist()}>{busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>Salvar perfil</Text>}</Pressable></View> : null}

        {editing ? <View style={styles.card} testID="profile-privacy-editor"><Text style={styles.cardTitle}>Privacidade social</Text><Text style={styles.muted}>Tudo começa privado. Escolha quem pode ver cada parte.</Text><Text style={styles.label}>PERFIL</Text><View style={styles.achievementChoices}>{VISIBILITY.map((option) => <Pressable key={option.id} style={[styles.choice, state.profile.profileVisibility === option.id && styles.choiceActive]} onPress={() => patchProfile({ profileVisibility: option.id })}><Text style={[styles.choiceText, state.profile.profileVisibility === option.id && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View>{CONTENT_AREAS.map((area) => <View key={area.id} style={styles.toggle}><Text style={styles.toggleText}>{area.label}</Text><View style={styles.achievementChoices}>{VISIBILITY.map((option) => <Pressable accessibilityLabel={`${area.label}: ${option.label}`} key={option.id} style={[styles.choice, state.profile.contentVisibility[area.id] === option.id && styles.choiceActive]} onPress={() => patchProfile({ contentVisibility: { ...state.profile.contentVisibility, [area.id]: option.id } })}><Text style={[styles.choiceText, state.profile.contentVisibility[area.id] === option.id && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View></View>)}</View> : null}

        <View style={styles.card}>
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

        <View style={styles.card}><Text style={styles.cardTitle}>Conquistas recentes</Text>{recent.length ? recent.map(({ achievement, date }) => <View key={achievement!.id} style={styles.recent}><View style={styles.recentIcon}><MaterialDesignIcons name={achievement!.icon as never} size={18} color={colors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.recentTitle}>{achievement!.title}</Text><Text style={styles.muted}>{new Date(date).toLocaleDateString("pt-BR")}</Text></View></View>) : <Text style={styles.muted}>Sua primeira conquista vai aparecer aqui.</Text>}</View>
      </View>
    </View>
  </ScrollView>;
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) { return <View style={styles.stat}><MaterialDesignIcons name={icon as never} size={18} color={colors.brandPrimary} /><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={styles.toggle}><Text style={styles.toggleText}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} /></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: 1180, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg }, center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }, topbar: { flexDirection: "row", alignItems: "center", gap: spacing.md }, iconButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 }, headerTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900" }, profileGrid: { gap: spacing.lg }, profileGridDesktop: { flexDirection: "row", alignItems: "flex-start" }, showcase: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, showcaseDesktop: { flex: 1.05 }, banner: { height: 132, backgroundColor: withAlpha(colors.brandPrimary, 0.16), overflow: "hidden" }, bannerGlow: { width: 260, height: 260, borderRadius: 130, alignSelf: "flex-end", marginTop: -90, marginRight: -40, backgroundColor: withAlpha("#F6C85F", 0.22) }, avatarWrap: { width: 112, height: 112, marginTop: -56, marginLeft: spacing.xl, padding: 5, borderRadius: 36, backgroundColor: colors.surfaceSecondary, borderWidth: 3, borderColor: colors.brandPrimary }, avatar: { width: "100%", height: "100%", borderRadius: 29 }, identity: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.xs }, name: { color: colors.onSurface, fontSize: 25, fontWeight: "900" }, username: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" }, titlePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: withAlpha("#F6C85F", 0.14) }, titlePillText: { color: colors.onSurface, fontSize: 10, fontWeight: "800" }, bio: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18, marginTop: spacing.xs }, privateLabel: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: spacing.xs }, levelBlock: { marginHorizontal: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, gap: spacing.sm }, levelTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }, levelTitle: { flex: 1, color: colors.onSurface, fontSize: 12, fontWeight: "900" }, levelXp: { color: colors.onSurfaceTertiary, fontSize: 10 }, track: { height: 9, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.surface }, fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, legacy: { color: colors.brandTertiary, fontSize: 9, fontWeight: "800" }, stats: { flexDirection: "row", margin: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }, stat: { flex: 1, alignItems: "center", gap: 2 }, statValue: { color: colors.onSurface, fontSize: 19, fontWeight: "900" }, statLabel: { color: colors.onSurfaceTertiary, fontSize: 9 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.xl, paddingTop: 0 }, sideColumn: { gap: spacing.lg }, sideColumnDesktop: { flex: 1 }, card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, cardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900" }, counter: { color: colors.brandPrimary, fontSize: 11, fontWeight: "900" }, field: { gap: 6 }, label: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800" }, input: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, outlineStyle: "none" } as never, bioInput: { minHeight: 86, paddingTop: spacing.md, textAlignVertical: "top" }, toggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md }, toggleText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 16 }, primaryButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, primaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" }, secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary }, secondaryText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, dangerText: { color: colors.error, fontSize: 11, fontWeight: "800" }, photoActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, featured: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, reorderButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary }, featuredIndex: { width: 28, height: 28, textAlign: "center", lineHeight: 28, borderRadius: radius.pill, overflow: "hidden", color: colors.onBrandPrimary, backgroundColor: colors.brandPrimary, fontWeight: "900" }, featuredText: { flex: 1, color: colors.onSurface, fontSize: 11, fontWeight: "800" }, achievementChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }, choice: { maxWidth: "100%", paddingHorizontal: spacing.sm, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary }, choiceActive: { borderColor: colors.brandPrimary, backgroundColor: withAlpha(colors.brandPrimary, 0.12) }, choiceText: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "700" }, choiceTextActive: { color: colors.brandPrimary }, recent: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, recentIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: withAlpha(colors.brandPrimary, 0.12) }, recentTitle: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, muted: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15, textAlign: "center" }, title: { color: colors.onSurface, fontSize: 18, fontWeight: "900", textAlign: "center" }, notice: { padding: spacing.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.brandTertiary, 0.12), borderWidth: 1, borderColor: withAlpha(colors.brandTertiary, 0.35) }, noticeText: { color: colors.onSurfaceSecondary, fontSize: 11 }, disabled: { opacity: 0.55 },
});
