begin;

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create index if not exists profiles_role_idx on public.profiles (role);

insert into public.profiles (user_id, display_name)
select
  users.id,
  left(coalesce(
    nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(users.email, '@', 1), ''),
    'Amigo do Urso'
  ), 50)
from auth.users as users
on conflict (user_id) do nothing;

create or replace function public.ursofit_create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, role)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Amigo do Urso'
    ), 50),
    'user'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ursofit_auth_user_profile on auth.users;
create trigger ursofit_auth_user_profile
after insert on auth.users
for each row execute function public.ursofit_create_user_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.ursofit_protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() <> 'service_role' and not public.is_admin() then
      new.role := 'user';
    end if;
  elsif new.role is distinct from old.role then
    if auth.role() <> 'service_role' and not public.is_admin() then
      raise exception 'Somente administradores podem alterar papéis de acesso.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before insert or update of role on public.profiles
for each row execute function public.ursofit_protect_profile_role();

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  accent_color text not null default '#B7FF2A' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  cta_label text check (cta_label is null or char_length(cta_label) between 2 and 30),
  cta_route text check (cta_route is null or (left(cta_route, 1) = '/' and char_length(cta_route) <= 120)),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_events_status_period_idx
on public.app_events (status, starts_at, ends_at);

create table if not exists public.app_settings (
  key text primary key check (key in ('brand_accent', 'announcement_message')),
  value jsonb not null,
  description text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value, description)
values
  ('brand_accent', '"#B7FF2A"'::jsonb, 'Cor principal da experiência web.'),
  ('announcement_message', '""'::jsonb, 'Aviso curto exibido na Home.')
on conflict (key) do nothing;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
on public.admin_audit_log (created_at desc);

create or replace function public.ursofit_admin_content_defaults()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Acesso administrativo necessário.';
  end if;
  if tg_table_name = 'app_events' then
    new.updated_by := auth.uid();
    new.updated_at := now();
    if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  elsif tg_table_name = 'app_settings' then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists app_events_admin_defaults on public.app_events;
create trigger app_events_admin_defaults
before insert or update on public.app_events
for each row execute function public.ursofit_admin_content_defaults();

drop trigger if exists app_settings_admin_defaults on public.app_settings;
create trigger app_settings_admin_defaults
before insert or update on public.app_settings
for each row execute function public.ursofit_admin_content_defaults();

create or replace function public.ursofit_audit_admin_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_audit_log (admin_id, entity_type, entity_id, action, before_data, after_data)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(
      to_jsonb(new) ->> 'id',
      to_jsonb(new) ->> 'key',
      to_jsonb(old) ->> 'id',
      to_jsonb(old) ->> 'key'
    ),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists app_events_admin_audit on public.app_events;
create trigger app_events_admin_audit
after insert or update or delete on public.app_events
for each row execute function public.ursofit_audit_admin_content();

drop trigger if exists app_settings_admin_audit on public.app_settings;
create trigger app_settings_admin_audit
after insert or update or delete on public.app_settings
for each row execute function public.ursofit_audit_admin_content();

alter table public.app_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_log enable row level security;

grant select on public.app_events, public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_events, public.app_settings to authenticated;
grant select on public.admin_audit_log to authenticated;
grant usage, select on sequence public.admin_audit_log_id_seq to authenticated;

drop policy if exists "Users read published app events" on public.app_events;
create policy "Users read published app events" on public.app_events
for select to anon, authenticated
using (status = 'published');

drop policy if exists "Admins read all app events" on public.app_events;
create policy "Admins read all app events" on public.app_events
for select to authenticated
using (public.is_admin());

drop policy if exists "Admins create app events" on public.app_events;
create policy "Admins create app events" on public.app_events
for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update app events" on public.app_events;
create policy "Admins update app events" on public.app_events
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete app events" on public.app_events;
create policy "Admins delete app events" on public.app_events
for delete to authenticated using (public.is_admin());

drop policy if exists "Users read app settings" on public.app_settings;
create policy "Users read app settings" on public.app_settings
for select to anon, authenticated using (true);
drop policy if exists "Admins create app settings" on public.app_settings;
create policy "Admins create app settings" on public.app_settings
for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins update app settings" on public.app_settings;
create policy "Admins update app settings" on public.app_settings
for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete app settings" on public.app_settings;
create policy "Admins delete app settings" on public.app_settings
for delete to authenticated using (public.is_admin());

drop policy if exists "Admins read audit log" on public.admin_audit_log;
create policy "Admins read audit log" on public.admin_audit_log
for select to authenticated using (public.is_admin());

commit;
