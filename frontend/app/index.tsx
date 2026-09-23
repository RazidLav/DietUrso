import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { isOnboardingComplete } from "../src/store/onboardingStore";
import { colors } from "../src/theme";
import { getCloudStatus, subscribeCloudStatus } from "../src/cloud/cloudSync";

export default function Index() {
  const router = useRouter();
  const resolved = useRef(false);

  useEffect(() => {
    const resolve = async (status = getCloudStatus()) => {
      if (resolved.current || status.phase === "initializing") return;
      if (status.authenticated) {
        resolved.current = true;
        router.replace("/(tabs)");
        return;
      }
      if (status.configured && status.phase === "syncing" && !status.readyForData) return;
      try {
        const complete = await isOnboardingComplete();
        if (!resolved.current) { resolved.current = true; router.replace(complete ? "/(tabs)" : "/boas-vindas"); }
      } catch {
        if (!resolved.current) { resolved.current = true; router.replace("/boas-vindas"); }
      }
    };
    const unsubscribe = subscribeCloudStatus((status) => void resolve(status));
    void resolve();
    return unsubscribe;
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} size="large" />
      <Text style={{ color: colors.onSurfaceTertiary, marginTop: 12, fontSize: 12 }}>Preparando seu UrsoFit…</Text>
    </View>
  );
}
