import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { decideSyncAction } from "../src/cloud/syncDecision";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("primeiro dispositivo envia dados quando a nuvem ainda não existe", () => {
  assert.equal(decideSyncAction({ hasRemote: false, baseRevision: null, remoteRevision: null, dirty: true }), "push_local");
});

test("dispositivo legado recebe a nuvem antes de poder sobrescrevê-la", () => {
  assert.equal(decideSyncAction({ hasRemote: true, baseRevision: null, remoteRevision: "nuvem-2", dirty: false }), "pull_cloud");
  assert.equal(decideSyncAction({ hasRemote: true, baseRevision: null, remoteRevision: "nuvem-2", dirty: true }), "conflict");
});

test("alteração local só é enviada sobre a revisão que o aparelho leu", () => {
  assert.equal(decideSyncAction({ hasRemote: true, baseRevision: "nuvem-2", remoteRevision: "nuvem-2", dirty: true }), "push_local");
  assert.equal(decideSyncAction({ hasRemote: true, baseRevision: "nuvem-1", remoteRevision: "nuvem-2", dirty: true }), "conflict");
});

test("envio usa compare-and-swap e conflito exige uma escolha explícita", () => {
  const sync = source("src/cloud/cloudSync.ts");
  const card = source("src/components/CloudSyncCard.tsx");
  assert.match(sync, /\.eq\("updated_at", options\.expectedRevision\)/);
  assert.match(sync, /preserveSyncConflict/);
  assert.match(sync, /LOCAL_CONFLICT_BACKUP_KEY/);
  assert.match(card, /resolveSyncConflict\("cloud"\)/);
  assert.match(card, /resolveSyncConflict\("local"\)/);
  assert.match(card, /Nenhuma versão foi apagada|histórico de segurança/);
});

test("migration mantém histórico privado antes de atualizar o snapshot", () => {
  const migration = source("../supabase/migrations/20261102153000_safe_sync_history.sql");
  assert.match(migration, /create table if not exists public\.user_app_state_history/);
  assert.match(migration, /before update or delete on public\.user_app_state/);
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(migration, /security definer/);
  assert.match(migration, /return new/);
});
