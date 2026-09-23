import { Stack } from "expo-router";
import { ActivityIndicator, AppState, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../src/theme";
import { useEffect, useState } from "react";
import { ensureSeed } from "../src/store/planStore";
import { initializeCloudSync, syncCloudNow } from "../src/cloud/cloudSync";
import { ensureNutritionSeed } from "../src/store/nutritionStore";
import { ensureHydrationSeed } from "../src/store/hydrationStore";
import { ensureTrainingSeed } from "../src/store/trainingStore";
import AppNavigation from "../src/components/AppNavigation";
import ThemeProvider, { useAppTheme } from "../src/components/ThemeProvider";
import { loadThemePreference } from "../src/store/themeStore";

export default function RootLayout() {
  const [storeState, setStoreState] = useState<"loading" | "ready" | "error">(
    "loading"
  );

  useEffect(() => {
    let mounted = true;

    loadThemePreference()
      .then(() => ensureSeed())
      .then(() => Promise.all([ensureNutritionSeed(), ensureHydrationSeed(), ensureTrainingSeed()]))
      .then(async () => {
        try {
          await initializeCloudSync();
        } catch {
          // O armazenamento local continua disponível mesmo sem conexão.
        }
        if (mounted) setStoreState("ready");
      })
      .catch((error) => {
        console.error("Falha ao inicializar os dados locais", error);
        if (mounted) setStoreState("error");
      });

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void syncCloudNow().catch(() => undefined);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <ThemeProvider>
        <ThemedStatusBar />
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          {storeState === "ready" ? (
            <AppNavigation>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.surface },
                  animation: "slide_from_right",
                }}
              />
            </AppNavigation>
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
            >
              {storeState === "loading" ? (
                <ActivityIndicator color={colors.brandPrimary} size="large" />
              ) : (
                <Text style={{ color: colors.onSurface, textAlign: "center" }}>
                  Não foi possível acessar os dados locais. Recarregue o aplicativo.
                </Text>
              )}
            </View>
          )}
        </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { preference, palette } = useAppTheme();
  return <StatusBar barStyle={preference === "emo" ? "light-content" : "dark-content"} backgroundColor={palette.surface} />;
}
