import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing, typeScale, withAlpha } from "../theme";
import type { ProgressiveAction } from "./ProgressiveUI";

export function AreaDashboardHeader({
  title,
  subtitle,
  accent,
  onBack,
  onSettings,
  settingsLabel = "Abrir configurações",
  actions,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  onBack?: () => void;
  onSettings: () => void;
  settingsLabel?: string;
  actions: ProgressiveAction[];
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const closeAndRun = (action: ProgressiveAction) => {
    setOpen(false);
    action.onPress();
  };

  return <>
    <View style={styles.header} testID="area-dashboard-header">
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.roundButton}><MaterialDesignIcons name="arrow-left" size={23} color={colors.onSurface} /></Pressable> : null}
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={settingsLabel} onPress={onSettings} style={styles.roundButton}><MaterialDesignIcons name="tune-variant" size={23} color={colors.onSurface} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar em ${title}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={[styles.roundButton, { backgroundColor: accent }]} testID="area-dashboard-add"><MaterialDesignIcons name="plus" size={27} color={colors.onBrandPrimary} /></Pressable>
      </View>
    </View>

    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable accessibilityLabel="Fechar ações" style={styles.overlay} onPress={() => setOpen(false)}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Adicionar em {title}</Text>
          {actions.map((action) => <Pressable accessibilityRole="button" key={action.id} style={styles.action} onPress={() => closeAndRun(action)}>
            <View style={[styles.actionIcon, { backgroundColor: withAlpha(accent, 0.15) }]}><MaterialDesignIcons name={action.icon as never} size={22} color={accent} /></View>
            <View style={styles.actionCopy}><Text style={styles.actionTitle}>{action.label}</Text>{action.hint ? <Text style={styles.actionHint}>{action.hint}</Text> : null}</View>
            <MaterialDesignIcons name="chevron-right" size={21} color={colors.onSurfaceTertiary} />
          </Pressable>)}
        </View>
      </Pressable>
    </Modal>
  </>;
}

export function DashboardTile({
  icon,
  label,
  value,
  hint,
  accent,
  onPress,
  style,
}: {
  icon: string;
  label: string;
  value?: string;
  hint?: string;
  accent: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const body = <>
    <View style={styles.tileTop}>
      <View style={[styles.tileIcon, { backgroundColor: withAlpha(accent, 0.16) }]}><MaterialDesignIcons name={icon as never} size={21} color={accent} /></View>
      {onPress ? <MaterialDesignIcons name="arrow-top-right" size={18} color={withAlpha(accent, 0.72)} /> : null}
    </View>
    <View style={styles.tileCopy}>
      {value ? <Text style={styles.tileValue} numberOfLines={2}>{value}</Text> : null}
      <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
      {hint ? <Text style={styles.tileHint} numberOfLines={2}>{hint}</Text> : null}
    </View>
  </>;
  const tileStyle = [styles.tile, { backgroundColor: withAlpha(accent, 0.1) }, style];
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [tileStyle, pressed && styles.pressed]}>{body}</Pressable>
    : <View style={tileStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 58 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.onSurface, fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -1.1 },
  subtitle: { color: colors.onSurfaceTertiary, ...typeScale.secondary, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  roundButton: { width: 48, height: 48, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  tile: { minHeight: 154, padding: spacing.md, borderRadius: radius.lg, justifyContent: "space-between", overflow: "hidden" },
  tileTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tileIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tileCopy: { gap: 2, marginTop: spacing.lg },
  tileValue: { color: colors.onSurface, fontSize: 25, lineHeight: 29, fontWeight: "900", letterSpacing: -0.5 },
  tileLabel: { color: colors.onSurface, fontSize: 15, lineHeight: 19, fontWeight: "800" },
  tileHint: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: { width: "100%", maxWidth: 540, alignSelf: "center", gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surfaceElevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  handle: { width: 42, height: 4, borderRadius: radius.pill, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.sm },
  sheetTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginBottom: spacing.xs },
  action: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  actionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  actionHint: { color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 14, marginTop: 2 },
});
