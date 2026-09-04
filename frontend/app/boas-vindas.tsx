import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { completeOnboarding } from "../src/store/onboardingStore";
import { colors, radius, spacing } from "../src/theme";

const STEPS = [
  {
    eyebrow: "BEM-VINDO AO DIETURSO",
    title: "Seu plano. Seu ritmo. Seu progresso.",
    description: "Um companheiro leve para registrar refeições, acompanhar metas e construir constância sem culpa.",
    icon: "paw",
  },
  {
    eyebrow: "CONSISTÊNCIA, NÃO PERFEIÇÃO",
    title: "Cada registro alimenta sua evolução.",
    description: "Ganhe XP, mantenha sequências e desbloqueie conquistas por hábitos positivos — nunca por restrição extrema.",
    icon: "star-four-points",
  },
  {
    eyebrow: "SUA CAVERNA, SUAS REGRAS",
    title: "Leve o DietUrso com você.",
    description: "Crie uma conta para sincronizar entre aparelhos ou continue usando tudo localmente. Seus registros existentes estão preservados.",
    icon: "cloud-check-outline",
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  const continueOffline = async () => {
    await completeOnboarding();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.screen} testID="onboarding-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>DIETURSO</Text>
        </View>

        <View style={styles.heroWrap}>
          <Image source={require("../assets/images/mascot-whey.jpg")} style={styles.hero} resizeMode="cover" />
          <View style={styles.heroBadge}>
            <MaterialDesignIcons name={current.icon as any} size={20} color={colors.onBrandPrimary} />
          </View>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{current.eyebrow}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.description}>{current.description}</Text>
        </View>

        {step === 1 ? (
          <View style={styles.features}>
            <Feature icon="silverware-fork-knife" label="Registre" />
            <Feature icon="star" label="Ganhe XP" />
            <Feature icon="trophy" label="Conquiste" />
          </View>
        ) : null}

        <View style={styles.dots}>
          {STEPS.map((_, index) => <View key={index} style={[styles.dot, index === step && styles.dotActive]} />)}
        </View>

        {step < STEPS.length - 1 ? (
          <Pressable style={styles.primaryButton} onPress={() => setStep((value) => value + 1)} testID="onboarding-next-btn">
            <Text style={styles.primaryText}>Continuar</Text>
            <MaterialDesignIcons name="arrow-right" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={() => router.push("/conta?onboarding=1")} testID="onboarding-account-btn">
              <MaterialDesignIcons name="account-circle-outline" size={19} color={colors.onBrandPrimary} />
              <Text style={styles.primaryText}>Entrar ou criar conta</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={continueOffline} testID="onboarding-skip-btn">
              <Text style={styles.secondaryText}>Continuar só neste aparelho</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Feature({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.feature}>
      <MaterialDesignIcons name={icon as any} size={20} color={colors.brandPrimary} />
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center", padding: spacing.xl, justifyContent: "center", gap: spacing.xl },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  brandDot: { width: 9, height: 9, borderRadius: 9, backgroundColor: colors.brandPrimary },
  brand: { color: colors.onSurface, fontWeight: "900", letterSpacing: 3, fontSize: 14 },
  heroWrap: { width: "100%", maxWidth: 330, aspectRatio: 1.45, alignSelf: "center", borderRadius: 34, overflow: "hidden", borderWidth: 1, borderColor: colors.brandPrimary + "55" },
  hero: { width: "100%", height: "100%" },
  heroBadge: { position: "absolute", right: spacing.md, bottom: spacing.md, width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  copy: { gap: spacing.md },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 1.5, textAlign: "center" },
  title: { color: colors.onSurface, fontSize: 29, lineHeight: 34, fontWeight: "900", textAlign: "center", letterSpacing: -0.6 },
  description: { color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 21, textAlign: "center" },
  features: { flexDirection: "row", gap: spacing.sm },
  feature: { flex: 1, minHeight: 70, alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  featureLabel: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
  dots: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: colors.surfaceTertiary },
  dotActive: { width: 24, backgroundColor: colors.brandPrimary },
  actions: { gap: spacing.sm },
  primaryButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg },
  primaryText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
});
