import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shouldStartFreshForAccount } from "../src/cloud/accountIsolation";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("uma conta diferente sem snapshot começa limpa em vez de herdar dados locais", () => {
  assert.equal(shouldStartFreshForAccount("user-antigo", "user-novo", false), true);
  assert.equal(shouldStartFreshForAccount("user-antigo", "user-novo", true), false);
  assert.equal(shouldStartFreshForAccount("user-atual", "user-atual", false), false);
  assert.equal(shouldStartFreshForAccount(null, "primeiro-login", false), false);
});

test("o Perfil oferece reset reforçado e mantém a conta ativa", () => {
  const profile = source("app/perfil.tsx");
  const sync = source("src/cloud/cloudSync.ts");
  assert.match(profile, /profile-menu-reset/);
  assert.match(profile, /Digite ZERAR para confirmar/);
  assert.match(profile, /resetUserData/);
  assert.match(profile, /A conta e o login continuam ativos/);
  assert.match(sync, /RESETTABLE_DATA_KEYS/);
  assert.match(sync, /LOCAL_OWNER_ID_KEY/);
  assert.match(sync, /pushLocalState\(session\)/);
});
