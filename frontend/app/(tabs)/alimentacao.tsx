import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AreaDashboardHeader, DashboardTile } from "../../src/components/AreaDashboard";
import { ContentContainer, ResponsiveGrid } from "../../src/components/DesignSystem";
import { useCloudDataRefresh } from "../../src/cloud/useCloudDataRefresh";
import { listConsumption } from "../../src/store/planStore";
import { listFoodCatalog, listRecipes } from "../../src/store/nutritionStore";
import { areaColors, colors, spacing } from "../../src/theme";
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
        <AreaDashboardHeader
          title="Dieta"
          subtitle="Seu plano, seus registros e sua despensa."
          accent={areaColors.food}
          onBack={() => router.back()}
          onSettings={() => router.push("/ajustes")}
          settingsLabel="Abrir configurações da dieta"
          actions={[
            { id: "off-plan", label: "Registrar refeição", hint: "Inclua uma refeição sem alterar o plano", icon: "silverware-variant", onPress: () => router.push("/fora-do-plano") },
            { id: "food", label: "Novo alimento", hint: "Cadastre no seu banco pessoal", icon: "food-apple", onPress: () => router.push("/alimentos") },
            { id: "recipe", label: "Nova receita", hint: "Monte uma preparação por porções", icon: "chef-hat", onPress: () => router.push("/receitas") },
          ]}
        />

        <ResponsiveGrid minItemWidth={145} maxColumns={4} gap={spacing.sm} singleColumnOnPhone={false}>
        <DashboardTile
          icon="calendar-check"
          label="Hoje e meu plano"
          value={`${counts.today} registros`}
          hint="Refeições planejadas e consumo do dia"
          accent={areaColors.food}
          onPress={() => router.push("/plano")}
        />
        <DashboardTile
          icon="food-apple"
          label="Banco de alimentos"
          value={`${counts.foods} disponíveis`}
          hint="Pesquise ou cadastre alimentos"
          accent={areaColors.food}
          onPress={() => router.push("/alimentos")}
        />
        <DashboardTile
          icon="chef-hat"
          label="Receitas"
          value={`${counts.recipes} salvas`}
          hint="Preparações e valores por porção"
          accent={areaColors.food}
          onPress={() => router.push("/receitas")}
        />
        <DashboardTile
          icon="calendar-search"
          label="Histórico alimentar"
          value="Dia e semana"
          hint="Planejado, consumido e adesão"
          accent={colors.brandSecondary}
          onPress={() => router.push("/historico-alimentar")}
        />
        <DashboardTile
          icon="silverware-variant"
          label="Fora do plano"
          value={`${counts.offPlan} no histórico`}
          hint="Registre sem alterar a rotina"
          accent={colors.brandTertiary}
          onPress={() => router.push("/fora-do-plano")}
        />
        <DashboardTile
          icon="cart-outline"
          label="Lista de compras"
          value="Sua rotina"
          hint="Itens organizados por plano"
          accent={areaColors.food}
          onPress={() => router.push("/compras")}
        />
        </ResponsiveGrid>
        </ContentContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { gap: spacing.lg },
});
