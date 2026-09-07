import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatHydrationVolume } from "../src/hydration/calculations";
import type { HydrationContainer, HydrationState } from "../src/hydration/types";
import { getHydrationState, moveHydrationContainer, saveHydrationContainer, setHydrationContainerArchived, toggleHydrationContainerFavorite } from "../src/store/hydrationStore";
import { colors, radius, spacing } from "../src/theme";

const ICONS = ["cup-water", "bottle-soda-classic-outline", "bottle-tonic-outline", "shaker-outline"];
const COLORS = [colors.brandSecondary, colors.brandPrimary, colors.brandTertiary, "#BF5AF2", "#FF5E7A"];

export default function HydrationContainersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<HydrationState | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Partial<HydrationContainer> | null>(null);
  const [name, setName] = useState("");
  const [volume, setVolume] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => setState(await getHydrationState()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openEditor = (item?: HydrationContainer) => { setEditing(item ?? {}); setName(item?.name ?? ""); setVolume(item ? String(item.volumeMl) : ""); setIcon(item?.icon ?? ICONS[0]); setColor(item?.color ?? COLORS[0]); setError(null); };
  const perform = async (operation: () => Promise<unknown>) => { setSaving(true); setError(null); try { await operation(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); } finally { setSaving(false); } };
  const save = async () => {
    const volumeMl = Number(volume.replace(",", "."));
    if (!name.trim() || !Number.isFinite(volumeMl) || volumeMl <= 0) { setError("Informe nome e volume válidos."); return; }
    await perform(() => saveHydrationContainer({ ...editing, name, volumeMl, icon, color }));
    setEditing(null);
  };

  if (!state) return <View style={styles.loading}><ActivityIndicator color={colors.brandSecondary} size="large" /></View>;
  const list = state.containers.filter((item) => showArchived ? Boolean(item.archivedAt) : !item.archivedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  return <View style={styles.screen} testID="hydration-containers-screen">
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}><Pressable style={styles.iconButton} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable><View style={{ flex: 1 }}><Text style={styles.eyebrow}>HIDRATURSO</Text><Text style={styles.title}>Meus recipientes</Text></View><Pressable style={[styles.iconButton, { backgroundColor: colors.brandPrimary }]} onPress={() => openEditor()}><MaterialDesignIcons name="plus" size={22} color={colors.onBrandPrimary} /></Pressable></View>
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.md }}>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      <Text style={styles.intro}>Salve copos, garrafas e shakers. Os favoritos aparecem como atalhos na tela principal de hidratação.</Text>
      <View style={styles.tabs}><Pressable style={[styles.tab, !showArchived && styles.tabOn]} onPress={() => setShowArchived(false)}><Text style={[styles.tabText, !showArchived && styles.tabTextOn]}>Ativos</Text></Pressable><Pressable style={[styles.tab, showArchived && styles.tabOn]} onPress={() => setShowArchived(true)}><Text style={[styles.tabText, showArchived && styles.tabTextOn]}>Arquivados</Text></Pressable></View>
      {list.map((item, index) => <View key={item.id} style={styles.item}>
        <View style={[styles.itemIcon, { backgroundColor: `${item.color ?? colors.brandSecondary}22` }]}><MaterialDesignIcons name={(item.icon ?? ICONS[0]) as never} size={24} color={item.color ?? colors.brandSecondary} /></View>
        <View style={{ flex: 1 }}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemVolume}>{formatHydrationVolume(item.volumeMl)}{item.isFavorite ? " · favorito" : ""}</Text></View>
        {!showArchived ? <><Pressable style={styles.action} onPress={() => void perform(() => moveHydrationContainer(item.id, -1))} disabled={index === 0 || saving}><MaterialDesignIcons name="arrow-up" size={17} color={index === 0 ? colors.onSurfaceTertiary : colors.onSurfaceSecondary} /></Pressable><Pressable style={styles.action} onPress={() => void perform(() => moveHydrationContainer(item.id, 1))} disabled={index === list.length - 1 || saving}><MaterialDesignIcons name="arrow-down" size={17} color={index === list.length - 1 ? colors.onSurfaceTertiary : colors.onSurfaceSecondary} /></Pressable><Pressable style={styles.action} onPress={() => void perform(() => toggleHydrationContainerFavorite(item.id))}><MaterialDesignIcons name={item.isFavorite ? "star" : "star-outline"} size={18} color={item.isFavorite ? colors.brandTertiary : colors.onSurfaceSecondary} /></Pressable><Pressable style={styles.action} onPress={() => openEditor(item)}><MaterialDesignIcons name="pencil-outline" size={17} color={colors.onSurfaceSecondary} /></Pressable></> : null}
        <Pressable style={styles.action} onPress={() => void perform(() => setHydrationContainerArchived(item.id, !showArchived))}><MaterialDesignIcons name={showArchived ? "archive-arrow-up-outline" : "archive-outline"} size={18} color={showArchived ? colors.brandPrimary : colors.error} /></Pressable>
      </View>)}
      {!list.length ? <View style={styles.empty}><MaterialDesignIcons name="bottle-soda-outline" size={38} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>{showArchived ? "Nenhum recipiente arquivado" : "Crie seu primeiro recipiente"}</Text></View> : null}
    </ScrollView>
    <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditing(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>{editing?.id ? "Editar recipiente" : "Novo recipiente"}</Text><Label text="Nome"><TextInput value={name} onChangeText={setName} placeholder="Ex.: Garrafa de treino" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} /></Label><Label text="Volume em ml"><TextInput value={volume} onChangeText={setVolume} keyboardType="numeric" placeholder="Ex.: 750" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} /></Label><Text style={styles.label}>Ícone</Text><View style={styles.options}>{ICONS.map((value) => <Pressable key={value} style={[styles.option, icon === value && styles.optionOn]} onPress={() => setIcon(value)}><MaterialDesignIcons name={value as never} size={22} color={icon === value ? colors.onBrandPrimary : colors.onSurfaceSecondary} /></Pressable>)}</View><Text style={styles.label}>Cor</Text><View style={styles.options}>{COLORS.map((value) => <Pressable key={value} onPress={() => setColor(value)} style={[styles.color, { backgroundColor: value }, color === value && styles.colorOn]} />)}</View><View style={styles.modalActions}><Pressable style={styles.cancel} onPress={() => setEditing(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable disabled={saving} style={styles.save} onPress={() => void save()}><Text style={styles.saveText}>{saving ? "Salvando…" : "Salvar"}</Text></Pressable></View></View></View></Modal>
  </View>;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) { return <View><Text style={styles.label}>{text}</Text>{children}</View>; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, loading: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, iconButton: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, eyebrow: { color: colors.brandSecondary, fontSize: 9, fontWeight: "900", letterSpacing: 1.4 }, title: { color: colors.onSurface, fontSize: 22, fontWeight: "900" }, intro: { color: colors.onSurfaceTertiary, fontSize: 11, lineHeight: 17 }, error: { backgroundColor: colors.error + "18", borderRadius: radius.md, padding: spacing.md }, errorText: { color: colors.error, fontSize: 11 }, tabs: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: 3 }, tab: { flex: 1, alignItems: "center", padding: spacing.sm, borderRadius: radius.sm }, tabOn: { backgroundColor: colors.brandPrimary }, tabText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" }, tabTextOn: { color: colors.onBrandPrimary },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }, itemIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }, itemName: { color: colors.onSurface, fontSize: 13, fontWeight: "800" }, itemVolume: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 3 }, action: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }, empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm }, emptyTitle: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "#000B", alignItems: "center", justifyContent: "center", padding: spacing.lg }, modal: { width: "100%", maxWidth: 420, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }, modalTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "900" }, label: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700", marginBottom: 5 }, input: { color: colors.onSurface, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: spacing.md }, options: { flexDirection: "row", gap: spacing.sm }, option: { width: 44, height: 44, backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, alignItems: "center", justifyContent: "center" }, optionOn: { backgroundColor: colors.brandPrimary }, color: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 3, borderColor: "transparent" }, colorOn: { borderColor: colors.onSurface }, modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }, cancel: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, cancelText: { color: colors.onSurface, fontWeight: "700" }, save: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandPrimary }, saveText: { color: colors.onBrandPrimary, fontWeight: "900" },
});
