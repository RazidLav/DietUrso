import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentContainer, PageHeader, ResponsiveGrid, SummaryCard } from "../../src/components/DesignSystem";
import { FeatureCard, FloatingActionMenu, FolderCard } from "../../src/components/ProgressiveUI";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { listConsumption } from "../../src/store/planStore";
import { listFoodCatalog, listRecipes } from "../../src/store/nutritionStore";
import { colors, spacing } from "../../src/theme";
import { todayISO } from "../../src/utils/date";
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from "./_layout";

type Counts = { foods: number; recipes: number; today: number; offPlan: number };

export default function AlimentacaoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingBottom: FLOATING_TAB_HEIGHT + Math.max(insets.bottom, FLOATING_TAB_MARGIN) + spacing.xl }}>
        <ContentContainer style={styles.content}>
        <PageHeader eyebrow="ALIMENTAÇÃO" title="Sua despensa e seu diário" description="Plano, registros e preparações organizados sem misturar o que foi planejado com o que você realmente consumiu." onBack={() => router.back()} />

        <ResponsiveGrid minItemWidth={96} maxColumns={3} gap={spacing.sm} singleColumnOnPhone={false}>
          <SummaryCard compact icon="food-apple-outline" label="Alimentos" value={String(counts.foods)} />
          <SummaryCard compact icon="chef-hat" label="Receitas" value={String(counts.recipes)} />
          <SummaryCard compact icon="check-circle-outline" label="Registros hoje" value={String(counts.today)} />
        </ResponsiveGrid>

        <ResponsiveGrid minItemWidth={150} maxColumns={2} gap={spacing.sm} singleColumnOnPhone={false}>
          <FolderCard icon="calendar-check" title="Hoje e meu plano" description="Refeições planejadas e registro do dia" onPress={() => router.push("/plano")} />
          <FolderCard icon="cart-outline" title="Lista de compras" description="Itens organizados para sua rotina" onPress={() => router.push("/compras")} />
        </ResponsiveGrid>

        <ResponsiveGrid minItemWidth={150} maxColumns={2} gap={spacing.sm} singleColumnOnPhone={false}>
        <FeatureCard
          compact
          icon="food-apple"
          title="Banco de alimentos"
          value={`${counts.foods} disponíveis`}
          description="Pesquise o catálogo ou cadastre alimentos com valores por porção de referência."
          onPress={() => router.push("/alimentos")}
        />
        <FeatureCard
          compact
          icon="chef-hat"
          title="Receitas e preparações"
          value={`${counts.recipes} salvas`}
          description="Monte receitas, calcule a receita inteira e veja automaticamente os valores por porção."
          onPress={() => router.push("/receitas")}
        />
        <FeatureCard
          compact
          icon="silverware-variant"
          title="Registrar fora do plano"
          value={`${counts.offPlan} no histórico`}
          description="Registre a vida real sem mudar a dieta das próximas refeições. Sem culpa, só informação."
          accent={colors.brandTertiary}
          onPress={() => router.push("/fora-do-plano")}
        />
        <FeatureCard
          compact
          icon="calendar-search"
          title="Histórico alimentar"
          value="Visão diária e semanal"
          description="Compare planejado e consumido, navegue por data e acompanhe a adesão aproximada."
          accent={colors.brandSecondary}
          onPress={() => router.push("/historico-alimentar")}
        />
        </ResponsiveGrid>
        </ContentContainer>
      </ScrollView>
      <FloatingActionMenu label="Registrar" actions={[
        { id: "off-plan", label: "Refeição fora do plano", hint: "Registre sem alterar as próximas refeições", icon: "silverware-variant", onPress: () => router.push("/fora-do-plano") },
        { id: "food", label: "Novo alimento", hint: "Abra seu banco de alimentos", icon: "food-apple", onPress: () => router.push("/alimentos") },
        { id: "recipe", label: "Nova receita", hint: "Monte uma preparação por porções", icon: "chef-hat", onPress: () => router.push("/receitas") },
      ]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { gap: spacing.lg },
});
