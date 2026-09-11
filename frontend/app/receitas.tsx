import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCloudDataRefresh } from "../src/cloud/useCloudDataRefresh";
import { getSignedInUser } from "../src/cloud/cloudSync";
import { recipeNutrients } from "../src/nutrition/calculations";
import { createRecipe, duplicateRecipe, listRecipes, setRecipeArchived } from "../src/store/nutritionStore";
import { colors, radius, spacing } from "../src/theme";
import type { Recipe } from "../src/types/plan";
import { matchesSearch } from "../src/utils/search";

export default function ReceitasScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRecipes(await listRecipes(true)); setError(null); }
    catch { setError("Não foi possível carregar as receitas."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useCloudDataRefresh(load);

  const visible = useMemo(() => recipes.filter((recipe) =>
    recipe.archived === showArchived && matchesSearch(query, recipe.name, recipe.category, recipe.description)
  ), [recipes, query, showArchived]);

  const add = async () => {
    try { const recipe = await createRecipe("Nova receita", (await getSignedInUser())?.id); router.push(`/receita/${recipe.id}`); }
    catch { setError("Não foi possível criar a receita."); }
  };
  const duplicate = async (id: string) => { try { const recipe = await duplicateRecipe(id, (await getSignedInUser())?.id); await load(); router.push(`/receita/${recipe.id}`); } catch { setError("Não foi possível duplicar a receita."); } };
  const archive = async (recipe: Recipe) => { try { await setRecipeArchived(recipe.id, !recipe.archived); await load(); } catch { setError("Não foi possível atualizar a receita."); } };

  return (
    <View style={styles.screen} testID="recipes-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}><MaterialDesignIcons name="chevron-left" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.eyebrow}>PREPARAÇÕES</Text><Text style={styles.title}>Receitas</Text></View>
        <Pressable style={styles.addBtn} onPress={() => void add()} testID="new-recipe-btn"><MaterialDesignIcons name="plus" size={23} color={colors.onBrandPrimary} /></Pressable>
      </View>
      <View style={styles.searchWrap}><MaterialDesignIcons name="magnify" size={20} color={colors.onSurfaceTertiary} /><TextInput value={query} onChangeText={setQuery} placeholder="Pesquisar receita" placeholderTextColor={colors.onSurfaceTertiary} style={styles.search} /></View>
      <View style={styles.filterRow}><Pressable onPress={() => setShowArchived(false)} style={[styles.chip, !showArchived && styles.chipOn]}><Text style={[styles.chipText, !showArchived && styles.chipTextOn]}>Ativas</Text></Pressable><Pressable onPress={() => setShowArchived(true)} style={[styles.chip, showArchived && styles.chipOn]}><Text style={[styles.chipText, showArchived && styles.chipTextOn]}>Arquivadas</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
          {visible.map((recipe) => {
            const nutrition = recipeNutrients(recipe);
            return <View key={recipe.id} style={styles.card} testID={`recipe-card-${recipe.id}`}>
              <Pressable style={styles.cardMain} onPress={() => router.push(`/receita/${recipe.id}`)}>
                <View style={styles.chef}><MaterialDesignIcons name="chef-hat" size={23} color={colors.brandPrimary} /></View>
                <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{recipe.name}</Text><Text style={styles.meta}>{recipe.category} · {recipe.ingredients.length} ingredientes · {recipe.servings} {recipe.servings === 1 ? "porção" : "porções"}</Text><Text style={styles.macros}>{Math.round(nutrition.perServing.kcal)} kcal/porção · P {nutrition.perServing.protein.toFixed(1)} · C {nutrition.perServing.carbs.toFixed(1)} · G {nutrition.perServing.fats.toFixed(1)}</Text></View>
                <MaterialDesignIcons name="chevron-right" size={22} color={colors.onSurfaceTertiary} />
              </Pressable>
              <View style={styles.actions}>
                <Pressable style={styles.action} onPress={() => void duplicate(recipe.id)}><MaterialDesignIcons name="content-copy" size={15} color={colors.onSurfaceSecondary} /><Text style={styles.actionText}>Duplicar</Text></Pressable>
                {!recipe.archived ? <Pressable style={styles.action} onPress={() => router.push(`/fora-do-plano?recipeId=${recipe.id}`)}><MaterialDesignIcons name="silverware" size={15} color={colors.onSurfaceSecondary} /><Text style={styles.actionText}>Registrar hoje</Text></Pressable> : null}
                <Pressable style={styles.action} onPress={() => void archive(recipe)}><MaterialDesignIcons name={recipe.archived ? "archive-arrow-up" : "archive-outline"} size={15} color={colors.onSurfaceSecondary} /><Text style={styles.actionText}>{recipe.archived ? "Restaurar" : "Arquivar"}</Text></Pressable>
              </View>
            </View>;
          })}
          {!visible.length ? <View style={styles.empty}><MaterialDesignIcons name="chef-hat" size={40} color={colors.onSurfaceTertiary} /><Text style={styles.emptyTitle}>{showArchived ? "Nenhuma receita arquivada" : "Sua cozinha está pronta"}</Text><Text style={styles.emptyText}>Crie uma receita para calcular automaticamente os nutrientes por porção.</Text></View> : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface }, header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" }, addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  searchWrap: { margin: spacing.lg, marginBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md }, search: { flex: 1, color: colors.onSurface, paddingVertical: spacing.md, outlineStyle: "none" } as any,
  filterRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm }, chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceTertiary }, chipOn: { backgroundColor: colors.brandPrimary }, chipText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" }, chipTextOn: { color: colors.onBrandPrimary },
  error: { color: colors.error, fontSize: 12, marginHorizontal: spacing.lg, marginTop: spacing.sm }, card: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md }, cardMain: { flexDirection: "row", alignItems: "center", gap: spacing.md }, chef: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary + "22", alignItems: "center", justifyContent: "center" }, cardTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800" }, meta: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 3 }, macros: { color: colors.onSurfaceSecondary, fontSize: 11, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }, action: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surfaceTertiary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill }, actionText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.sm }, emptyTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" }, emptyText: { color: colors.onSurfaceTertiary, fontSize: 12, textAlign: "center", maxWidth: 350 },
});
