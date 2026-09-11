export type NavigationSectionId = "home" | "food" | "hydration" | "training" | "profile";

export type NavigationItem = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: string;
  href: string;
  match: string[];
  mobile: boolean;
  desktop: boolean;
};

export type NavigationSection = NavigationItem & {
  id: NavigationSectionId;
  order: number;
  children: NavigationItem[];
};

const item = (
  id: string,
  label: string,
  icon: string,
  href: string,
  match: string[] = [href],
  shortLabel?: string,
): NavigationItem => ({ id, label, shortLabel, icon, href, match, mobile: true, desktop: true });

export const NAVIGATION: NavigationSection[] = [
  {
    ...item("home", "Home", "home-variant", "/", ["/"]),
    id: "home",
    order: 0,
    children: [],
  },
  {
    ...item(
      "food",
      "Plano alimentar",
      "silverware-fork-knife",
      "/alimentacao",
      ["/alimentacao", "/plano", "/historico-alimentar", "/alimentos", "/receitas", "/receita", "/compras", "/editor", "/meal", "/fora-do-plano"],
    ),
    id: "food",
    order: 1,
    children: [
      item("food-today", "Hoje", "view-dashboard-outline", "/alimentacao"),
      item("food-plan", "Plano", "calendar-week", "/plano", ["/plano", "/editor", "/meal"]),
      item("food-diary", "Diário alimentar", "notebook-outline", "/historico-alimentar", ["/historico-alimentar", "/fora-do-plano"], "Diário"),
      item("food-catalog", "Alimentos", "food-apple-outline", "/alimentos"),
      item("food-recipes", "Receitas", "chef-hat", "/receitas", ["/receitas", "/receita"]),
      item("food-shopping", "Compras", "cart-outline", "/compras"),
    ],
  },
  {
    ...item("hydration", "Hidratação", "water-outline", "/hidratacao", ["/hidratacao", "/hidratacao-recipientes", "/hidratacao-historico", "/hidratacao-config"]),
    id: "hydration",
    order: 2,
    children: [
      item("hydration-today", "Hoje", "water-outline", "/hidratacao"),
      item("hydration-containers", "Recipientes", "bottle-soda-outline", "/hidratacao-recipientes"),
      item("hydration-history", "Histórico", "chart-timeline-variant", "/hidratacao-historico"),
      item("hydration-settings", "Configurações", "tune-variant", "/hidratacao-config", ["/hidratacao-config"], "Ajustes"),
    ],
  },
  {
    ...item("training", "Treino", "dumbbell", "/treinos", ["/treinos", "/treinos-planos", "/treinos-exercicios", "/treinos-historico", "/treino", "/treino-novo", "/treino-planejado", "/treino-plano"]),
    id: "training",
    order: 3,
    children: [
      item("training-today", "Hoje e calendário", "calendar-today", "/treinos", ["/treinos", "/treino-novo", "/treino-planejado", "/treino/"], "Hoje"),
      item("training-plans", "Planos e modelos", "calendar-edit", "/treinos-planos", ["/treinos-planos", "/treino-plano"], "Planos"),
      item("training-exercises", "Exercícios", "weight-lifter", "/treinos-exercicios"),
      item("training-history", "Histórico e evolução", "chart-line", "/treinos-historico", ["/treinos-historico"], "Evolução"),
    ],
  },
  {
    ...item("profile", "Perfil", "account-circle-outline", "/ajustes", ["/ajustes", "/conta", "/conquistas", "/estatisticas"]),
    id: "profile",
    order: 4,
    children: [
      item("profile-account", "Meu perfil", "account-outline", "/conta", ["/conta"], "Perfil"),
      item("profile-achievements", "Conquistas", "trophy-outline", "/conquistas"),
      item("profile-progress", "Progresso", "chart-box-outline", "/estatisticas"),
      item("profile-settings", "Configurações", "cog-outline", "/ajustes", ["/ajustes"], "Ajustes"),
    ],
  },
];

export function normalizePathname(pathname: string) {
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return path.startsWith("/(tabs)") ? path.replace("/(tabs)", "") || "/" : path;
}

export function routeMatches(pathname: string, patterns: string[]) {
  const path = normalizePathname(pathname);
  return patterns.some((pattern) => {
    const normalizedPattern = normalizePathname(pattern);
    if (normalizedPattern === "/") return path === "/";
    return path === normalizedPattern || path.startsWith(`${normalizedPattern}/`);
  });
}

export function getActiveSection(pathname: string) {
  return NAVIGATION.find((section) => routeMatches(pathname, section.match)) ?? NAVIGATION[0];
}

export function getActiveChild(section: NavigationSection, pathname: string) {
  return section.children.find((child) => routeMatches(pathname, child.match));
}

export const FULL_SCREEN_PATHS = [
  "/boas-vindas",
  "/editor",
  "/meal",
  "/fora-do-plano",
  "/receita/",
  "/treino-novo",
  "/treino-planejado",
  "/treino/",
  "/treino-plano",
];

export function shouldHideNavigation(pathname: string) {
  const path = normalizePathname(pathname);
  return FULL_SCREEN_PATHS.some((pattern) => path === pattern || path.startsWith(pattern.endsWith("/") ? pattern : `${pattern}/`));
}
