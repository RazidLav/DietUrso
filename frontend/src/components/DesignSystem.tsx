import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion, useResponsiveLayout } from "../responsive";
import { colors, layout, radius, spacing, typeScale, withAlpha, zIndex } from "../theme";

export function ContentContainer({ children, style, maxWidth = layout.contentMax }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; maxWidth?: number }) {
  return <View style={[styles.content, { maxWidth }, style]}>{children}</View>;
}

export function PageHeader({ eyebrow, title, description, onBack, action }: { eyebrow?: string; title: string; description?: string; onBack?: () => void; action?: React.ReactNode }) {
  const { isPhone } = useResponsiveLayout();
  return <View style={[styles.pageHeader, isPhone && styles.pageHeaderPhone]}>
    {onBack ? <IconButton icon="arrow-left" label="Voltar" onPress={onBack} /> : null}
    <View style={styles.headerCopy}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.pageTitle}>{title}</Text>
      {description ? <Text style={styles.pageDescription}>{description}</Text> : null}
    </View>
    {action ? <View style={styles.headerAction}>{action}</View> : null}
  </View>;
}

export function SurfaceCard({ children, density = "standard", bordered = false, style }: { children: React.ReactNode; density?: "compact" | "standard" | "spacious"; bordered?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.surfaceCard, density === "compact" && styles.surfaceCardCompact, density === "spacious" && styles.surfaceCardSpacious, bordered && styles.surfaceCardBordered, style]}>{children}</View>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <View style={styles.sectionHeader}>
    <View style={styles.headerCopy}><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>{description ? <Text style={styles.sectionDescription}>{description}</Text> : null}</View>
    {action}
  </View>;
}

export function ResponsiveGrid({ children, minItemWidth = 280, maxColumns = 3, gap = spacing.md, singleColumnOnPhone = true }: { children: React.ReactNode; minItemWidth?: number; maxColumns?: number; gap?: number; singleColumnOnPhone?: boolean }) {
  const { width, isPhone } = useResponsiveLayout();
  const [containerWidth, setContainerWidth] = useState(0);
  const available = containerWidth || Math.max(0, Math.min(width, layout.contentMax) - spacing.lg * 2);
  const fluidColumns = Math.max(1, Math.min(maxColumns, Math.floor((available + gap) / (minItemWidth + gap))));
  const columns = isPhone && singleColumnOnPhone ? 1 : fluidColumns;
  const itemWidth = columns === 1 ? "100%" : Math.floor((available - gap * (columns - 1)) / columns);
  return <View onLayout={(event) => setContainerWidth(Math.round(event.nativeEvent.layout.width))} style={[styles.grid, { gap }]}>{React.Children.map(children, (child, index) => <View key={index} style={{ width: itemWidth, maxWidth: itemWidth }}>{child}</View>)}</View>;
}

export function CompactCard({ children, onPress, selected, style, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; selected?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const cardStyle = [styles.compactCard, selected && styles.compactCardSelected, style];
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>{children}</Pressable> : <View style={cardStyle}>{children}</View>;
}

export function SummaryCard({ label, value, hint, icon, accent = colors.brandPrimary, style, compact = false }: { label: string; value: string; hint?: string; icon?: string; accent?: string; style?: StyleProp<ViewStyle>; compact?: boolean }) {
  return <View style={[styles.summaryCard, compact && styles.summaryCardCompact, style]}>
    <View style={styles.summaryTop}>{icon ? <MaterialDesignIcons name={icon as never} size={compact ? 15 : 18} color={accent} /> : null}<Text numberOfLines={1} style={[styles.summaryLabel, compact && styles.summaryLabelCompact]}>{label}</Text></View>
    <Text style={[styles.summaryValue, compact && styles.summaryValueCompact]}>{value}</Text>
    {hint ? <Text style={styles.summaryHint}>{hint}</Text> : null}
  </View>;
}

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "primary" | "success" | "warning" | "error" | "info" }) {
  const toneColor = tone === "primary" ? colors.brandPrimary : tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "error" ? colors.error : tone === "info" ? colors.info : colors.onSurfaceTertiary;
  return <View style={[styles.statusBadge, { backgroundColor: withAlpha(toneColor, 0.13) }]}><View style={[styles.statusDot, { backgroundColor: toneColor }]} /><Text style={[styles.statusText, { color: toneColor }]}>{label}</Text></View>;
}

export function SegmentedControl<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; icon?: string }[]; onChange: (value: T) => void; label: string }) {
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segmented}>{options.map((option) => {
    const selected = option.value === value;
    return <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={[styles.segment, selected && styles.segmentSelected]}>
      {option.icon ? <MaterialDesignIcons name={option.icon as never} size={17} color={selected ? colors.onBrandPrimary : colors.onSurfaceTertiary} /> : null}
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
    </Pressable>;
  })}</View>;
}

export function FilterChip({ label, active = true, onPress, onRemove }: { label: string; active?: boolean; onPress?: () => void; onRemove?: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress ?? onRemove} style={[styles.filterChip, active && styles.filterChipActive]}>
    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    {onRemove ? <MaterialDesignIcons name="close" size={15} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} /> : null}
  </Pressable>;
}

export function IconButton({ icon, label, onPress, selected = false }: { icon: string; label: string; onPress: () => void; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.iconButton, selected && styles.iconButtonSelected, pressed && styles.pressed]}><MaterialDesignIcons name={icon as never} size={21} color={selected ? colors.onBrandPrimary : colors.onSurface} /></Pressable>;
}

export function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon?: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}>{icon ? <MaterialDesignIcons name={icon as never} size={18} color={colors.onBrandPrimary} /> : null}<Text style={styles.primaryText}>{label}</Text></Pressable>;
}

export function ResponsiveSheet({ visible, title, description, onClose, children, width = 440 }: { visible: boolean; title: string; description?: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  const insets = useSafeAreaInsets();
  const { isPhone } = useResponsiveLayout();
  const reducedMotion = useReducedMotion();
  return <Modal visible={visible} transparent animationType={reducedMotion ? "none" : "fade"} onRequestClose={onClose}>
    <View style={[styles.sheetOverlay, isPhone ? styles.sheetOverlayPhone : styles.sheetOverlayWide]}>
      <Pressable accessibilityLabel="Fechar painel" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.sheet, isPhone ? [styles.sheetPhone, { paddingBottom: Math.max(insets.bottom, spacing.lg) }] : [styles.sheetWide, { width }]]}>
        {isPhone ? <View style={styles.sheetHandle} /> : null}
        <View style={styles.sheetHeader}><View style={styles.headerCopy}><Text style={styles.sheetTitle}>{title}</Text>{description ? <Text style={styles.sheetDescription}>{description}</Text> : null}</View><IconButton icon="close" label="Fechar" onPress={onClose} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  content: { width: "100%", alignSelf: "center", paddingHorizontal: spacing.lg },
  pageHeader: { minHeight: 44, flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pageHeaderPhone: { gap: spacing.sm },
  headerCopy: { flex: 1, minWidth: 0 },
  headerAction: { flexShrink: 0 },
  eyebrow: { color: colors.brandPrimary, fontSize: typeScale.caption.fontSize, lineHeight: typeScale.caption.lineHeight, fontWeight: "850" as never, letterSpacing: 0.9 },
  pageTitle: { color: colors.onSurface, fontSize: typeScale.pageTitle.fontSize, lineHeight: typeScale.pageTitle.lineHeight, fontWeight: "900" },
  pageDescription: { color: colors.onSurfaceTertiary, fontSize: typeScale.body.fontSize, lineHeight: typeScale.body.lineHeight, marginTop: spacing.xs, maxWidth: layout.readingMax },
  sectionHeader: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionTitle: { color: colors.onSurface, fontSize: typeScale.sectionTitle.fontSize, lineHeight: typeScale.sectionTitle.lineHeight, fontWeight: "850" as never },
  sectionDescription: { color: colors.onSurfaceTertiary, fontSize: typeScale.secondary.fontSize, lineHeight: typeScale.secondary.lineHeight, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  compactCard: { minHeight: 64, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  compactCardSelected: { backgroundColor: withAlpha(colors.brandPrimary, 0.09), borderWidth: 1, borderColor: withAlpha(colors.brandPrimary, 0.42) },
  surfaceCard: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  surfaceCardCompact: { padding: spacing.md },
  surfaceCardSpacious: { padding: spacing.xl, borderRadius: radius.lg },
  surfaceCardBordered: { borderWidth: 1, borderColor: colors.border },
  summaryCard: { minHeight: 74, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  summaryCardCompact: { minHeight: 66, padding: spacing.sm },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  summaryLabel: { color: colors.onSurfaceTertiary, fontSize: typeScale.caption.fontSize, fontWeight: "750" as never },
  summaryLabelCompact: { fontSize: 9 },
  summaryValue: { color: colors.onSurface, fontSize: typeScale.metric.fontSize, lineHeight: typeScale.metric.lineHeight, fontWeight: "900", marginTop: spacing.xs },
  summaryValueCompact: { fontSize: 20, lineHeight: 24, marginTop: 3 },
  summaryHint: { color: colors.onSurfaceTertiary, fontSize: typeScale.caption.fontSize, lineHeight: typeScale.caption.lineHeight, marginTop: 2 },
  statusBadge: { alignSelf: "flex-start", minHeight: 24, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: "850" as never },
  segmented: { flexDirection: "row", gap: spacing.xxs, padding: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  segment: { flex: 1, minHeight: layout.touchTarget, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "750" as never },
  segmentTextSelected: { color: colors.onBrandPrimary, fontWeight: "900" },
  filterChip: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive },
  filterChipActive: { backgroundColor: colors.brandPrimary },
  filterChipText: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "750" as never },
  filterChipTextActive: { color: colors.onBrandPrimary, fontWeight: "900" },
  iconButton: { width: layout.touchTarget, height: layout.touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.surfaceInteractive },
  iconButtonSelected: { backgroundColor: colors.brandPrimary },
  primaryButton: { minHeight: layout.control, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  primaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" },
  sheetOverlay: { flex: 1, backgroundColor: colors.overlay, zIndex: zIndex.modal },
  sheetOverlayPhone: { justifyContent: "flex-end" },
  sheetOverlayWide: { alignItems: "flex-end" },
  sheet: { backgroundColor: colors.surfaceElevated, ...(Platform.OS === "web" ? ({ boxShadow: "0 24px 64px rgba(0,0,0,.35)" } as never) : { elevation: 18 }) },
  sheetPhone: { width: "100%", maxHeight: "88%", padding: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetWide: { height: "100%", maxWidth: "92%", padding: spacing.xl },
  sheetHandle: { width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  sheetTitle: { color: colors.onSurface, fontSize: 21, lineHeight: 27, fontWeight: "900" },
  sheetDescription: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.xl },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.45 },
});
