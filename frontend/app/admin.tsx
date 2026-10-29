import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { archiveAppEvent, getAccessProfile, listAdminEvents, loadAppConfig, saveAppConfig, saveAppEvent } from "../src/admin/service";
import { DEFAULT_APP_CONFIG, type AppConfig, type AppEvent, type AppEventInput } from "../src/admin/types";
import { AreaDashboardHeader } from "../src/components/AreaDashboard";
import { useResponsiveLayout } from "../src/responsive";
import { colors, flatColors, layout, radius, spacing, withAlpha } from "../src/theme";

type LoadState = "loading" | "ready" | "denied" | "error";

const blankEvent = (): AppEventInput => {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000); start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { title: "", description: "", startsAt: toInputDate(start), endsAt: toInputDate(end), accentColor: "#B7FF2A", ctaLabel: "Ver detalhes", ctaRoute: "/", status: "draft" };
};

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsiveLayout();
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [draft, setDraft] = useState<AppEventInput>(blankEvent);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNotice(null);
    try {
      const access = await getAccessProfile();
      if (!access.authenticated || access.role !== "admin") { setLoadState("denied"); return; }
      const [nextEvents, nextConfig] = await Promise.all([listAdminEvents(), loadAppConfig()]);
      setEvents(nextEvents); setConfig(nextConfig); setLoadState("ready");
    } catch (error) { setNotice(messageOf(error)); setLoadState("error"); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const submitEvent = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      await saveAppEvent({ ...draft, startsAt: fromInputDate(draft.startsAt), endsAt: fromInputDate(draft.endsAt) }, editingId);
      setDraft(blankEvent()); setEditingId(undefined); setNotice(editingId ? "Evento atualizado." : "Evento criado.");
      setEvents(await listAdminEvents());
    } catch (error) { setNotice(messageOf(error)); }
    finally { setBusy(false); }
  };

  const editEvent = (event: AppEvent) => {
    setEditingId(event.id);
    setDraft({ title: event.title, description: event.description, startsAt: toInputDate(new Date(event.startsAt)), endsAt: toInputDate(new Date(event.endsAt)), accentColor: event.accentColor, ctaLabel: event.ctaLabel, ctaRoute: event.ctaRoute, status: event.status });
  };

  const archive = async (id: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await archiveAppEvent(id); setEvents(await listAdminEvents()); setNotice("Evento arquivado."); }
    catch (error) { setNotice(messageOf(error)); }
    finally { setBusy(false); }
  };

  const persistConfig = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { setConfig(await saveAppConfig(config)); setNotice("Configurações do aplicativo atualizadas."); }
    catch (error) { setNotice(messageOf(error)); }
    finally { setBusy(false); }
  };

  if (loadState === "loading") return <Centered><ActivityIndicator color={colors.brandPrimary} size="large" /><Text style={styles.muted}>Verificando acesso administrativo…</Text></Centered>;
  if (loadState === "denied") return <Centered><MaterialDesignIcons name="shield-lock-outline" size={48} color={colors.brandTertiary} /><Text style={styles.deniedTitle}>Área administrativa</Text><Text style={styles.muted}>Esta conta possui o perfil de usuário comum. Entre com uma conta administradora para continuar.</Text><Pressable style={styles.secondaryButton} onPress={() => router.replace("/perfil")}><Text style={styles.secondaryText}>Voltar ao perfil</Text></Pressable></Centered>;
  if (loadState === "error") return <Centered><Text style={styles.deniedTitle}>Não foi possível abrir o painel</Text><Text style={styles.muted}>{notice}</Text><Pressable style={styles.primaryButton} onPress={() => void load()}><Text style={styles.primaryText}>Tentar novamente</Text></Pressable></Centered>;

  return <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }]} testID="admin-screen">
    <AreaDashboardHeader title="Administração" subtitle="Eventos e configurações editoriais do UrsoFit" accent={flatColors.lime} onBack={() => router.back()} onSettings={() => router.push("/perfil")} settingsIcon="account-circle-outline" settingsLabel="Voltar ao perfil" actions={[]} />
    {notice ? <View style={styles.notice}><MaterialDesignIcons name="information-outline" size={18} color={colors.brandTertiary} /><Text style={styles.noticeText}>{notice}</Text></View> : null}

    <View style={[styles.columns, !isDesktop && styles.columnsMobile]}>
      <View style={styles.column}>
        <View style={styles.card} testID="admin-event-editor">
          <View style={styles.cardHeading}><View><Text style={styles.eyebrow}>CONTEÚDO DO APP</Text><Text style={styles.cardTitle}>{editingId ? "Editar evento" : "Novo evento"}</Text></View><View style={[styles.roleBadge]}><MaterialDesignIcons name="shield-crown-outline" size={16} color={colors.brandPrimary} /><Text style={styles.roleText}>ADMIN</Text></View></View>
          <Field label="Título"><TextInput style={styles.input} value={draft.title} onChangeText={(title) => setDraft((current) => ({ ...current, title }))} placeholder="Ex.: Desafio de novembro" placeholderTextColor={colors.muted} maxLength={80} /></Field>
          <Field label="Descrição"><TextInput style={[styles.input, styles.multiline]} value={draft.description} onChangeText={(description) => setDraft((current) => ({ ...current, description }))} placeholder="Explique o evento em poucas linhas" placeholderTextColor={colors.muted} multiline maxLength={500} /></Field>
          <View style={styles.fieldRow}><Field label="Início"><TextInput style={styles.input} value={draft.startsAt} onChangeText={(startsAt) => setDraft((current) => ({ ...current, startsAt }))} placeholder="2026-11-01 08:00" placeholderTextColor={colors.muted} /></Field><Field label="Fim"><TextInput style={styles.input} value={draft.endsAt} onChangeText={(endsAt) => setDraft((current) => ({ ...current, endsAt }))} placeholder="2026-11-08 23:59" placeholderTextColor={colors.muted} /></Field></View>
          <View style={styles.fieldRow}><Field label="Cor do evento"><TextInput style={styles.input} value={draft.accentColor} autoCapitalize="characters" onChangeText={(accentColor) => setDraft((current) => ({ ...current, accentColor }))} placeholder="#B7FF2A" placeholderTextColor={colors.muted} /></Field><View style={[styles.colorPreview, { backgroundColor: draft.accentColor }]} /></View>
          <View style={styles.fieldRow}><Field label="Texto do botão"><TextInput style={styles.input} value={draft.ctaLabel ?? ""} onChangeText={(ctaLabel) => setDraft((current) => ({ ...current, ctaLabel }))} placeholder="Participar" placeholderTextColor={colors.muted} /></Field><Field label="Rota interna"><TextInput style={styles.input} value={draft.ctaRoute ?? ""} autoCapitalize="none" onChangeText={(ctaRoute) => setDraft((current) => ({ ...current, ctaRoute }))} placeholder="/desafios" placeholderTextColor={colors.muted} /></Field></View>
          <View style={styles.toggle}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>Publicado</Text><Text style={styles.toggleHint}>Usuários verão o evento assim que ele for salvo.</Text></View><Switch value={draft.status === "published"} onValueChange={(published) => setDraft((current) => ({ ...current, status: published ? "published" : "draft" }))} trackColor={{ true: colors.brandPrimary }} /></View>
          <View style={styles.actions}>{editingId ? <Pressable style={styles.secondaryButton} onPress={() => { setEditingId(undefined); setDraft(blankEvent()); }}><Text style={styles.secondaryText}>Cancelar edição</Text></Pressable> : null}<Pressable disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void submitEvent()}>{busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>{editingId ? "Salvar alterações" : "Criar evento"}</Text>}</Pressable></View>
        </View>

        <View style={styles.card} testID="admin-app-settings">
          <Text style={styles.eyebrow}>APARÊNCIA E AVISO</Text><Text style={styles.cardTitle}>Configurações globais</Text>
          <Field label="Cor principal da versão web"><TextInput style={styles.input} value={config.brandAccent} autoCapitalize="characters" onChangeText={(brandAccent) => setConfig((current) => ({ ...current, brandAccent }))} placeholder="#B7FF2A" placeholderTextColor={colors.muted} /></Field>
          <Field label="Aviso na Home"><TextInput style={[styles.input, styles.multilineSmall]} value={config.announcementMessage} onChangeText={(announcementMessage) => setConfig((current) => ({ ...current, announcementMessage }))} placeholder="Deixe vazio para não exibir aviso." placeholderTextColor={colors.muted} multiline maxLength={160} /></Field>
          <Pressable disabled={busy} style={[styles.primaryButton, busy && styles.disabled]} onPress={() => void persistConfig()}><Text style={styles.primaryText}>Aplicar configurações</Text></Pressable>
        </View>
      </View>

      <View style={styles.column}>
        <View style={styles.card}><View style={styles.cardHeading}><View><Text style={styles.eyebrow}>AGENDA EDITORIAL</Text><Text style={styles.cardTitle}>Eventos</Text></View><Text style={styles.counter}>{events.length}</Text></View>
          {events.length ? events.map((event) => <View key={event.id} style={styles.eventCard} testID={`admin-event-${event.id}`}>
            <View style={[styles.eventAccent, { backgroundColor: event.accentColor }]} />
            <View style={styles.eventBody}><View style={styles.eventTop}><Text style={styles.eventTitle}>{event.title}</Text><Text style={[styles.status, event.status === "published" && styles.statusPublished]}>{event.status === "published" ? "PUBLICADO" : event.status === "draft" ? "RASCUNHO" : "ARQUIVADO"}</Text></View><Text style={styles.eventDate}>{formatPeriod(event.startsAt, event.endsAt)}</Text><Text style={styles.eventDescription} numberOfLines={3}>{event.description || "Sem descrição."}</Text><View style={styles.actions}><Pressable style={styles.smallButton} onPress={() => editEvent(event)}><MaterialDesignIcons name="pencil-outline" size={17} color={colors.onSurface} /><Text style={styles.smallButtonText}>Editar</Text></Pressable>{event.status !== "archived" ? <Pressable style={styles.smallButton} onPress={() => void archive(event.id)}><MaterialDesignIcons name="archive-outline" size={17} color={colors.brandTertiary} /><Text style={styles.smallButtonText}>Arquivar</Text></Pressable> : null}</View></View>
          </View>) : <View style={styles.empty}><MaterialDesignIcons name="calendar-star" size={36} color={colors.onSurfaceTertiary} /><Text style={styles.muted}>Nenhum evento criado ainda.</Text></View>}
        </View>
      </View>
    </View>
  </ScrollView>;
}

function Centered({ children }: { children: React.ReactNode }) { return <View style={styles.center}>{children}</View>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
function messageOf(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }
function toInputDate(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16).replace("T", " "); }
function fromInputDate(value: string) { return new Date(value.trim().replace(" ", "T")).toISOString(); }
function formatPeriod(start: string, end: string) { const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, content: { width: "100%", maxWidth: layout.contentMax, alignSelf: "center", paddingHorizontal: spacing.lg, gap: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl, backgroundColor: colors.surface }, deniedTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "900", textAlign: "center" }, muted: { maxWidth: 440, color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  columns: { flexDirection: "row", alignItems: "flex-start", gap: spacing.lg }, columnsMobile: { flexDirection: "column" }, column: { flex: 1, width: "100%", gap: spacing.lg },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }, cardHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, eyebrow: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }, cardTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: withAlpha(colors.brandPrimary, 0.12) }, roleText: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  field: { flex: 1, minWidth: 0, gap: 6 }, fieldRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }, label: { color: colors.onSurfaceTertiary, fontSize: 9, fontWeight: "800" }, input: { minHeight: 46, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, color: colors.onSurface, outlineStyle: "none" } as never, multiline: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: "top" }, multilineSmall: { minHeight: 70, paddingTop: spacing.md, textAlignVertical: "top" }, colorPreview: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong },
  toggle: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, toggleCopy: { flex: 1 }, toggleTitle: { color: colors.onSurface, fontSize: 12, fontWeight: "800" }, toggleHint: { color: colors.onSurfaceTertiary, fontSize: 9, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, primaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary }, primaryText: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "900" }, secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, secondaryText: { color: colors.onSurface, fontSize: 11, fontWeight: "800" }, disabled: { opacity: 0.48 },
  notice: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: withAlpha(colors.brandTertiary, 0.12) }, noticeText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 11, lineHeight: 16 }, counter: { color: colors.brandPrimary, fontSize: 18, fontWeight: "900" },
  eventCard: { overflow: "hidden", flexDirection: "row", borderRadius: radius.md, backgroundColor: colors.surfaceTertiary }, eventAccent: { width: 6 }, eventBody: { flex: 1, gap: spacing.xs, padding: spacing.md }, eventTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, eventTitle: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "900" }, status: { color: colors.onSurfaceTertiary, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 }, statusPublished: { color: colors.brandPrimary }, eventDate: { color: colors.onSurfaceTertiary, fontSize: 9 }, eventDescription: { color: colors.onSurfaceSecondary, fontSize: 10, lineHeight: 15 }, smallButton: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceInteractive }, smallButtonText: { color: colors.onSurface, fontSize: 9, fontWeight: "800" }, empty: { minHeight: 150, alignItems: "center", justifyContent: "center", gap: spacing.sm },
});
