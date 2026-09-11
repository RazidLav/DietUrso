import assert from "node:assert/strict";
import test from "node:test";
import { NAVIGATION, getActiveChild, getActiveSection, normalizePathname, routeMatches, shouldHideNavigation } from "../src/navigation/config";
import { motion } from "../src/theme";
import { matchesSearch, normalizeSearchText } from "../src/utils/search";

test("a dock central possui exatamente as cinco áreas na ordem definida", () => {
  assert.deepEqual(NAVIGATION.map((section) => section.label), ["Home", "Plano alimentar", "Hidratação", "Treino", "Perfil"]);
  assert.deepEqual(NAVIGATION.map((section) => section.order), [0, 1, 2, 3, 4]);
  assert.equal(new Set(NAVIGATION.map((section) => section.href)).size, 5);
});

test("rotas antigas continuam associadas à seção e subseção corretas", () => {
  assert.equal(getActiveSection("/(tabs)/alimentacao").id, "food");
  assert.equal(getActiveSection("/editor/plano-1").id, "food");
  assert.equal(getActiveSection("/hidratacao-recipientes").id, "hydration");
  assert.equal(getActiveSection("/treinos-exercicios").id, "training");
  assert.equal(getActiveSection("/conquistas").id, "profile");
  assert.equal(getActiveChild(getActiveSection("/receita/abc"), "/receita/abc")?.id, "food-recipes");
  assert.equal(getActiveChild(getActiveSection("/treinos-historico"), "/treinos-historico")?.id, "training-history");
  assert.equal(normalizePathname("/(tabs)/plano/"), "/plano");
  assert.equal(routeMatches("/meal/1/2", ["/meal"]), true);
});

test("formulários de tela cheia preservam o rascunho ao ocultar a navegação global", () => {
  for (const path of ["/editor/1", "/meal/1/2", "/fora-do-plano", "/receita/1", "/treino/1", "/treino-planejado/1"]) {
    assert.equal(shouldHideNavigation(path), true, path);
  }
  assert.equal(shouldHideNavigation("/alimentos"), false);
  assert.equal(shouldHideNavigation("/hidratacao"), false);
});

test("troca contextual usa animação curta e respeitável por reduced motion", () => {
  assert.equal(motion.contextExitMs + motion.contextEnterMs, motion.contextTotalMs);
  assert.ok(motion.contextTotalMs >= 180 && motion.contextTotalMs <= 250);
});

test("busca ignora maiúsculas, acentos e encontra nome, marca ou categoria", () => {
  assert.equal(normalizeSearchText("  AÇAÍ  "), "acai");
  assert.equal(matchesSearch("pao", "Pão integral", "Marca Boa"), true);
  assert.equal(matchesSearch("marca boa", "Pão integral", "Marca Boa"), true);
  assert.equal(matchesSearch("proteinas", "Frango", undefined, "Proteínas"), true);
  assert.equal(matchesSearch("iogurte", "Arroz", "Marca Boa"), false);
});
