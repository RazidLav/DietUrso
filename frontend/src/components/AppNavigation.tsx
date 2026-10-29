import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NAVIGATION, getActiveChild, getActiveSection, normalizePathname, shouldHideNavigation, type NavigationItem } from "../navigation/config";
import { useReducedMotion, useResponsiveLayout } from "../responsive";
import { areaColors, breakpoints, colors, withAlpha, layout, radius, spacing, zIndex } from "../theme";
import WorkoutMiniPlayer from "./WorkoutMiniPlayer";

export const DESKTOP_BREAKPOINT = breakpoints.desktop;
export const MOBILE_DOCK_HEIGHT = 68;
const SIDEBAR_PREFERENCE_KEY = "urso:navigation.sidebar:v2";
const MOBILE_DOCK_IDS = ["home", "food", "training", "hydration"];
type SidebarMode = "expanded" | "compact" | "hidden";

export default function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const useSideNavigation = width >= breakpoints.tablet;
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("compact");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(SIDEBAR_PREFERENCE_KEY).then((saved) => {
      if (responsive.isDesktop && (saved === "expanded" || saved === "compact" || saved === "hidden")) setSidebarMode(saved);
      if (!responsive.isDesktop) setSidebarMode("compact");
    });
  }, [responsive.isDesktop]);

  const changeSidebarMode = (next: SidebarMode) => {
    setSidebarMode(next);
    if (responsive.isDesktop) void AsyncStorage.setItem(SIDEBAR_PREFERENCE_KEY, next);
  };

  const hideNavigation = shouldHideNavigation(pathname);
  if (hideNavigation) {
    const privateEntry = pathname.startsWith("/boas-vindas") || pathname.startsWith("/conta") || pathname.startsWith("/anamnese");
    return <View style={styles.fullScreen}>{children}{privateEntry ? null : <WorkoutMiniPlayer />}</View>;
  }

  if (useSideNavigation) {
    const effectiveMode = responsive.isDesktop ? sidebarMode : "compact";
    return (
      <View style={styles.desktopShell} testID="desktop-app-shell">
        {effectiveMode === "hidden" ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir navegação" style={[styles.reopenNavigation, { top: Math.max(insets.top, spacing.lg) }]} onPress={() => changeSidebarMode("compact")}><MaterialDesignIcons name="menu" size={23} color={colors.onSurface} /></Pressable> : <DesktopSidebar pathname={pathname} topInset={insets.top} bottomInset={insets.bottom} mode={effectiveMode} onModeChange={changeSidebarMode} />}
        <View style={styles.desktopMain}>
          <DesktopTopbar pathname={pathname} />
          <View style={styles.desktopCanvas}>{children}</View>
          <WorkoutMiniPlayer floating />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mobileShell} testID="mobile-app-shell">
      <View style={styles.mobileMain}>{children}</View>
      <WorkoutMiniPlayer />
      {!keyboardVisible ? <MobileNavigation pathname={pathname} bottomInset={insets.bottom} /> : null}
    </View>
  );
}

function navigate(router: ReturnType<typeof useRouter>, href: string) {
  router.push(href as never);
}

function DesktopTopbar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const activeSection = getActiveSection(pathname);
  const [query, setQuery] = useState("");
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const submitSearch = () => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return;
    const items = NAVIGATION.flatMap((section) => [section, ...section.children]);
    const destination = items.find((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalized));
    if (destination) { navigate(router, destination.href); setQuery(""); }
  };

  return <View style={styles.desktopTopbar} testID="desktop-topbar">
    <View style={styles.desktopTopbarContext}>
      <View style={styles.desktopTopbarIcon}><MaterialDesignIcons name={activeSection.icon as never} size={20} color={colors.onBrandPrimary} /></View>
      <View><Text style={styles.desktopTopbarGreeting}>{greeting}</Text><Text style={styles.desktopTopbarTitle}>{activeSection.label}</Text></View>
    </View>
    <View style={styles.desktopSearch}>
      <MaterialDesignIcons name="magnify" size={18} color={colors.onSurfaceTertiary} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={submitSearch}
        returnKeyType="search"
        placeholder="Buscar uma área"
        placeholderTextColor={colors.onSurfaceTertiary}
        accessibilityLabel="Buscar no UrsoFit"
        style={styles.desktopSearchInput}
      />
    </View>
    <View style={styles.desktopTopbarActions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir conquistas" onPress={() => navigate(router, "/conquistas")} style={({ pressed }) => [styles.desktopTopbarButton, pressed && styles.pressed]}><MaterialDesignIcons name="bell-outline" size={20} color={colors.onSurfaceSecondary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir perfil" onPress={() => navigate(router, "/perfil")} style={({ pressed }) => [styles.desktopProfileButton, pressed && styles.pressed]}>
        <Image source={require("../../assets/images/mascot-whey.jpg")} style={styles.desktopProfileAvatar} />
        <Text style={styles.desktopProfileText}>Minha toca</Text>
        <MaterialDesignIcons name="chevron-down" size={16} color={colors.onSurfaceTertiary} />
      </Pressable>
    </View>
  </View>;
}

function DesktopSidebar({ pathname, topInset, bottomInset, mode, onModeChange }: { pathname: string; topInset: number; bottomInset: number; mode: Exclude<SidebarMode, "hidden">; onModeChange: (mode: SidebarMode) => void }) {
  const router = useRouter();
  const activeSection = getActiveSection(pathname);
  const compact = mode === "compact";
  return (
    <View style={[styles.sidebarFrame, compact && styles.sidebarFrameCompact, { marginTop: Math.max(topInset, spacing.lg), marginBottom: Math.max(bottomInset, spacing.lg) }]} testID={compact ? "tablet-navigation-rail" : "desktop-sidebar"}>
      <View style={[styles.brandRow, compact && styles.brandRowCompact]}>
        <View style={styles.brandMark}><Image source={require("../../assets/images/ursofit-logo.png")} style={styles.brandLogo} accessibilityLabel="Logo do UrsoFit" /></View>
        {!compact ? <View><Text style={styles.brandName}>UrsoFit</Text><Text style={styles.brandTag}>ROTINA COM FORÇA</Text></View> : null}
      </View>
      <ScrollView style={styles.sidebarScroll} contentContainerStyle={styles.sidebarContent} showsVerticalScrollIndicator={false}>
        {NAVIGATION.map((section) => {
          const sectionActive = activeSection.id === section.id;
          return (
            <View key={section.id} style={styles.desktopGroup}>
              <NavPressable
                item={section}
                accent={areaColors[section.id]}
                active={sectionActive && normalizePathname(pathname) === normalizePathname(section.href)}
                sectionActive={sectionActive}
                onPress={() => navigate(router, section.href)}
                style="section"
                compact={compact}
              />
              {!compact && sectionActive ? section.children.map((child) => (
                <NavPressable key={child.id} item={child} accent={areaColors[section.id]} active={Boolean(getActiveChild(section, pathname)?.id === child.id)} onPress={() => navigate(router, child.href)} style="child" compact={false} />
              )) : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.sidebarControls, compact && styles.sidebarControlsCompact]}>
        <Pressable accessibilityRole="button" accessibilityLabel={compact ? "Expandir navegação" : "Recolher navegação"} style={styles.sidebarControl} onPress={() => onModeChange(compact ? "expanded" : "compact")}><MaterialDesignIcons name={compact ? "chevron-double-right" : "chevron-double-left"} size={20} color={colors.onSurfaceTertiary} />{!compact ? <Text style={styles.sidebarControlText}>Recolher</Text> : null}</Pressable>
        {!compact ? <Pressable accessibilityRole="button" accessibilityLabel="Ocultar navegação" style={styles.sidebarControl} onPress={() => onModeChange("hidden")}><MaterialDesignIcons name="eye-off-outline" size={19} color={colors.onSurfaceTertiary} /><Text style={styles.sidebarControlText}>Ocultar</Text></Pressable> : null}
      </View>
    </View>
  );
}

function NavPressable({ item, active, sectionActive = false, onPress, style, compact, accent }: { item: NavigationItem; active: boolean; sectionActive?: boolean; onPress: () => void; style: "section" | "child"; compact: boolean; accent: string }) {
  const aria = { "aria-current": active ? "page" : undefined } as Record<string, unknown>;
  return (
    <Pressable
      {...aria}
      accessibilityRole="link"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: active }}
      focusable
      onPress={onPress}
      style={({ pressed }) => [
        style === "section" ? styles.sidebarSection : styles.sidebarChild,
        compact && styles.sidebarSectionCompact,
        sectionActive && style === "section" && styles.sidebarSectionContext,
        active && (style === "section" ? styles.sidebarSectionActive : styles.sidebarChildActive),
        active && { backgroundColor: compact ? colors.brandPrimary : withAlpha(accent, style === "section" ? 0.18 : 0.12) },
        pressed && styles.pressed,
      ]}
      testID={`nav-${item.id}`}
    >
      <MaterialDesignIcons name={item.icon as never} size={style === "section" ? 20 : 17} color={active && compact ? colors.onBrandPrimary : active ? accent : sectionActive ? colors.onSurface : colors.onSurfaceTertiary} />
      {!compact ? <Text style={[style === "section" ? styles.sidebarSectionText : styles.sidebarChildText, (active || (sectionActive && style === "section")) && styles.navTextActive]} numberOfLines={1}>{item.label}</Text> : null}
      {active ? <View style={[styles.activeDot, { backgroundColor: accent }]} /> : null}
    </Pressable>
  );
}

function MobileNavigation({ pathname, bottomInset }: { pathname: string; bottomInset: number }) {
  const router = useRouter();
  const activeSection = getActiveSection(pathname);
  const reducedMotion = useReducedMotion();
  return (
    <View style={[styles.mobileNav, { paddingBottom: Math.max(bottomInset, spacing.sm) }]} testID="mobile-navigation">
      <View style={styles.dock} accessibilityRole="tablist" testID="mobile-dock">
        {NAVIGATION.filter((section) => MOBILE_DOCK_IDS.includes(section.id)).sort((a, b) => MOBILE_DOCK_IDS.indexOf(a.id) - MOBILE_DOCK_IDS.indexOf(b.id)).map((section) => {
          const active = activeSection.id === section.id;
          return <MobileDockItem key={section.id} section={section} active={active} reducedMotion={reducedMotion} onPress={() => navigate(router, section.href)} />;
        })}
      </View>
    </View>
  );
}

function MobileDockItem({ section, active, reducedMotion, onPress }: { section: NavigationItem; active: boolean; reducedMotion: boolean; onPress: () => void }) {
  const aria = { "aria-current": active ? "page" : undefined } as Record<string, unknown>;
  const itemTransition = Platform.OS === "web" && !reducedMotion
    ? ({ transitionProperty: "background-color, transform", transitionDuration: "240ms", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" } as never)
    : null;
  return <View style={[styles.dockItem, active && styles.dockItemActive, itemTransition]}>
    <Pressable
      {...aria}
      accessibilityRole="tab"
      accessibilityLabel={section.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.dockPressable, pressed && styles.pressed]}
      testID={`dock-${section.id}`}
    >
      <View style={[styles.dockIcon, active && styles.dockIconActive]}><MaterialDesignIcons name={section.icon as never} size={24} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} /></View>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: colors.surface },
  mobileShell: { flex: 1, backgroundColor: colors.surface },
  mobileMain: { flex: 1, minHeight: 0 },
  mobileNav: { flexShrink: 0, zIndex: zIndex.navigation, alignItems: "center", paddingHorizontal: spacing.sm, backgroundColor: colors.surface },
  dock: {
    width: "100%",
    maxWidth: 304,
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 10px 30px rgba(0,0,0,.28)" } as never)
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 10 }),
  },
  dockItem: { width: 58, height: 56, flexGrow: 0, flexShrink: 0, overflow: "hidden", borderRadius: radius.pill, backgroundColor: "transparent", transform: [{ scale: 0.96 }] },
  dockItemActive: { backgroundColor: colors.brandPrimary, transform: [{ scale: 1 }] },
  dockPressable: { flex: 1, alignItems: "center", justifyContent: "center" },
  dockIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  dockIconActive: { backgroundColor: "transparent" },
  desktopShell: { flex: 1, flexDirection: "row", backgroundColor: colors.surface },
  sidebarFrame: { width: layout.sidebarExpanded, marginLeft: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surfaceSecondary, overflow: "hidden", ...(Platform.OS === "web" ? ({ boxShadow: "0 18px 50px rgba(0,0,0,.2)" } as never) : {}) },
  sidebarFrameCompact: { width: layout.sidebarCompact },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, backgroundColor: withAlpha(areaColors.home, 0.06) },
  brandRowCompact: { justifyContent: "center", paddingHorizontal: spacing.sm, backgroundColor: "transparent" },
  brandMark: { width: 38, height: 38, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.brandPrimary },
  brandLogo: { width: "100%", height: "100%" },
  brandName: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  brandTag: { color: colors.brandPrimary, fontSize: 7, fontWeight: "900", letterSpacing: 1.2, marginTop: 1 },
  sidebarScroll: { flex: 1 },
  sidebarContent: { padding: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm },
  desktopGroup: { gap: 2 },
  sidebarSection: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  sidebarSectionCompact: { justifyContent: "center", paddingHorizontal: 0 },
  sidebarSectionContext: { backgroundColor: colors.surfaceTertiary },
  sidebarSectionActive: { backgroundColor: withAlpha(colors.brandPrimary, "1F") },
  sidebarSectionText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" },
  sidebarChild: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.xl, paddingRight: spacing.md, borderRadius: radius.sm },
  sidebarChildActive: { backgroundColor: withAlpha(colors.brandPrimary, "14") },
  sidebarChildText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 10.5, fontWeight: "650" as never },
  navTextActive: { color: colors.onSurface, fontWeight: "900" },
  activeDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  sidebarControls: { gap: spacing.xs, padding: spacing.sm, backgroundColor: colors.surfaceInteractive },
  sidebarControlsCompact: { alignItems: "center" },
  sidebarControl: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  sidebarControlText: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  reopenNavigation: { position: "absolute", left: spacing.md, zIndex: zIndex.navigation, width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated },
  desktopMain: { position: "relative", flex: 1, minWidth: 0, minHeight: 0, padding: spacing.lg, gap: spacing.md },
  desktopTopbar: { width: "100%", maxWidth: layout.editorMax, minHeight: 58, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  desktopTopbarContext: { minWidth: 190, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  desktopTopbarIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.brandPrimary },
  desktopTopbarGreeting: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "700" },
  desktopTopbarTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", marginTop: 1 },
  desktopSearch: { flex: 1, maxWidth: 420, minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface },
  desktopSearchInput: { flex: 1, minWidth: 0, color: colors.onSurface, fontSize: 11, outlineStyle: "none" } as never,
  desktopTopbarActions: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  desktopTopbarButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive },
  desktopProfileButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xs, paddingRight: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive },
  desktopProfileAvatar: { width: 32, height: 32, borderRadius: radius.pill },
  desktopProfileText: { color: colors.onSurface, fontSize: 10, fontWeight: "800" },
  desktopCanvas: { flex: 1, width: "100%", maxWidth: layout.editorMax, alignSelf: "center", overflow: "hidden", backgroundColor: colors.surface },
  pressed: { opacity: 0.72 },
});
