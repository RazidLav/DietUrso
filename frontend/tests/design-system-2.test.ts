import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { areaColors, breakpoints, flatColors, layout, typeScale } from "../src/theme";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("o layout responsivo distingue telefone, tablet e desktop por largura", () => {
  const source = read("../src/responsive.ts");
  assert.match(source, /width >= breakpoints\.desktop/);
  assert.match(source, /width >= breakpoints\.tablet/);
  assert.match(source, /return "phone"/);
  assert.ok(breakpoints.navigationRail >= breakpoints.tablet);
  assert.ok(layout.touchTarget >= 44);
  assert.ok(layout.contentMax > layout.readingMax);
  assert.ok(typeScale.pageTitle.fontSize > typeScale.componentTitle.fontSize);
});

test("a fundação visual compartilha os componentes essenciais", () => {
  const source = read("../src/components/DesignSystem.tsx");
  for (const component of ["ContentContainer", "PageHeader", "SectionHeader", "ResponsiveGrid", "CompactCard", "SurfaceCard", "SummaryCard", "StatusBadge", "SegmentedControl", "FilterChip", "IconButton", "PrimaryButton", "ResponsiveSheet"]) {
    assert.match(source, new RegExp(`export function ${component}`));
  }
  assert.match(source, /onLayout=/);
  assert.match(source, /containerWidth/);
  assert.doesNotMatch(source, /flexGrow: 1, minWidth: columns/);
});

test("a linguagem flat usa cores editoriais por área e reduz contornos decorativos", () => {
  const designSystem = read("../src/components/DesignSystem.tsx");
  const navigation = read("../src/components/AppNavigation.tsx");
  const progressive = read("../src/components/ProgressiveUI.tsx");

  assert.equal(areaColors.food, flatColors.orange);
  assert.equal(areaColors.hydration, flatColors.lavender);
  assert.equal(areaColors.training, flatColors.aqua);
  assert.match(designSystem, /accent = colors\.brandPrimary/);
  assert.match(designSystem, /eyebrowPill/);
  assert.match(designSystem, /surfaceAccent/);
  assert.match(navigation, /areaColors\[section\.id\]/);
  assert.doesNotMatch(navigation, /dock: \{[\s\S]*?borderWidth: 1[\s\S]*?dockItem:/);
  assert.match(progressive, /folderCard: \{[^}]*borderRadius: radius\.lg/);
});

test("a navegação adapta dock, rail e sidebar sem abrir todos os submenus", () => {
  const source = read("../src/components/AppNavigation.tsx");
  assert.match(source, /breakpoints\.tablet/);
  assert.match(source, /expanded.*compact.*hidden/s);
  assert.match(source, /urso:navigation\.sidebar/);
  assert.match(source, /!compact && sectionActive/);
});

test("as três telas-piloto usam a nova hierarquia responsiva", () => {
  const home = read("../app/(tabs)/index.tsx");
  const plan = read("../app/(tabs)/plano.tsx");
  const exercises = read("../app/treinos-exercicios.tsx");

  assert.match(home, /useResponsiveLayout/);
  assert.match(home, /compact/);
  assert.match(plan, /ResponsiveGrid/);
  assert.match(plan, /MacroSummary compact/);
  assert.match(plan, /maxColumns=\{3\}/);
  assert.match(plan, /maxWidth=\{1100\}/);
  assert.match(exercises, /ResponsiveSheet/);
  assert.match(exercises, /advancedFilterCount/);
  assert.match(exercises, /effectiveViewMode/);
  assert.match(exercises, /detailColumn/);
  assert.match(exercises, /AdvancedOptions/);
});

test("os hubs principais usam grades proporcionais em vez de cards de largura total", () => {
  for (const path of ["../app/(tabs)/alimentacao.tsx", "../app/treinos.tsx"]) {
    assert.match(read(path), /ResponsiveGrid/, path);
  }
  assert.match(read("../app/perfil.tsx"), /desktopAreasGrid/);
  const hydration = read("../app/hidratacao.tsx");
  assert.match(hydration, /hydration-workspace-columns/);
  assert.match(hydration, /workspaceWide/);
  assert.match(hydration, /summaryColumnWide: \{ width: 350/);
  const navigation = read("../src/components/AppNavigation.tsx");
  assert.match(navigation, /desktopCanvas: \{[^}]*maxWidth: layout\.editorMax/);
  assert.doesNotMatch(navigation, /desktopCanvas: \{[^}]*borderWidth/);
});

test("a segunda revisão de densidade reduz escolhas simultâneas e fixa o FAB ao viewport", () => {
  const home = read("../app/(tabs)/index.tsx");
  const hydration = read("../app/hidratacao.tsx");
  const progressive = read("../src/components/ProgressiveUI.tsx");

  assert.match(home, /home-overview-columns/);
  assert.doesNotMatch(home, /home-week-selector/);
  assert.match(hydration, /PRIMARY_QUICK_AMOUNTS = \[250, 500, 1000\]/);
  assert.match(hydration, /showMoreAmounts/);
  assert.match(hydration, /hydration-more-amounts/);
  assert.match(progressive, /fabLayer: \{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0/);
  assert.match(progressive, /isPhone \? bottom : spacing\.lg/);
  assert.match(progressive, /fabPhone/);
});

test("a auditoria de cards elimina flex móvel, cria prateleiras e limita o catálogo a quatro colunas", () => {
  const home = read("../app/(tabs)/index.tsx");
  const diet = read("../app/(tabs)/alimentacao.tsx");
  const profile = read("../app/perfil.tsx");
  const journey = read("../app/conquistas.tsx");
  const foods = read("../app/alimentos.tsx");
  const designSystem = read("../src/components/DesignSystem.tsx");

  assert.match(home, /focusColumnDesktop: \{ flex: 0\.9 \}/);
  assert.doesNotMatch(home, /focusColumn: \{ flex:/);
  assert.match(diet, /singleColumnOnPhone=\{false\}/);
  assert.match(diet, /<DashboardTile/);
  assert.match(profile, /profile-area-shelf/);
  assert.match(profile, /profile-more-areas/);
  assert.match(journey, /horizontal showsHorizontalScrollIndicator=\{false\} contentContainerStyle=\{styles\.chapterRail\}/);
  assert.match(journey, /trophy-more-card/);
  assert.match(foods, /maxColumns=\{4\}/);
  assert.match(foods, /minItemWidth=\{160\}/);
  assert.match(designSystem, /singleColumnOnPhone = true/);
});

test("o banco de exercícios preserva filtros e ações existentes", () => {
  const source = read("../app/treinos-exercicios.tsx");
  for (const state of ["setType", "setScope", "setMuscle", "setEquipment", "setFavoritesOnly"]) {
    assert.match(source, new RegExp(state));
  }
  for (const action of ["savePersonalExercise", "setPersonalExerciseArchived", "toggleExerciseFavorite", "createPersonalExerciseVariant"]) {
    assert.match(source, new RegExp(action));
  }
});

test("o perfil reúne edição e logout em um menu compacto", () => {
  const profile = read("../app/perfil.tsx");
  assert.match(profile, /settingsLabel="Abrir menu do perfil"/);
  assert.match(profile, /testID="profile-menu-edit"/);
  assert.match(profile, /testID="profile-menu-logout"/);
  assert.match(profile, /await signOutFromCloud\(\)/);
  assert.match(profile, /router\.replace\("\/conta\?mode=signin"/);
  assert.doesNotMatch(profile, /accessibilityLabel="Editar perfil"><MaterialDesignIcons/);
});

test("o perfil web usa painel compacto com dados reais sem remover a experiência mobile", () => {
  const profile = read("../app/perfil.tsx");
  assert.match(profile, /testID="profile-desktop-dashboard"/);
  assert.match(profile, /computeIntegratedStats\(consumption, training, hydration, activityPeriod\)/);
  assert.match(profile, /DashboardPanelHeader/);
  assert.match(profile, /stats\?\.workouts/);
  assert.match(profile, /stats\?\.averageWaterMl/);
  assert.match(profile, /desktopCalendarGrid/);
  assert.match(profile, /desktopAreasGrid/);
  assert.match(profile, /testID="profile-area-shelf"/);
  for (const route of ["conquistas", "meu-urso", "evolucao", "estatisticas", "anamnese", "comunidade", "rugidos", "desafios"]) {
    assert.match(profile, new RegExp(`/${route}`));
  }
});

test("a dock mobile usa transições CSS seguras no Safari e mantém quatro pilares compactos", () => {
  const navigation = read("../src/components/AppNavigation.tsx");
  const config = read("../src/navigation/config.ts");
  assert.match(navigation, /function MobileDockItem/);
  assert.doesNotMatch(navigation, /Animated\.timing|new Animated\.Value/);
  assert.match(navigation, /transitionDuration: "240ms"/);
  assert.match(navigation, /transitionProperty: "background-color, transform"/);
  assert.match(navigation, /useReducedMotion\(\)/);
  assert.match(navigation, /MOBILE_DOCK_IDS = \["home", "food", "training", "hydration"\]/);
  assert.match(navigation, /maxWidth: 304/);
  assert.doesNotMatch(navigation, /dockLabelActive/);
  assert.match(config, /"food-apple-outline"/);
  assert.match(config, /"kettlebell"/);
  assert.match(config, /"cup-water"/);
  assert.match(config, /"profile-community", "Social"/);
});

test("as áreas principais têm retorno consistente e a marca pública usa Hidratação", () => {
  const diet = read("../app/(tabs)/alimentacao.tsx");
  const training = read("../app/treinos.tsx");
  const hydration = read("../app/hidratacao.tsx");
  const profile = read("../app/perfil.tsx");
  assert.match(diet, /onBack=\{\(\) => router\.back\(\)\}/);
  assert.match(training, /onBack=\{\(\) => router\.back\(\)\}/);
  assert.match(hydration, /onBack=\{\(\) => router\.back\(\)\}/);
  assert.match(profile, /<AreaDashboardHeader/);
  assert.match(profile, /onBack=\{\(\) => router\.back\(\)\}/);
  assert.match(profile, /settingsIcon="menu"/);
  for (const path of ["../app/hidratacao.tsx", "../app/hidratacao-config.tsx", "../app/hidratacao-historico.tsx", "../app/hidratacao-recipientes.tsx", "../src/components/WaterCard.tsx", "../src/gamification/achievements.ts"]) {
    assert.doesNotMatch(read(path), /HidratUrso|HIDRATURSO/, path);
  }
});

test("as telas da toca compartilham cabeçalho, largura e grade de cartões", () => {
  for (const path of ["../app/meu-urso.tsx", "../app/conquistas.tsx", "../app/evolucao.tsx", "../app/estatisticas.tsx", "../app/comunidade.tsx", "../app/rugidos.tsx", "../app/desafios.tsx"]) {
    assert.match(read(path), /PageHeader/, path);
  }
  assert.match(read("../app/perfil.tsx"), /AreaDashboardHeader/);
  const closet = read("../app/meu-urso.tsx");
  assert.match(closet, /ResponsiveGrid minItemWidth=\{160\} maxColumns=\{4\}/);
  assert.doesNotMatch(closet, /100 \/ columns/);
  const designSystem = read("../src/components/DesignSystem.tsx");
  assert.match(designSystem, /pageHeader: \{ minHeight: 44/);
  assert.match(designSystem, /surfaceCard: \{ padding: spacing\.lg, borderRadius: radius\.md/);
});
