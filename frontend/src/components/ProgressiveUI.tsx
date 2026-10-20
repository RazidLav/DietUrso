import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, withAlpha, zIndex } from "../theme";
import { useResponsiveLayout } from "../responsive";

export type ProgressiveAction = {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  hint?: string;
};

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <View style={styles.sectionHeader}>
    <View style={styles.sectionHeaderCopy}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
    {action}
  </View>;
}

export function FolderCard({ icon, title, description, badge, onPress, testID, style }: { icon: string; title: string; description?: string; badge?: string | number; onPress: () => void; testID?: string; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} testID={testID} style={({ pressed }) => [styles.folderCard, style, pressed && styles.pressed]}>
    <View style={styles.folderIcon}><MaterialDesignIcons name={icon as never} size={23} color={colors.brandPrimary} /></View>
    <View style={styles.folderCopy}><Text style={styles.folderTitle}>{title}</Text>{description ? <Text style={styles.folderDescription}>{description}</Text> : null}</View>
    {badge !== undefined ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
    <MaterialDesignIcons name="chevron-right" size={21} color={colors.onSurfaceTertiary} />
  </Pressable>;
}

export function FeatureCard({ icon, title, value, description, onPress, accent = colors.brandPrimary, style }: { icon: string; title: string; value?: string; description?: string; onPress?: () => void; accent?: string; style?: StyleProp<ViewStyle> }) {
  const content = <>
    <View style={[styles.featureIcon, { backgroundColor: withAlpha(accent, 0.12) }]}><MaterialDesignIcons name={icon as never} size={21} color={accent} /></View>
    <View style={styles.folderCopy}><Text style={styles.featureTitle}>{title}</Text>{value ? <Text style={styles.featureValue}>{value}</Text> : null}{description ? <Text style={styles.folderDescription}>{description}</Text> : null}</View>
    {onPress ? <MaterialDesignIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} /> : null}
  </>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [styles.featureCard, style, pressed && styles.pressed]}>{content}</Pressable> : <View style={[styles.featureCard, style]}>{content}</View>;
}

export function StepHeader({ current, total, title, summary, onBack }: { current: number; total: number; title: string; summary?: string; onBack?: () => void }) {
  const progress = Math.max(0, Math.min(1, current / Math.max(total, 1)));
  return <View style={styles.stepHeader}>
    <View style={styles.stepTop}>
      {onBack ? <Pressable accessibilityLabel="Voltar uma etapa" style={styles.iconButton} onPress={onBack}><MaterialDesignIcons name="arrow-left" size={21} color={colors.onSurface} /></Pressable> : null}
      <View style={styles.folderCopy}><Text style={styles.eyebrow}>ETAPA {current} DE {total}</Text><Text style={styles.stepTitle}>{title}</Text>{summary ? <Text style={styles.folderDescription}>{summary}</Text> : null}</View>
    </View>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
  </View>;
}

export function AdvancedOptions({ title = "Opções avançadas", summary, children, initiallyOpen = false }: { title?: string; summary?: string; children: React.ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={styles.advanced}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={styles.advancedHeader}>
      <MaterialDesignIcons name="tune-variant" size={19} color={colors.brandSecondary} />
      <View style={styles.folderCopy}><Text style={styles.advancedTitle}>{title}</Text>{!open && summary ? <Text style={styles.folderDescription}>{summary}</Text> : null}</View>
      <MaterialDesignIcons name={open ? "chevron-up" : "chevron-down"} size={21} color={colors.onSurfaceTertiary} />
    </Pressable>
    {open ? <View style={styles.advancedContent}>{children}</View> : null}
  </View>;
}

export function StickyActionBar({ primaryLabel, onPrimary, primaryDisabled, secondaryLabel, onSecondary, busy }: { primaryLabel: string; onPrimary: () => void; primaryDisabled?: boolean; secondaryLabel?: string; onSecondary?: () => void; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
    {secondaryLabel && onSecondary ? <Pressable accessibilityRole="button" style={styles.secondaryButton} onPress={onSecondary}><Text style={styles.secondaryText}>{secondaryLabel}</Text></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={primaryDisabled || busy} onPress={onPrimary} style={[styles.primaryButton, (primaryDisabled || busy) && styles.disabled]}>{busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}</Pressable>
  </View>;
}

export function FloatingActionMenu({ actions, label = "Adicionar", bottom = 92 }: { actions: ProgressiveAction[]; label?: string; bottom?: number }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsiveLayout();
  const closeAndRun = (action: ProgressiveAction) => { setOpen(false); action.onPress(); };
  return <>
    <View pointerEvents="box-none" style={styles.fabLayer}>
      <Pressable accessibilityRole="button" accessibilityLabel={open ? "Fechar menu de ações" : label} accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={[styles.fab, isPhone && styles.fabPhone, { bottom: (isPhone ? bottom : spacing.lg) + insets.bottom }]}>
        <MaterialDesignIcons name={open ? "close" : "plus"} size={25} color={colors.onBrandPrimary} />{!isPhone ? <Text style={styles.fabText}>{open ? "Fechar" : label}</Text> : null}
      </Pressable>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable accessibilityLabel="Fechar menu de ações" style={styles.actionOverlay} onPress={() => setOpen(false)}>
        <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>O que você quer fazer?</Text>
          {actions.map((action) => <Pressable accessibilityRole="button" key={action.id} style={styles.actionItem} onPress={() => closeAndRun(action)}>
            <View style={styles.actionIcon}><MaterialDesignIcons name={action.icon as never} size={22} color={colors.brandPrimary} /></View>
            <View style={styles.folderCopy}><Text style={styles.folderTitle}>{action.label}</Text>{action.hint ? <Text style={styles.folderDescription}>{action.hint}</Text> : null}</View>
            <MaterialDesignIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </>;
}

export function SearchAndFilter({ value, onChangeText, placeholder, children }: { value: string; onChangeText: (value: string) => void; placeholder: string; children?: React.ReactNode }) {
  return <View style={styles.searchBlock}>
    <View style={styles.searchField}><MaterialDesignIcons name="magnify" size={21} color={colors.onSurfaceTertiary} /><TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} returnKeyType="search" style={styles.searchInput} /></View>
    {children ? <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{children}</ScrollView> : null}
  </View>;
}

export function LoadingSkeleton({ rows = 3, title = "Carregando…" }: { rows?: number; title?: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={title} style={styles.stateCard}><View style={styles.loadingHeading}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.stateTitle}>{title}</Text></View>{Array.from({ length: rows }, (_, index) => <View key={index} style={[styles.skeleton, index === rows - 1 && { width: "62%" }]} />)}</View>;
}

export function EmptyState({ icon = "inbox-outline", title, description, actionLabel, onAction }: { icon?: string; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.stateCard}><View style={styles.stateIcon}><MaterialDesignIcons name={icon as never} size={30} color={colors.onSurfaceTertiary} /></View><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{description}</Text>{actionLabel && onAction ? <Pressable style={styles.inlineAction} onPress={onAction}><Text style={styles.inlineActionText}>{actionLabel}</Text></Pressable> : null}</View>;
}

export function ErrorState({ title = "Não foi possível carregar", description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return <View style={[styles.stateCard, styles.errorState]}><MaterialDesignIcons name="cloud-alert-outline" size={30} color={colors.error} /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateText}>{description}</Text>{onRetry ? <Pressable style={styles.inlineAction} onPress={onRetry}><Text style={styles.inlineActionText}>Tentar novamente</Text></Pressable> : null}</View>;
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  sectionHeaderCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.onSurface, fontSize: 26, lineHeight: 31, fontWeight: "900" },
  description: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, marginTop: spacing.xs, maxWidth: 720 },
  folderCard: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  folderIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.brandPrimary, 0.12) },
  folderCopy: { flex: 1, minWidth: 0 },
  folderTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "850" as never },
  folderDescription: { color: colors.onSurfaceTertiary, fontSize: 10.5, lineHeight: 16, marginTop: 2 },
  badge: { minWidth: 25, height: 25, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: withAlpha(colors.brandPrimary, 0.14) },
  badgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900" },
  featureCard: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  featureIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  featureTitle: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  featureValue: { color: colors.onSurface, fontSize: 21, fontWeight: "900", marginTop: 2 },
  stepHeader: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  stepTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stepTitle: { color: colors.onSurface, fontSize: 21, fontWeight: "900" },
  iconButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  progressTrack: { height: 4, borderRadius: radius.pill, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  progressFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  advanced: { borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  advancedHeader: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  advancedTitle: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "850" as never },
  advancedContent: { padding: spacing.md, paddingTop: 0, gap: spacing.md },
  stickyBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceElevated, borderTopWidth: 1, borderTopColor: colors.border, ...(Platform.OS === "web" ? ({ position: "sticky", bottom: 0, zIndex: zIndex.navigation } as never) : {}) },
  primaryButton: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  primaryText: { color: colors.onBrandPrimary, fontWeight: "900", fontSize: 12 },
  secondaryButton: { minHeight: 50, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  secondaryText: { color: colors.onSurfaceSecondary, fontWeight: "850" as never, fontSize: 12 },
  disabled: { opacity: 0.45 },
  fabLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: zIndex.navigation },
  fab: { position: "absolute", right: spacing.lg, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, ...(Platform.OS === "web" ? ({ boxShadow: "0 12px 30px rgba(0,0,0,.35)" } as never) : { elevation: 14 }) },
  fabPhone: { width: 52, paddingHorizontal: 0 },
  fabText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "900" },
  actionOverlay: { flex: 1, justifyContent: "flex-end", padding: spacing.md, backgroundColor: colors.overlay },
  actionSheet: { width: "100%", maxWidth: 560, alignSelf: "center", padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceElevated },
  sheetHandle: { width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.sm },
  sheetTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", marginBottom: spacing.xs },
  actionItem: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  actionIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: withAlpha(colors.brandPrimary, 0.12) },
  searchBlock: { gap: spacing.sm },
  searchField: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong },
  searchInput: { flex: 1, minHeight: 46, color: colors.onSurface, fontSize: 13, outlineStyle: "none" } as never,
  filterRow: { gap: spacing.xs, paddingRight: spacing.lg },
  stateCard: { padding: spacing.xl, alignItems: "center", gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  errorState: { borderWidth: 1, borderColor: withAlpha(colors.error, 0.45) },
  loadingHeading: { flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "stretch", marginBottom: spacing.sm },
  stateIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary },
  stateTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", textAlign: "center" },
  stateText: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 17, textAlign: "center", maxWidth: 460 },
  skeleton: { width: "100%", height: 14, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, opacity: 0.7 },
  inlineAction: { minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: withAlpha(colors.brandPrimary, 0.12) },
  inlineActionText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
});
