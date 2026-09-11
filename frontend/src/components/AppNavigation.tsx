import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { usePathname, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
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
import { NAVIGATION, getActiveChild, getActiveSection, normalizePathname, shouldHideNavigation, type NavigationItem, type NavigationSection } from "../navigation/config";
import { breakpoints, colors, motion, radius, spacing, zIndex } from "../theme";

export const DESKTOP_BREAKPOINT = breakpoints.desktop;
export const MOBILE_DOCK_HEIGHT = 68;

export default function AppNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const hideNavigation = shouldHideNavigation(pathname);
  if (hideNavigation) return <View style={styles.fullScreen}>{children}</View>;

  if (isDesktop) {
    return (
      <View style={styles.desktopShell} testID="desktop-app-shell">
        <DesktopSidebar pathname={pathname} topInset={insets.top} bottomInset={insets.bottom} />
        <View style={styles.desktopMain}><View style={styles.desktopCanvas}>{children}</View></View>
      </View>
    );
  }

  return (
    <View style={styles.mobileShell} testID="mobile-app-shell">
      <View style={styles.mobileMain}>{children}</View>
      {!keyboardVisible ? <MobileNavigation pathname={pathname} bottomInset={insets.bottom} /> : null}
    </View>
  );
}

function navigate(router: ReturnType<typeof useRouter>, href: string) {
  router.push(href as never);
}

function DesktopSidebar({ pathname, topInset, bottomInset }: { pathname: string; topInset: number; bottomInset: number }) {
  const router = useRouter();
  const activeSection = getActiveSection(pathname);
  return (
    <View style={[styles.sidebarFrame, { marginTop: Math.max(topInset, spacing.lg), marginBottom: Math.max(bottomInset, spacing.lg) }]} testID="desktop-sidebar">
      <View style={styles.brandRow}>
        <View style={styles.brandMark}><MaterialDesignIcons name="paw" size={21} color={colors.onBrandPrimary} /></View>
        <View><Text style={styles.brandName}>DietUrso</Text><Text style={styles.brandTag}>ROTINA COM FORÇA</Text></View>
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
              />
              {section.children.map((child) => (
                <NavPressable key={child.id} item={child} active={Boolean(getActiveChild(section, pathname)?.id === child.id)} onPress={() => navigate(router, child.href)} style="child" />
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function NavPressable({ item, active, sectionActive = false, onPress, style }: { item: NavigationItem; active: boolean; sectionActive?: boolean; onPress: () => void; style: "section" | "child" }) {
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
        sectionActive && style === "section" && styles.sidebarSectionContext,
        active && (style === "section" ? styles.sidebarSectionActive : styles.sidebarChildActive),
        pressed && styles.pressed,
      ]}
      testID={`nav-${item.id}`}
    >
      <MaterialDesignIcons name={item.icon as never} size={style === "section" ? 20 : 17} color={active ? colors.brandPrimary : sectionActive ? colors.onSurface : colors.onSurfaceTertiary} />
      <Text style={[style === "section" ? styles.sidebarSectionText : styles.sidebarChildText, (active || (sectionActive && style === "section")) && styles.navTextActive]} numberOfLines={1}>{item.label}</Text>
      {active ? <View style={styles.activeDot} /> : null}
    </Pressable>
  );
}

function MobileNavigation({ pathname, bottomInset }: { pathname: string; bottomInset: number }) {
  const router = useRouter();
  const activeSection = getActiveSection(pathname);
  const [displayedSection, setDisplayedSection] = useState(activeSection);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (displayedSection.id === activeSection.id) return;
    if (reduceMotion) {
      opacity.setValue(1); translateX.setValue(0);
      return;
    }
    const direction = activeSection.order > displayedSection.order ? 1 : -1;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: motion.contextExitMs, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(translateX, { toValue: -direction * 18, duration: motion.contextExitMs, useNativeDriver: Platform.OS !== "web" }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setDisplayedSection(activeSection);
      translateX.setValue(direction * 18);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: motion.contextEnterMs, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(translateX, { toValue: 0, duration: motion.contextEnterMs, useNativeDriver: Platform.OS !== "web" }),
      ]).start();
    });
  }, [activeSection, displayedSection, opacity, reduceMotion, translateX]);

  const visibleSection = reduceMotion ? activeSection : displayedSection;
  return (
    <View style={[styles.mobileNav, { paddingBottom: Math.max(bottomInset, spacing.sm) }]} testID="mobile-navigation">
      {visibleSection.children.length ? (
        <Animated.View style={{ opacity, transform: [{ translateX }] }}>
          <ContextBar section={visibleSection} pathname={pathname} onNavigate={(href) => navigate(router, href)} />
        </Animated.View>
      ) : <View style={styles.contextSpacer} />}
      <View style={styles.dock} accessibilityRole="tablist" testID="mobile-dock">
        {NAVIGATION.map((section) => {
          const active = activeSection.id === section.id;
          const aria = { "aria-current": active ? "page" : undefined } as Record<string, unknown>;
          return (
            <Pressable
              {...aria}
              key={section.id}
              accessibilityRole="tab"
              accessibilityLabel={section.label}
              accessibilityState={{ selected: active }}
              onPress={() => navigate(router, section.href)}
              style={({ pressed }) => [styles.dockItem, active && styles.dockItemActive, pressed && styles.pressed]}
              testID={`dock-${section.id}`}
            >
              <View style={[styles.dockIcon, active && styles.dockIconActive]}><MaterialDesignIcons name={section.icon as never} size={21} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} /></View>
              <Text numberOfLines={1} style={[styles.dockLabel, active && styles.dockLabelActive]}>{section.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ContextBar({ section, pathname, onNavigate }: { section: NavigationSection; pathname: string; onNavigate: (href: string) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, { x: number; width: number }>>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const activeChild = useMemo(() => getActiveChild(section, pathname) ?? section.children[0], [pathname, section]);

  useEffect(() => {
    const position = positions.current[activeChild?.id];
    if (!position || !viewportWidth) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, position.x - (viewportWidth - position.width) / 2), animated: true });
  }, [activeChild?.id, viewportWidth]);

  return (
    <View style={styles.contextFrame} testID={`context-${section.id}`}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contextContent}
        onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
        keyboardShouldPersistTaps="handled"
      >
        {section.children.map((child) => {
          const active = child.id === activeChild?.id;
          const aria = { "aria-current": active ? "page" : undefined } as Record<string, unknown>;
          return (
            <Pressable
              {...aria}
              key={child.id}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              onLayout={(event) => { positions.current[child.id] = event.nativeEvent.layout; }}
              onPress={() => onNavigate(child.href)}
              style={({ pressed }) => [styles.contextItem, active && styles.contextItemActive, pressed && styles.pressed]}
              testID={`context-item-${child.id}`}
            >
              <Text style={[styles.contextText, active && styles.contextTextActive]}>{child.shortLabel ?? child.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={styles.contextFade}><MaterialDesignIcons name="chevron-right" size={18} color={colors.onSurfaceTertiary} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: colors.surface },
  mobileShell: { flex: 1, backgroundColor: colors.surface },
  mobileMain: { flex: 1, minHeight: 0 },
  mobileNav: { flexShrink: 0, zIndex: zIndex.navigation, backgroundColor: colors.surface },
  contextSpacer: { height: 4 },
  contextFrame: { height: 50, justifyContent: "center", backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  contextContent: { paddingHorizontal: spacing.md, alignItems: "center", gap: spacing.xs, paddingRight: spacing.xxl },
  contextItem: { minHeight: 36, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  contextItemActive: { backgroundColor: colors.brandPrimary + "18", borderColor: colors.brandPrimary },
  contextText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  contextTextActive: { color: colors.brandPrimary, fontWeight: "900" },
  contextFade: { position: "absolute", right: 0, top: 0, bottom: 0, width: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface + "EE" },
  dock: {
    minHeight: MOBILE_DOCK_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: spacing.sm,
    marginHorizontal: spacing.sm,
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
  dockItem: { flex: 1, minWidth: 0, minHeight: 58, alignItems: "center", justifyContent: "center", gap: 2, paddingHorizontal: 2, borderRadius: radius.md },
  dockItemActive: { backgroundColor: colors.brandPrimary + "12" },
  dockIcon: { width: 34, height: 28, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  dockIconActive: { backgroundColor: colors.brandPrimary },
  dockLabel: { width: "100%", color: colors.onSurfaceTertiary, fontSize: 8.5, fontWeight: "700", textAlign: "center" },
  dockLabelActive: { color: colors.brandPrimary, fontWeight: "900" },
  desktopShell: { flex: 1, flexDirection: "row", backgroundColor: colors.surface },
  sidebarFrame: { width: 248, marginLeft: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong, overflow: "hidden", ...(Platform.OS === "web" ? ({ boxShadow: "0 16px 48px rgba(0,0,0,.35)" } as never) : {}) },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  brandMark: { width: 38, height: 38, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary },
  brandName: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  brandTag: { color: colors.brandPrimary, fontSize: 7, fontWeight: "900", letterSpacing: 1.2, marginTop: 1 },
  sidebarScroll: { flex: 1 },
  sidebarContent: { padding: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm },
  desktopGroup: { gap: 2 },
  sidebarSection: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  sidebarSectionContext: { backgroundColor: colors.surfaceTertiary },
  sidebarSectionActive: { backgroundColor: colors.brandPrimary + "1F" },
  sidebarSectionText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" },
  sidebarChild: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingLeft: spacing.xl, paddingRight: spacing.md, borderRadius: radius.sm },
  sidebarChildActive: { backgroundColor: colors.brandPrimary + "14" },
  sidebarChildText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 10.5, fontWeight: "650" as never },
  navTextActive: { color: colors.onSurface, fontWeight: "900" },
  activeDot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  desktopMain: { flex: 1, minWidth: 0, padding: spacing.lg },
  desktopCanvas: { flex: 1, width: "100%", maxWidth: 1380, alignSelf: "center", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.72 },
});
