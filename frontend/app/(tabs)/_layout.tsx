import { Tabs } from "expo-router";

// Altura visual da tab bar flutuante (excluindo safe area). Exportar para telas
// aplicarem paddingBottom equivalente ao rolar conteúdo.
export const FLOATING_TAB_HEIGHT = 0;
export const FLOATING_TAB_MARGIN = 0;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Hoje",
        }}
      />
      <Tabs.Screen
        name="plano"
        options={{
          title: "Plano",
        }}
      />
      <Tabs.Screen
        name="alimentacao"
        options={{
          title: "Alimentação",
        }}
      />
      <Tabs.Screen
        name="compras"
        options={{
          title: "Compras",
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: "Ajustes",
        }}
      />
    </Tabs>
  );
}
