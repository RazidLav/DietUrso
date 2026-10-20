import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { breakpoints, layout, typeScale } from "../src/theme";

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
  for (const component of ["ContentContainer", "PageHeader", "SectionHeader", "ResponsiveGrid", "CompactCard", "SummaryCard", "StatusBadge", "SegmentedControl", "FilterChip", "IconButton", "PrimaryButton", "ResponsiveSheet"]) {
    assert.match(source, new RegExp(`export function ${component}`));
  }
  assert.match(source, /onLayout=/);
  assert.match(source, /containerWidth/);
  assert.doesNotMatch(source, /flexGrow: 1, minWidth: columns/);
});

test("a navegação adapta dock, rail e sidebar sem abrir todos os submenus", () => {
  const source = read("../src/components/AppNavigation.tsx");
  assert.match(source, /navigationRail/);
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
  for (const path of ["../app/(tabs)/alimentacao.tsx", "../app/treinos.tsx", "../app/perfil.tsx"]) {
    assert.match(read(path), /ResponsiveGrid/, path);
  }
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
  assert.match(home, /weekWrapWide: \{ width: "100%", maxWidth: 680/);
  assert.match(hydration, /PRIMARY_QUICK_AMOUNTS = \[250, 500, 1000\]/);
  assert.match(hydration, /showMoreAmounts/);
  assert.match(hydration, /hydration-more-amounts/);
  assert.match(progressive, /fabLayer: \{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0/);
  assert.match(progressive, /isPhone \? bottom : spacing\.lg/);
  assert.match(progressive, /fabPhone/);
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
