import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { colors, radius, spacing } from "../theme";
import {
  getCloudStatus,
  signOutFromCloud,
  subscribeCloudStatus,
  syncCloudNow,
  type CloudStatus,
} from "../cloud/cloudSync";

export default function CloudSyncCard({ onSynced }: { onSynced?: () => void | Promise<void> }) {
  const router = useRouter();
  const [cloud, setCloud] = useState<CloudStatus>(getCloudStatus());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => subscribeCloudStatus(setCloud), []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      await onSynced?.();
    } catch {
      setNotice("Não foi possível concluir agora. Seus dados locais continuam seguros.");
    } finally {
      setBusy(false);
    }
  };

  if (!cloud.configured) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <MaterialDesignIcons name="cloud-off-outline" size={22} color={colors.onSurfaceTertiary} />
          <Text style={styles.title}>Sincronização</Text>
        </View>
        <Text style={styles.description}>Disponível quando a conexão com a nuvem for configurada.</Text>
      </View>
    );
  }

  const signedIn = Boolean(cloud.email && cloud.phase !== "confirmation_required");
  const syncing = busy || cloud.phase === "syncing";

  return (
    <View style={styles.card} testID="cloud-sync-card">
      <View style={styles.titleRow}>
        <View style={styles.iconWrap}>
          <MaterialDesignIcons
            name={signedIn ? "cloud-check-outline" : "cloud-outline"}
            size={22}
            color={signedIn ? colors.brandPrimary : colors.onSurfaceSecondary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Sincronização</Text>
          <Text style={styles.description}>
            {signedIn ? `Conectado como ${cloud.email}` : "Use a mesma conta no iPhone e no iPad."}
          </Text>
        </View>
        {syncing ? <ActivityIndicator color={colors.brandPrimary} /> : null}
      </View>

      {signedIn ? (
        <>
          <Text style={styles.statusText}>
            {cloud.phase === "error"
              ? cloud.message
              : cloud.lastSyncAt
                ? `Sincronizado às ${new Date(cloud.lastSyncAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Pronto para sincronizar"}
          </Text>
          <View style={styles.actions}>
            <Pressable
              style={[styles.primaryButton, syncing && styles.disabled]}
              disabled={syncing}
              onPress={() => run(syncCloudNow)}
              testID="sync-now-btn"
            >
              <MaterialDesignIcons name="sync" size={17} color={colors.onBrandPrimary} />
              <Text style={styles.primaryButtonText}>Sincronizar agora</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              disabled={syncing}
              onPress={() => run(signOutFromCloud)}
            >
              <Text style={styles.secondaryButtonText}>Sair</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable style={styles.primaryButton} onPress={() => router.push("/conta")} testID="open-account-btn">
          <MaterialDesignIcons name="account-circle-outline" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.primaryButtonText}>Entrar ou criar conta</Text>
        </Pressable>
      )}

      {notice || cloud.phase === "confirmation_required" ? (
        <Text style={styles.notice}>{notice ?? cloud.message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
  description: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  statusText: { color: colors.onSurfaceSecondary, fontSize: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primaryButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  primaryButtonText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 13 },
  secondaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
  },
  secondaryButtonText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
  notice: { color: colors.brandTertiary, fontSize: 12, lineHeight: 18 },
});
