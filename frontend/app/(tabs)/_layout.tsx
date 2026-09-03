import { Tabs } from "expo-router";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { colors, radius, spacing } from "../../src/theme";

// Altura visual da tab bar flutuante (excluindo safe area). Exportar para telas
// aplicarem paddingBottom equivalente ao rolar conteúdo.
export const FLOATING_TAB_HEIGHT = 64;
export const FLOATING_TAB_MARGIN = 12;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", marginTop: -2 },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarStyle: {
          position: "absolute",
          left: FLOATING_TAB_MARGIN,
          right: FLOATING_TAB_MARGIN,
          bottom: Math.max(insets.bottom, FLOATING_TAB_MARGIN),
          height: FLOATING_TAB_HEIGHT,
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.pill,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.sm,
          paddingBottom: 0,
          paddingTop: 0,
          elevation: 12,
          ...(Platform.OS === "web"
            ? ({ boxShadow: "0px 6px 16px rgba(0,0,0,0.45)", height: FLOATING_TAB_HEIGHT } as any)
            : {
                shadowColor: "#000",
                shadowOpacity: 0.45,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Hoje",
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons name="home-variant" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="plano"
        options={{
          title: "Plano",
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons name="calendar-week" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="compras"
        options={{
          title: "Compras",
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons name="cog-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
