import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCloudStatus, resendConfirmation, sendPasswordReset, signInToCloud, signOutFromCloud, signUpForCloud,
  subscribeCloudStatus, updateCloudPassword, type CloudStatus,
} from "../src/cloud/cloudSync";
import { authErrorMessage, normalizeEmail } from "../src/cloud/authFlow";
import { completeOnboarding } from "../src/store/onboardingStore";
import { colors, radius, spacing, withAlpha } from "../src/theme";
import { useAppTheme } from "../src/components/ThemeProvider";

type AuthMode = "signin" | "signup" | "forgot";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const params = useLocalSearchParams<{ onboarding?: string; auth_callback?: string; recovery?: string; mode?: string }>();
  const [mode, setMode] = useState<AuthMode>(params.mode === "signup" ? "signup" : "signin");
  const [cloud, setCloud] = useState<CloudStatus>(getCloudStatus());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const submitLock = useRef(false);
  const { preference, setPreference } = useAppTheme();

  useEffect(() => subscribeCloudStatus(setCloud), []);
  const signedIn = cloud.authenticated;
  const recovering = signedIn && (cloud.passwordRecovery || params.recovery === "1");

  const finish = useCallback(async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  }, [router]);

  useEffect(() => {
    if (params.auth_callback === "1" && signedIn && cloud.readyForData && !recovering) void finish();
  }, [params.auth_callback, signedIn, cloud.readyForData, recovering, finish]);

  const changeMode = (next: AuthMode) => { setMode(next); setNotice(null); setPassword(""); setShowPassword(false); };

  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true; setBusy(true); setNotice(null);
    try {
      if (recovering) {
        if (password.length < 6) throw new Error("Password should be at least 6 characters");
        await updateCloudPassword(password); setPassword(""); router.replace("/conta");
        setNotice("Senha atualizada. Você já pode usar o UrsoFit.");
      } else if (mode === "forgot") {
        if (!normalizeEmail(email).includes("@")) throw new Error("Informe um e-mail válido.");
        await sendPasswordReset(email);
        setNotice("Se esta conta existir, enviaremos um link de recuperação para seu e-mail.");
      } else if (mode === "signin") {
        await signInToCloud(email, password); await finish();
      } else {
        const result = await signUpForCloud(email, password);
        if (!result.needsEmailConfirmation) await finish();
        else setNotice("Conta criada. Confirme o link enviado ao seu e-mail antes de entrar.");
      }
    } catch (error) { setNotice(authErrorMessage(error)); }
    finally { setBusy(false); submitLock.current = false; }
  };

  const resend = async () => {
    if (submitLock.current) return;
    submitLock.current = true; setBusy(true); setNotice(null);
    try { await resendConfirmation(email || cloud.email || ""); setNotice("Se a conta aguarda confirmação, um novo link será enviado."); }
    catch (error) { setNotice(authErrorMessage(error)); }
    finally { setBusy(false); submitLock.current = false; }
  };

  const title = recovering ? "Crie uma nova senha" : signedIn ? "Sua caverna está conectada" : mode === "signup" ? "Comece seu ritmo" : mode === "forgot" ? "Recupere seu acesso" : "Que bom ter você de volta";
  const description = signedIn ? `Conectado como ${cloud.email}` : mode === "signup" ? "Uma conta sincroniza seu progresso entre iPhone, iPad e computador." : mode === "forgot" ? "Enviaremos um link seguro para o seu e-mail." : "Entre para continuar de onde parou.";

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.viewport, desktop && styles.viewportDesktop, { paddingTop: Math.max(insets.top, spacing.lg), paddingBottom: Math.max(insets.bottom, spacing.lg) }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.visual, desktop && styles.visualDesktop]}>
          <Pressable accessibilityRole="button" style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Voltar"><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
          <View style={styles.brandRow}><View style={styles.brandMark}><MaterialDesignIcons name="paw" size={21} color={colors.onBrandPrimary} /></View><Text style={styles.brand}>UrsoFit</Text></View>
          <Image source={require("../assets/images/mascot-whey.jpg")} style={[styles.mascot, desktop && styles.mascotDesktop]} accessibilityLabel="Mascote do UrsoFit com shaker" />
          {desktop ? <><Text style={styles.visualTitle}>Constância cabe na sua rotina.</Text><Text style={styles.visualText}>Dieta, água, treino e conquistas reunidos com clareza — sem culpa e sem ruído.</Text></> : null}
        </View>

        <View style={[styles.panel, desktop && styles.panelDesktop]}>
          <View style={styles.panelTop}>
            <View style={styles.panelHeading}><Text style={styles.eyebrow}>CONTA URSOFIT</Text><Text style={styles.title}>{title}</Text></View>
            <View style={styles.themeToggle}>
              {(["emo", "gratiluz"] as const).map((theme) => <Pressable key={theme} accessibilityRole="radio" accessibilityState={{ checked: preference === theme }} accessibilityLabel={`Tema ${theme === "emo" ? "Emo" : "Gratiluz"}`} onPress={() => void setPreference(theme)} style={[styles.themeButton, preference === theme && styles.themeButtonActive]} testID={`auth-theme-${theme}`}><MaterialDesignIcons name={theme === "emo" ? "weather-night" : "white-balance-sunny"} size={16} color={preference === theme ? colors.onBrandPrimary : colors.onSurfaceTertiary} /></Pressable>)}
            </View>
          </View>
          <Text style={styles.description}>{description}</Text>

          {!cloud.configured ? <Notice text="Sincronização ainda não configurada neste build." /> : null}
          {signedIn && !recovering ? (
            <View style={styles.signedCard} testID="account-connected-card">
              <View style={styles.connectedIcon}><MaterialDesignIcons name="cloud-check" size={29} color={colors.brandPrimary} /></View>
              <Text style={styles.connectedTitle}>Tudo pronto</Text>
              <Text style={styles.connectedText}>Planos, refeições, água, XP, conquistas e aparência serão sincronizados.</Text>
              <Pressable accessibilityRole="button" style={[styles.primaryButton, !cloud.readyForData && styles.disabled]} disabled={!cloud.readyForData} onPress={finish}><Text style={styles.primaryText}>{cloud.readyForData ? "Ir para o UrsoFit" : "Preparando seus dados…"}</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => void signOutFromCloud()}><Text style={styles.linkText}>Sair desta conta</Text></Pressable>
            </View>
          ) : (
            <View style={styles.form} testID="account-auth-form">
              {!recovering && mode !== "forgot" ? <View style={styles.segmented} accessibilityRole="tablist">
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "signin" }} style={[styles.segment, mode === "signin" && styles.segmentActive]} onPress={() => changeMode("signin")} testID="auth-mode-signin"><Text style={[styles.segmentText, mode === "signin" && styles.segmentTextActive]}>Entrar</Text></Pressable>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "signup" }} style={[styles.segment, mode === "signup" && styles.segmentActive]} onPress={() => changeMode("signup")} testID="auth-mode-signup"><Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Criar conta</Text></Pressable>
              </View> : null}

              {!recovering ? <Field icon="email-outline"><TextInput style={styles.input} placeholder="Seu e-mail" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" accessibilityLabel="E-mail" testID="account-email-input" /></Field> : null}
              {mode !== "forgot" || recovering ? <Field icon="lock-outline"><TextInput style={styles.input} placeholder={recovering ? "Nova senha (mínimo 6 caracteres)" : "Senha (mínimo 6 caracteres)"} placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoComplete={mode === "signup" || recovering ? "new-password" : "current-password"} textContentType={mode === "signup" || recovering ? "newPassword" : "password"} accessibilityLabel={recovering ? "Nova senha" : "Senha"} testID="account-password-input" /><Pressable accessibilityRole="button" style={styles.eye} onPress={() => setShowPassword((value) => !value)} accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"} testID="account-password-toggle"><MaterialDesignIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={colors.onSurfaceTertiary} /></Pressable></Field> : null}

              <Pressable accessibilityRole="button" style={[styles.primaryButton, (busy || (!recovering && !email.trim()) || ((mode !== "forgot" || recovering) && password.length < 6)) && styles.disabled]} disabled={busy || (!recovering && !email.trim()) || ((mode !== "forgot" || recovering) && password.length < 6)} onPress={() => void submit()} testID="account-submit-btn">
                {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <><Text style={styles.primaryText}>{recovering ? "Salvar nova senha" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar minha conta" : "Enviar link de recuperação"}</Text><MaterialDesignIcons name="arrow-right" size={18} color={colors.onBrandPrimary} /></>}
              </Pressable>

              {!recovering ? <View style={styles.extraActions}>
                <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => changeMode(mode === "forgot" ? "signin" : "forgot")} testID="auth-forgot-link"><Text style={styles.linkText}>{mode === "forgot" ? "Voltar ao login" : "Esqueci minha senha"}</Text></Pressable>
                {mode !== "forgot" ? <Pressable accessibilityRole="button" style={styles.linkButton} disabled={busy || !(email.trim() || cloud.email)} onPress={() => void resend()} testID="auth-resend-link"><Text style={styles.linkText}>Reenviar confirmação</Text></Pressable> : null}
              </View> : null}
              {notice || cloud.phase === "confirmation_required" ? <Notice text={notice ?? cloud.message ?? "Confira seu e-mail."} /> : null}
              <View style={styles.privacyRow}><MaterialDesignIcons name="shield-check-outline" size={18} color={colors.brandPrimary} /><Text style={styles.privacy}>Seus dados são privados e cada conta acessa somente os próprios registros.</Text></View>
            </View>
          )}

          {params.onboarding === "1" && !signedIn ? <Pressable accessibilityRole="button" style={styles.offlineButton} onPress={finish}><Text style={styles.offlineText}>Continuar sem conta por enquanto</Text></Pressable> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <View style={styles.field}><MaterialDesignIcons name={icon as never} size={20} color={colors.onSurfaceTertiary} />{children}</View>;
}

function Notice({ text }: { text: string }) {
  return <View style={styles.noticeBox} accessibilityRole="alert"><MaterialDesignIcons name="information-outline" size={18} color={colors.brandTertiary} /><Text style={styles.notice}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  viewport: { flexGrow: 1, width: "100%", maxWidth: 1180, alignSelf: "center", padding: spacing.lg, gap: spacing.lg },
  viewportDesktop: { flexDirection: "row", alignItems: "stretch", padding: spacing.xl, gap: spacing.xl },
  visual: { position: "relative", minHeight: 250, overflow: "hidden", borderRadius: radius.lg, backgroundColor: withAlpha(colors.brandPrimary, 0.13), alignItems: "center", justifyContent: "center", padding: spacing.xl },
  visualDesktop: { flex: 1.05, minHeight: 680 },
  backButton: { position: "absolute", zIndex: 3, left: spacing.lg, top: spacing.lg, width: 44, height: 44, borderRadius: radius.md, backgroundColor: withAlpha(colors.surface, 0.74), alignItems: "center", justifyContent: "center" },
  brandRow: { position: "absolute", left: spacing.xl, bottom: spacing.xl, zIndex: 3, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary },
  brand: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  mascot: { width: 170, height: 170, borderRadius: 85, borderWidth: 6, borderColor: withAlpha(colors.surfaceElevated, 0.72) },
  mascotDesktop: { width: 330, height: 330, borderRadius: 165 },
  visualTitle: { color: colors.onSurface, fontSize: 32, fontWeight: "900", textAlign: "center", marginTop: spacing.xl },
  visualText: { maxWidth: 430, color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: spacing.sm },
  panel: { flex: 1, width: "100%", maxWidth: 520, alignSelf: "center", gap: spacing.lg, paddingVertical: spacing.lg },
  panelDesktop: { justifyContent: "center", paddingHorizontal: spacing.xl },
  panelTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  panelHeading: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  title: { color: colors.onSurface, fontSize: 30, lineHeight: 36, fontWeight: "900", letterSpacing: -0.7, marginTop: 4 },
  description: { color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 20, marginTop: -spacing.sm },
  themeToggle: { marginLeft: "auto", flexDirection: "row", padding: 3, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill },
  themeButton: { width: 36, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  themeButtonActive: { backgroundColor: colors.brandPrimary },
  form: { width: "100%", gap: spacing.md },
  segmented: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderStrong },
  segmentText: { color: colors.onSurfaceTertiary, fontWeight: "800", fontSize: 12 },
  segmentTextActive: { color: colors.onSurface },
  field: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, paddingLeft: spacing.md },
  input: { flex: 1, minHeight: 52, paddingHorizontal: spacing.xs, color: colors.onSurface, fontSize: 15, outlineStyle: "none" } as never,
  eye: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  primaryButton: { width: "100%", minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  primaryText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.48 },
  noticeBox: { width: "100%", flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, backgroundColor: withAlpha(colors.brandTertiary, 0.1), borderWidth: 1, borderColor: withAlpha(colors.brandTertiary, 0.34), borderRadius: radius.md, padding: spacing.md },
  notice: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  privacyRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.sm },
  privacy: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
  extraActions: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  linkButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.sm },
  linkText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800" },
  offlineButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  offlineText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  signedCard: { width: "100%", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: withAlpha(colors.brandPrimary, 0.42), borderRadius: radius.lg, padding: spacing.xl },
  connectedIcon: { width: 62, height: 62, borderRadius: radius.pill, backgroundColor: withAlpha(colors.brandPrimary, 0.13), alignItems: "center", justifyContent: "center" },
  connectedTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  connectedText: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
});
