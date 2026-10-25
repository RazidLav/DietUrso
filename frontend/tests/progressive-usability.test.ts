import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("a biblioteca compartilhada expõe os padrões de revelação progressiva", () => {
  const source = read("../src/components/ProgressiveUI.tsx");
  for (const component of ["FolderCard", "FeatureCard", "StepHeader", "AdvancedOptions", "StickyActionBar", "FloatingActionMenu", "SearchAndFilter", "LoadingSkeleton", "EmptyState", "ErrorState"]) {
    assert.match(source, new RegExp(`export function ${component}`));
  }
});

test("o mobile mantém a dock estável sem uma segunda barra contextual", () => {
  const source = read("../src/components/AppNavigation.tsx");
  assert.doesNotMatch(source, /function ContextBar/);
  assert.match(source, /NAVIGATION\.map/);
});

test("a criação de sessão revela modalidade antes da configuração", () => {
  const source = read("../app/treino-novo.tsx");
  const weekly = read("../src/components/WeeklyTrainingEditor.tsx");
  assert.match(source, /StepHeader/);
  assert.match(source, /!activityType/);
  assert.match(source, /AdvancedOptions/);
  assert.match(source, /StickyActionBar/);
  assert.match(weekly, /Revise antes de salvar/);
  assert.match(weekly, /current=\{reviewing \? 3/);
});

test("musculação nasce com padrão herdável e separa grupo de técnica de série", () => {
  const source = read("../app/treino-planejado/[plannedId].tsx");
  assert.match(source, /plannedRepMin: 8/);
  assert.match(source, /plannedRepMax: 12/);
  assert.match(source, /restSeconds: 90/);
  assert.match(source, /targetRir: 2/);
  assert.match(source, /GROUP_TECHNIQUES/);
  assert.match(source, /SET_TECHNIQUES/);
  assert.match(source, /Adicionar selecionados/);
  assert.match(source, /Como medir esta série/);
});

test("o catálogo filtra modalidade, músculo, equipamento e favoritos", () => {
  const source = read("../app/treinos-exercicios.tsx");
  for (const state of ["setType", "setMuscle", "setEquipment", "setFavoritesOnly"]) assert.match(source, new RegExp(state));
});

test("planejamento e execução usam detalhes recolhidos e registros compactos", () => {
  const planning = read("../app/treino-planejado/[plannedId].tsx");
  const execution = read("../app/treino/[sessionId].tsx");
  assert.match(planning, /Detalhes da sessão/);
  assert.doesNotMatch(execution, /Detalhes desta série/);
  assert.match(execution, /accessibilityLabel=\{`Detalhes da série/);
  assert.match(execution, /Minimizar treino/);
  assert.match(execution, /Adicionar série/);
  assert.match(execution, /SessionMetric label="Duração"/);
  assert.match(execution, /strengthVolume\(session\)/);
  assert.match(execution, /accessibilityRole="checkbox"/);
  assert.match(execution, /\+15s/);
  assert.match(execution, /\+30s/);
  assert.match(execution, /Cancelar treino/);
  assert.match(execution, /Adicionar exercício/);
  assert.match(execution, /Substituir/);
  assert.match(execution, /Remover série/);
});

test("histórico abre snapshot somente de leitura e mostra evolução real", () => {
  const history = read("../app/treinos-historico.tsx");
  const detail = read("../app/treino-historico/[sessionId].tsx");
  const exercises = read("../app/treinos-exercicios.tsx");
  assert.match(history, /DESEMPENHO NO PERÍODO/);
  assert.match(history, /treino-historico/);
  assert.match(detail, /REGISTRO PRESERVADO/);
  assert.match(detail, /snapshot da execução/);
  assert.match(exercises, /exercisePerformanceSeries/);
  assert.match(exercises, /1RM estimado/);
  assert.match(exercises, /30d/);
});

test("o treino minimizado permanece flutuante no desktop e reage à persistência local", () => {
  const navigation = read("../src/components/AppNavigation.tsx");
  const miniPlayer = read("../src/components/WorkoutMiniPlayer.tsx");
  const cloud = read("../src/cloud/cloudSync.ts");
  const execution = read("../app/treino/[sessionId].tsx");
  assert.match(navigation, /<WorkoutMiniPlayer floating \/>/);
  assert.match(navigation, /desktopMain: \{ position: "relative"[^}]*minHeight: 0/);
  assert.match(miniPlayer, /outerFloating: \{ position: "absolute"[^}]*bottom: spacing\.lg/);
  assert.match(miniPlayer, /zIndex: zIndex\.navigation/);
  assert.match(cloud, /pendingLocalChange = true;\s+notifyDataChanged\(\);\s+scheduleCloudPush\(\);/);
  assert.match(execution, /router\.replace\("\/treinos"\); void saveTrainingDraft/);
});

test("a Home usa uma única cronologia integrada em qualquer largura", () => {
  const home = read("../app/(tabs)/index.tsx");
  assert.match(home, /topbarDesktop: \{ flexDirection: "row"/);
  assert.match(home, /Atividade de hoje/);
  assert.doesNotMatch(home, /Refeições do dia/);
  assert.doesNotMatch(home, /mealsSection/);
  assert.match(home, /maxWidth: layout\.editorMax/);
});
