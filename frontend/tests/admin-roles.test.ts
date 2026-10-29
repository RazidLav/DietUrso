import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("migration cria papéis seguros sem permitir autopromoção", () => {
  const sql = read("../../supabase/migrations/20261029120000_create_admin_roles_events.sql");
  assert.match(sql, /role text not null default 'user'/i);
  assert.match(sql, /check \(role in \('user', 'admin'\)\)/i);
  assert.match(sql, /create or replace function public\.is_admin\(\)/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /ursofit_protect_profile_role/i);
  assert.match(sql, /Somente administradores podem alterar papéis de acesso/i);
});

test("eventos e configurações têm leitura pública e escrita exclusiva de admin", () => {
  const sql = read("../../supabase/migrations/20261029120000_create_admin_roles_events.sql");
  assert.match(sql, /create table if not exists public\.app_events/i);
  assert.match(sql, /create table if not exists public\.app_settings/i);
  assert.match(sql, /create table if not exists public\.admin_audit_log/i);
  assert.match(sql, /for select to anon, authenticated[\s\S]*status = 'published'/i);
  assert.match(sql, /Admins read all app events[\s\S]*using \(public\.is_admin\(\)\)/i);
  assert.match(sql, /for insert to authenticated with check \(public\.is_admin\(\)\)/i);
  assert.match(sql, /for update to authenticated using \(public\.is_admin\(\)\)/i);
  assert.match(sql, /for delete to authenticated using \(public\.is_admin\(\)\)/i);
});

test("painel administrativo exige papel admin e não aparece no menu comum", () => {
  const admin = read("../app/admin.tsx");
  const service = read("../src/admin/service.ts");
  const profile = read("../app/perfil.tsx");
  assert.match(admin, /requireAdmin|getAccessProfile/);
  assert.match(admin, /title="Administração"/);
  assert.match(service, /if \(access\.role !== "admin"\)/);
  assert.match(profile, /accessRole === "admin"/);
  assert.match(profile, /Painel administrativo/);
  assert.match(profile, /profile-menu-admin/);
});

test("usuário recebe eventos publicados, aviso e cor global sem acesso de escrita", () => {
  const home = read("../app/(tabs)/index.tsx");
  const theme = read("../src/components/ThemeProvider.tsx");
  const service = read("../src/admin/service.ts");
  assert.match(home, /home-admin-announcement/);
  assert.match(home, /home-event-shelf/);
  assert.match(service, /\.eq\("status", "published"\)/);
  assert.match(theme, /--uf-brand-primary/);
  assert.match(theme, /appConfig\.brandAccent/);
});
