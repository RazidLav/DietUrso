import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { completeOnboarding } from "../src/store/onboardingStore";
import { colors, radius, spacing, withAlpha } from "../src/theme";
import { useAppTheme } from "../src/components/ThemeProvider";

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const { preference, setPreference } = useAppTheme();

  const continueOffline = async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  const openAccount = (mode: "signin" | "signup") => router.push(`/conta?onboarding=1&mode=${mode}`);

  return (
    <SafeAreaView style={styles.screen} testID="onboarding-screen">
      <ScrollView contentContainerStyle={[styles.viewport, desktop && styles.viewportDesktop]}>
        <View style={[styles.visualPanel, desktop && styles.visualPanelDesktop]}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><MaterialDesignIcons name="paw" size={23} color={colors.onBrandPrimary} /></View>
            <Text style={styles.brand}>UrsoFit</Text>
          </View>
          <View style={styles.orbitOne} />
          <View style={styles.orbitTwo} />
          <Image source={require("../assets/images/mascot-whey.jpg")} style={[styles.hero, desktop && styles.heroDesktop]} resizeMode="cover" accessibilityLabel="Mascote UrsoFit segurando um shaker" />
          <View style={styles.visualBadge}>
            <MaterialDesignIcons name="heart-pulse" size={18} color={colors.onBrandPrimary} />
            <Text style={styles.visualBadgeText}>ROTINA COM FORÇA</Text>
          </View>
        </View>

        <View style={[styles.contentPanel, desktop && styles.contentPanelDesktop]}>
          <View style={styles.themeToggle} accessibilityRole="radiogroup" accessibilityLabel="Tema visual">
            {(["emo", "gratiluz"] as const).map((theme) => (
              <Pressable
                key={theme}
                accessibilityRole="radio"
                accessibilityState={{ checked: preference === theme }}
                accessibilityLabel={`Usar tema ${theme === "emo" ? "Emo" : "Gratiluz"}`}
                onPress={() => void setPreference(theme)}
                style={[styles.themeOption, preference === theme && styles.themeOptionActive]}
                testID={`welcome-theme-${theme}`}
              >
                <MaterialDesignIcons name={theme === "emo" ? "weather-night" : "white-balance-sunny"} size={16} color={preference === theme ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                <Text style={[styles.themeText, preference === theme && styles.themeTextActive]}>{theme === "emo" ? "Emo" : "Gratiluz"}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.copy}>
            <Text style={styles.eyebrow}>SEU ESPAÇO DE CUIDADO</Text>
            <Text style={styles.title}>Seu treino, sua dieta e seu progresso em um só lugar.</Text>
            <Text style={styles.description}>Organize sua rotina com leveza, acompanhe cada avanço e deixe o ursinho cuidar do resto com você.</Text>
          </View>

          <View style={styles.highlights}>
            <Highlight icon="food-apple-outline" label="Dieta" />
            <Highlight icon="water-outline" label="Hidratação" />
            <Highlight icon="dumbbell" label="Treinos" />
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Criar minha conta" style={styles.primaryButton} onPress={() => openAccount("signup")} testID="welcome-signup-btn">
              <Text style={styles.primaryText}>Criar minha conta</Text>
              <MaterialDesignIcons name="arrow-right" size={19} color={colors.onBrandPrimary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Entrar em uma conta existente" style={styles.loginButton} onPress={() => openAccount("signin")} testID="welcome-login-btn">
              <Text style={styles.loginLead}>Já tem uma conta?</Text><Text style={styles.loginText}> Entrar</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Continuar sem conta neste aparelho" style={styles.offlineButton} onPress={continueOffline} testID="onboarding-skip-btn">
              <MaterialDesignIcons name="cellphone" size={16} color={colors.onSurfaceTertiary} />
              <Text style={styles.offlineText}>Continuar só neste aparelho</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Highlight({ icon, label }: { icon: string; label: string }) {
  return <View style={styles.highlight}><MaterialDesignIcons name={icon as never} size={18} color={colors.brandPrimary} /><Text style={styles.highlightText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  viewport: { flexGrow: 1, width: "100%", maxWidth: 1240, alignSelf: "center" },
  viewportDesktop: { minHeight: 720, flexDirection: "row", alignItems: "stretch", padding: spacing.xl, gap: spacing.xl },
  visualPanel: { minHeight: 370, padding: spacing.xl, overflow: "hidden", backgroundColor: withAlpha(colors.brandPrimary, 0.13), justifyContent: "center" },
  visualPanelDesktop: { flex: 1.08, borderRadius: 36, minHeight: 0 },
  brandRow: { position: "absolute", top: spacing.xl, left: spacing.xl, zIndex: 3, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: { width: 42, height: 42, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandPrimary },
  brand: { color: colors.onSurface, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  hero: { width: 276, height: 276, borderRadius: 138, alignSelf: "center", borderWidth: 8, borderColor: withAlpha(colors.surfaceElevated, 0.68) },
  heroDesktop: { width: 430, height: 430, borderRadius: 215 },
  orbitOne: { position: "absolute", width: 410, height: 410, borderRadius: 205, borderWidth: 1, borderColor: withAlpha(colors.brandPrimary, 0.32), alignSelf: "center" },
  orbitTwo: { position: "absolute", width: 320, height: 320, borderRadius: 160, backgroundColor: withAlpha(colors.brandSecondary, 0.1), alignSelf: "center", transform: [{ translateX: 54 }] },
  visualBadge: { position: "absolute", right: spacing.xl, bottom: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 40, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  visualBadgeText: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  contentPanel: { flex: 1, marginTop: -28, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: colors.surface, padding: spacing.xl, gap: spacing.xl },
  contentPanelDesktop: { maxWidth: 510, marginTop: 0, borderRadius: 36, justifyContent: "center", paddingHorizontal: spacing.xxl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  themeToggle: { alignSelf: "flex-end", flexDirection: "row", padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border },
  themeOption: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: spacing.md, borderRadius: radius.pill },
  themeOptionActive: { backgroundColor: colors.brandPrimary },
  themeText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "800" },
  themeTextActive: { color: colors.onBrandPrimary },
  copy: { gap: spacing.md },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { color: colors.onSurface, fontSize: 34, lineHeight: 39, fontWeight: "900", letterSpacing: -1.1 },
  description: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 21 },
  highlights: { flexDirection: "row", gap: spacing.sm },
  highlight: { flex: 1, minHeight: 70, alignItems: "center", justifyContent: "center", gap: 5, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  highlightText: { color: colors.onSurfaceSecondary, fontSize: 10, fontWeight: "800" },
  actions: { gap: spacing.sm },
  primaryButton: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  primaryText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "900" },
  loginButton: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  loginLead: { color: colors.onSurfaceTertiary, fontSize: 12 },
  loginText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "900" },
  offlineButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  offlineText: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
});
