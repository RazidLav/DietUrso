import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sanitizeThemePreference } from "../src/store/themeStore";
import { themeCssVariables, themePalettes, withAlpha } from "../src/theme";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Emo e Gratiluz expõem o mesmo conjunto de tokens semânticos", () => {
  assert.deepEqual(Object.keys(themePalettes.emo).sort(), Object.keys(themePalettes.gratiluz).sort());
  for (const theme of ["emo", "gratiluz"] as const) {
    const variables = themeCssVariables(theme);
    assert.equal(variables["--uf-surface"], themePalettes[theme].surface);
    assert.equal(variables["--uf-brand-primary"], themePalettes[theme].brandPrimary);
    assert.ok(themePalettes[theme].focusRing);
  }
});

test("preferência inválida volta com segurança ao tema Emo", () => {
  assert.equal(sanitizeThemePreference("emo"), "emo");
  assert.equal(sanitizeThemePreference("gratiluz"), "gratiluz");
  assert.equal(sanitizeThemePreference("qualquer"), "emo");
  assert.equal(withAlpha("#B7FF2A", 0.5), "#B7FF2A80");
  assert.match(withAlpha("var(--uf-brand-primary)", 0.5), /color-mix/);
});

test("tema é aplicado antes da hidratação para evitar clarão", () => {
  const html = source("app/+html.tsx");
  const publicHtml = source("public/index.html");
  const css = source("public/global.css");
  assert.match(html, /localStorage\.getItem\('urso:themePreference'\)/);
  assert.match(html, /dataset\.ursoTheme/);
  assert.match(publicHtml, /localStorage\.getItem\("urso:themePreference"\)/);
  assert.match(publicHtml, /document\.documentElement\.dataset\.ursoTheme = theme/);
  assert.match(css, /data-urso-theme="emo"/);
  assert.match(css, /data-urso-theme="gratiluz"/);
});

test("tema usa o snapshot existente e não cria sistema paralelo de banco", () => {
  const sync = source("src/cloud/cloudSync.ts");
  assert.match(sync, /version: 6/);
  assert.match(sync, /themePreference/);
  assert.match(sync, /applyRemoteThemePreference/);
  assert.doesNotMatch(sync, /from\(["']user_theme/);
});

test("boas-vindas separa cadastro e login e mantém uso local", () => {
  const welcome = source("app/boas-vindas.tsx");
  assert.match(welcome, /welcome-signup-btn/);
  assert.match(welcome, /welcome-login-btn/);
  assert.match(welcome, /onboarding-skip-btn/);
  assert.match(welcome, /mascot-whey\.jpg/);
});

test("autenticação oferece senha visível, recuperação e reenvio", () => {
  const account = source("app/conta.tsx");
  assert.match(account, /account-password-toggle/);
  assert.match(account, /auth-forgot-link/);
  assert.match(account, /auth-resend-link/);
  assert.match(account, /submitLock/);
});

test("sessão autenticada é resolvida antes da tela de boas-vindas", () => {
  const index = source("app/index.tsx");
  assert.match(index, /status\.authenticated/);
  assert.match(index, /status\.phase === "initializing"/);
  assert.match(index, /subscribeCloudStatus/);
});

test("Home possui seletor semanal e falhas independentes por domínio", () => {
  const home = source("app/(tabs)/index.tsx");
  assert.match(home, /home-week-selector/);
  assert.match(home, /Promise\.allSettled/);
  assert.match(home, /SectionKey = "diet" \| "water" \| "training" \| "game"/);
  assert.match(home, /TrainingSummaryCard/);
  assert.match(home, /WaterCard/);
  assert.match(home, /GamificationSummaryCard/);
});

test("Aparência oferece seleção acessível dos dois temas", () => {
  const settings = source("app/(tabs)/ajustes.tsx");
  assert.match(settings, /appearance-settings/);
  assert.match(settings, /theme-choice-\$\{theme\}/);
  assert.match(settings, /accessibilityRole="radio"/);
  assert.match(settings, /Emo/);
  assert.match(settings, /Gratiluz/);
});
