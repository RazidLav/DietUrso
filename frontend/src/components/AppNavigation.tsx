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
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NAVIGATION, getActiveChild, getActiveSection, normalizePathname, shouldHideNavigation, type NavigationItem } from "../navigation/config";
import { useReducedMotion, useResponsiveLayout } from "../responsive";
import { breakpoints, colors, withAlpha, layout, radius, spacing, zIndex } from "../theme";
import WorkoutMiniPlayer from "./WorkoutMiniPlayer";

export const DESKTOP_BREAKPOINT = breakpoints.desktop;
export const MOBILE_DOCK_HEIGHT = 68;
const SIDEBAR_PREFERENCE_KEY = "urso:navigation.sidebar";
type SidebarMode = "expanded" | "compact" | "hidden";

export default function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const responsive = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const useSideNavigation = width >= breakpoints.navigationRail;
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(responsive.isDesktop ? "expanded" : "compact");
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
        <View style={styles.desktopMain}><View style={styles.desktopCanvas}>{children}</View><WorkoutMiniPlayer floating /></View>
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
                active={sectionActive && normalizePathname(pathname) === normalizePathname(section.href)}
                sectionActive={sectionActive}
                onPress={() => navigate(router, section.href)}
                style="section"
                compact={compact}
              />
              {!compact && sectionActive ? section.children.map((child) => (
                <NavPressable key={child.id} item={child} active={Boolean(getActiveChild(section, pathname)?.id === child.id)} onPress={() => navigate(router, child.href)} style="child" compact={false} />
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

function NavPressable({ item, active, sectionActive = false, onPress, style, compact }: { item: NavigationItem; active: boolean; sectionActive?: boolean; onPress: () => void; style: "section" | "child"; compact: boolean }) {
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
        pressed && styles.pressed,
      ]}
      testID={`nav-${item.id}`}
    >
      <MaterialDesignIcons name={item.icon as never} size={style === "section" ? 20 : 17} color={active ? colors.brandPrimary : sectionActive ? colors.onSurface : colors.onSurfaceTertiary} />
      {!compact ? <Text style={[style === "section" ? styles.sidebarSectionText : styles.sidebarChildText, (active || (sectionActive && style === "section")) && styles.navTextActive]} numberOfLines={1}>{item.label}</Text> : null}
      {active ? <View style={styles.activeDot} /> : null}
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
        {NAVIGATION.map((section) => {
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
    ? ({ transitionProperty: "flex-basis, flex-grow, background-color, transform", transitionDuration: "240ms", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" } as never)
    : null;
  const labelTransition = Platform.OS === "web" && !reducedMotion
    ? ({ transitionProperty: "max-width, opacity, margin-left", transitionDuration: "200ms", transitionTimingFunction: "ease-out" } as never)
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
      <View style={[styles.dockIcon, active && styles.dockIconActive]}><MaterialDesignIcons name={section.icon as never} size={22} color={active ? colors.brandPrimary : colors.onSurfaceTertiary} /></View>
      <Text numberOfLines={1} style={[styles.dockLabel, active && styles.dockLabelActive, labelTransition]}>{section.label}</Text>
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
    maxWidth: 560,
    minHeight: MOBILE_DOCK_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 12px 32px rgba(0,0,0,.46), 0 1px 0 rgba(255,255,255,.035) inset" } as never)
      : { shadowColor: "#000000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.38, shadowRadius: 16, elevation: 12 }),
  },
  dockItem: { flexBasis: 44, flexGrow: 0, flexShrink: 1, minWidth: 42, maxWidth: 132, minHeight: 54, overflow: "hidden", borderRadius: radius.pill, backgroundColor: "rgba(0,0,0,0)", transform: [{ scale: 0.98 }] },
  dockItemActive: { flexBasis: 100, flexGrow: 1, backgroundColor: colors.surfaceTertiary, transform: [{ scale: 1 }] },
  dockPressable: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  dockIcon: { width: 34, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  dockIconActive: { backgroundColor: withAlpha(colors.brandPrimary, 0.1) },
  dockLabel: { maxWidth: 0, opacity: 0, marginLeft: 0, overflow: "hidden", color: colors.onSurface, fontSize: 11, fontWeight: "900" },
  dockLabelActive: { maxWidth: 76, opacity: 1, marginLeft: spacing.xs },
  desktopShell: { flex: 1, flexDirection: "row", backgroundColor: colors.surface },
  sidebarFrame: { width: layout.sidebarExpanded, marginLeft: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderSubtle, overflow: "hidden", ...(Platform.OS === "web" ? ({ boxShadow: "0 16px 48px rgba(0,0,0,.24)" } as never) : {}) },
  sidebarFrameCompact: { width: layout.sidebarCompact },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandRowCompact: { justifyContent: "center", paddingHorizontal: spacing.sm },
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
  sidebarControls: { gap: spacing.xs, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  sidebarControlsCompact: { alignItems: "center" },
  sidebarControl: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  sidebarControlText: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  reopenNavigation: { position: "absolute", left: spacing.md, zIndex: zIndex.navigation, width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderSubtle },
  desktopMain: { position: "relative", flex: 1, minWidth: 0, minHeight: 0, padding: spacing.lg },
  desktopCanvas: { flex: 1, width: "100%", maxWidth: layout.editorMax, alignSelf: "center", overflow: "hidden", backgroundColor: colors.surface },
  pressed: { opacity: 0.72 },
});
