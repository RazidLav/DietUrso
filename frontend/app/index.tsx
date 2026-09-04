import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { isOnboardingComplete } from "../src/store/onboardingStore";
import { colors } from "../src/theme";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    isOnboardingComplete()
      .then((complete) => router.replace(complete ? "/(tabs)" : "/boas-vindas"))
      .catch(() => router.replace("/(tabs)"));
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
    </View>
  );
}
