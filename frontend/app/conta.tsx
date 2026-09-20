import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCloudStatus,
  signInToCloud,
  signOutFromCloud,
  signUpForCloud,
  sendPasswordReset,
  resendConfirmation,
  updateCloudPassword,
  subscribeCloudStatus,
  type CloudStatus,
} from "../src/cloud/cloudSync";
import { completeOnboarding } from "../src/store/onboardingStore";
import { authErrorMessage, normalizeEmail } from "../src/cloud/authFlow";
import { colors, radius, spacing } from "../src/theme";

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { onboarding, auth_callback, recovery } = useLocalSearchParams<{ onboarding?: string; auth_callback?: string; recovery?: string }>();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [cloud, setCloud] = useState<CloudStatus>(getCloudStatus());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const submitLock = useRef(false);

  useEffect(() => subscribeCloudStatus(setCloud), []);
  const signedIn = cloud.authenticated;
  const recovering = signedIn && (cloud.passwordRecovery || recovery === "1");

  const finish = useCallback(async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  }, [router]);

  useEffect(() => {
    if (auth_callback === "1" && signedIn && cloud.readyForData && !recovering) void finish();
    // A confirmação por e-mail volta a esta rota; outras visitas mantêm o painel da conta.
  }, [auth_callback, signedIn, cloud.readyForData, recovering, finish]);

  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      if (recovering) {
        if (password.length < 6) throw new Error("Password should be at least 6 characters");
        await updateCloudPassword(password);
        setPassword("");
        router.replace("/conta");
        setNotice("Senha atualizada. Você já pode usar o UrsoFit.");
      } else if (mode === "forgot") {
        if (!normalizeEmail(email).includes("@")) throw new Error("Informe um e-mail válido.");
        await sendPasswordReset(email);
        setNotice("Se esta conta existir, enviaremos um link de recuperação para seu e-mail.");
      } else if (mode === "signin") {
        await signInToCloud(email, password);
        await finish();
      } else {
        const result = await signUpForCloud(email, password);
        if (!result.needsEmailConfirmation) await finish();
        else setNotice("Solicitação enviada. Confirme o link no seu e-mail antes de entrar. Se não chegar, tente reenviar ou recuperar a senha.");
      }
    } catch (error) {
      setNotice(authErrorMessage(error));
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  };

  const resend = async () => {
    if (submitLock.current) return;
    submitLock.current = true; setBusy(true); setNotice(null);
    try { await resendConfirmation(email || cloud.email || ""); setNotice("Se esta conta aguarda confirmação, enviaremos um novo link."); }
    catch (error) { setNotice(authErrorMessage(error)); }
    finally { setBusy(false); submitLock.current = false; }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Voltar">
          <MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} />
        </Pressable>

        <Image source={require("../assets/images/mascot-whey.jpg")} style={styles.mascot} />
        <Text style={styles.eyebrow}>SUA CONTA URSOFIT</Text>
        <Text style={styles.title}>{recovering ? "Crie uma nova senha." : signedIn ? "A caverna está conectada." : "Seu progresso em todos os aparelhos."}</Text>
        <Text style={styles.description}>
          {signedIn ? `Conectado como ${cloud.email}` : "Use a mesma conta no iPhone e no iPad. O app continua funcionando offline."}
        </Text>

        {!cloud.configured ? (
          <View style={styles.noticeBox}><Text style={styles.notice}>Sincronização ainda não configurada neste build.</Text></View>
        ) : signedIn && !recovering ? (
          <View style={styles.signedCard} testID="account-connected-card">
            <View style={styles.connectedIcon}><MaterialDesignIcons name="cloud-check" size={28} color={colors.brandPrimary} /></View>
            <Text style={styles.connectedTitle}>Tudo pronto</Text>
            <Text style={styles.connectedText}>Planos, refeições, água, XP e conquistas serão sincronizados.</Text>
            <Pressable style={[styles.primaryButton, !cloud.readyForData && styles.disabled]} disabled={!cloud.readyForData} onPress={finish}><Text style={styles.primaryText}>{cloud.readyForData ? "Ir para o UrsoFit" : "Preparando seus dados…"}</Text></Pressable>
            <Pressable style={styles.linkButton} onPress={() => void signOutFromCloud()}><Text style={styles.linkText}>Sair desta conta</Text></Pressable>
          </View>
        ) : (
          <View style={styles.form} testID="account-auth-form">
            {!recovering ? <View style={styles.segmented}>
              <Pressable style={[styles.segment, mode === "signin" && styles.segmentActive]} onPress={() => setMode("signin")}>
                <Text style={[styles.segmentText, mode === "signin" && styles.segmentTextActive]}>Entrar</Text>
              </Pressable>
              <Pressable style={[styles.segment, mode === "signup" && styles.segmentActive]} onPress={() => setMode("signup")}>
                <Text style={[styles.segmentText, mode === "signup" && styles.segmentTextActive]}>Criar conta</Text>
              </Pressable>
            </View> : null}
            {!recovering ? <TextInput style={styles.input} placeholder="Seu e-mail" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" testID="account-email-input" /> : null}
            {mode !== "forgot" || recovering ? <TextInput style={styles.input} placeholder={recovering ? "Nova senha (mínimo 6 caracteres)" : "Senha (mínimo 6 caracteres)"} placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry textContentType={mode === "signup" || recovering ? "newPassword" : "password"} testID="account-password-input" /> : null}
            <Pressable style={[styles.primaryButton, (busy || (!recovering && !email.trim()) || ((mode !== "forgot" || recovering) && password.length < 6)) && styles.disabled]} disabled={busy || (!recovering && !email.trim()) || ((mode !== "forgot" || recovering) && password.length < 6)} onPress={() => void submit()} testID="account-submit-btn">
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.primaryText}>{recovering ? "Salvar nova senha" : mode === "signin" ? "Entrar" : mode === "signup" ? "Criar minha conta" : "Enviar link de recuperação"}</Text>}
            </Pressable>
            {!recovering ? <View style={styles.extraActions}>
              <Pressable style={styles.linkButton} onPress={() => { setMode(mode === "forgot" ? "signin" : "forgot"); setNotice(null); }}><Text style={styles.linkText}>{mode === "forgot" ? "Voltar ao login" : "Esqueci minha senha"}</Text></Pressable>
              {mode !== "forgot" ? <Pressable style={styles.linkButton} disabled={busy || !(email.trim() || cloud.email)} onPress={() => void resend()}><Text style={styles.linkText}>Reenviar confirmação</Text></Pressable> : null}
            </View> : null}
            {notice || cloud.phase === "confirmation_required" ? (
              <View style={styles.noticeBox}><Text style={styles.notice}>{notice ?? cloud.message}</Text></View>
            ) : null}
            <View style={styles.privacyRow}>
              <MaterialDesignIcons name="shield-check-outline" size={18} color={colors.brandPrimary} />
              <Text style={styles.privacy}>Seus dados são privados e cada conta acessa somente os próprios registros.</Text>
            </View>
          </View>
        )}

        {onboarding === "1" && !signedIn ? (
          <Pressable style={styles.offlineButton} onPress={finish}><Text style={styles.offlineText}>Continuar sem conta por enquanto</Text></Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, width: "100%", maxWidth: 500, alignSelf: "center", paddingHorizontal: spacing.xl, alignItems: "center" },
  backButton: { alignSelf: "flex-start", width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  mascot: { width: 132, height: 132, borderRadius: 32, marginTop: spacing.lg },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: spacing.lg },
  title: { color: colors.onSurface, fontSize: 27, lineHeight: 33, fontWeight: "900", textAlign: "center", marginTop: spacing.sm },
  description: { color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { width: "100%", gap: spacing.md },
  segmented: { flexDirection: "row", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  segment: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceTertiary, fontWeight: "800", fontSize: 13 },
  segmentTextActive: { color: colors.onBrandPrimary },
  input: { minHeight: 50, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, color: colors.onSurface, fontSize: 15 },
  primaryButton: { width: "100%", minHeight: 50, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  primaryText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "900" },
  disabled: { opacity: 0.45 },
  noticeBox: { width: "100%", backgroundColor: colors.brandTertiary + "18", borderWidth: 1, borderColor: colors.brandTertiary + "55", borderRadius: radius.md, padding: spacing.md },
  notice: { color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  privacyRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.sm },
  privacy: { flex: 1, color: colors.onSurfaceTertiary, fontSize: 10, lineHeight: 15 },
  offlineButton: { padding: spacing.md, marginTop: spacing.md },
  offlineText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700" },
  signedCard: { width: "100%", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.brandPrimary + "66", borderRadius: radius.lg, padding: spacing.xl },
  connectedIcon: { width: 58, height: 58, borderRadius: radius.pill, backgroundColor: colors.brandPrimary + "22", alignItems: "center", justifyContent: "center" },
  connectedTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  connectedText: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18, textAlign: "center" },
  linkButton: { padding: spacing.sm },
  extraActions: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap" },
  linkText: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700" },
});
