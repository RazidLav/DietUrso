import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { listConsumption } from "../../src/store/planStore";
import { listFoodCatalog, listRecipes } from "../../src/store/nutritionStore";
import { colors, radius, spacing } from "../../src/theme";
import { todayISO } from "../../src/utils/date";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";

type Counts = { foods: number; recipes: number; today: number; offPlan: number };

export default function AlimentacaoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = width >= 1024;
  const [counts, setCounts] = useState<Counts>({ foods: 0, recipes: 0, today: 0, offPlan: 0 });

  const load = useCallback(async () => {
    const [foods, recipes, entries] = await Promise.all([
      listFoodCatalog(),
      listRecipes(),
      listConsumption(),
    ]);
    setCounts({
      foods: foods.length,
      recipes: recipes.length,
      today: entries.filter((entry) => entry.date === todayISO() && entry.status !== "skipped").length,
      offPlan: entries.filter((entry) => entry.status === "off_plan").length,
    });
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  return (
    <View style={styles.screen} testID="alimentacao-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.eyebrow}>ALIMENTAÇÃO COMPLETA</Text>
        <Text style={styles.title}>Sua despensa e seu diário</Text>
        <Text style={styles.subtitle}>O plano continua sendo o plano. Aqui fica o que você realmente prepara e consome.</Text>
      </View>
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 1060, alignSelf: "center", padding: spacing.lg, paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl, gap: spacing.md }}>
        <View style={styles.summaryRow}>
          <Summary value={counts.foods} label="alimentos" />
          <Summary value={counts.recipes} label="receitas" />
          <Summary value={counts.today} label="registros hoje" />
        </View>

        <View style={[styles.featureGrid, desktop && styles.featureGridDesktop]}>
        <FeatureCard
          icon="food-apple"
          title="Banco de alimentos"
          description="Pesquise o catálogo ou cadastre alimentos com valores por porção de referência."
          meta={`${counts.foods} disponíveis`}
          onPress={() => router.push("/alimentos")}
          testID="open-foods-btn"
          desktop={desktop}
        />
        <FeatureCard
          icon="chef-hat"
          title="Receitas e preparações"
          description="Monte receitas, calcule a receita inteira e veja automaticamente os valores por porção."
          meta={`${counts.recipes} salvas`}
          onPress={() => router.push("/receitas")}
          testID="open-recipes-btn"
          desktop={desktop}
        />
        <FeatureCard
          icon="silverware-variant"
          title="Registrar fora do plano"
          description="Registre a vida real sem mudar a dieta das próximas refeições. Sem culpa, só informação."
          meta={`${counts.offPlan} no histórico`}
          accent={colors.brandTertiary}
          onPress={() => router.push("/fora-do-plano")}
          testID="open-off-plan-btn"
          desktop={desktop}
        />
        <FeatureCard
          icon="calendar-search"
          title="Histórico alimentar"
          description="Compare planejado e consumido, navegue por data e acompanhe a adesão aproximada."
          meta="Visão diária e semanal"
          accent={colors.brandSecondary}
          onPress={() => router.push("/historico-alimentar")}
          testID="open-history-btn"
          desktop={desktop}
        />
        </View>
      </ScrollView>
    </View>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function FeatureCard({ icon, title, description, meta, onPress, accent = colors.brandPrimary, testID, desktop }: {
  icon: string; title: string; description: string; meta: string; onPress: () => void; accent?: string; testID: string; desktop: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.card, desktop && styles.cardDesktop, pressed && { opacity: 0.85 }]} onPress={onPress} testID={testID}>
      <View style={[styles.icon, { backgroundColor: accent + "22" }]}><MaterialDesignIcons name={icon as any} size={25} color={accent} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
        <Text style={[styles.cardMeta, { color: accent }]}>{meta}</Text>
      </View>
      <MaterialDesignIcons name="chevron-right" size={24} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: colors.onSurface, fontSize: 25, fontWeight: "800", marginTop: 3 },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, maxWidth: 620 },
  summaryRow: { flexDirection: "row", gap: spacing.sm },
  featureGrid: { gap: spacing.md },
  featureGridDesktop: { flexDirection: "row", flexWrap: "wrap" },
  summary: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  summaryValue: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  card: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardDesktop: { flexGrow: 1, flexBasis: "47%" },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  cardDescription: { color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  cardMeta: { fontSize: 11, fontWeight: "700", marginTop: spacing.sm },
});
