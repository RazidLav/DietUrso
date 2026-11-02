begin;

create table if not exists public.user_app_state_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  source_updated_at timestamptz not null,
  archived_at timestamptz not null default now(),
  reason text not null default 'update' check (reason in ('update', 'delete', 'manual_restore'))
);

create index if not exists user_app_state_history_user_archived_idx
  on public.user_app_state_history (user_id, archived_at desc);

alter table public.user_app_state_history enable row level security;
alter table public.user_app_state_history force row level security;

revoke all on table public.user_app_state_history from anon;
grant select on table public.user_app_state_history to authenticated;

drop policy if exists "Users can read their own UrsoFit history" on public.user_app_state_history;
create policy "Users can read their own UrsoFit history"
on public.user_app_state_history for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.ursofit_archive_user_app_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_app_state_history (user_id, payload, source_updated_at, reason)
  values (old.user_id, old.payload, old.updated_at, case when tg_op = 'DELETE' then 'delete' else 'update' end);

  delete from public.user_app_state_history history
  where history.user_id = old.user_id
    and history.id not in (
      select kept.id
      from public.user_app_state_history kept
      where kept.user_id = old.user_id
      order by kept.archived_at desc, kept.id desc
      limit 30
    );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.ursofit_archive_user_app_state() from public;

drop trigger if exists user_app_state_archive_before_change on public.user_app_state;
create trigger user_app_state_archive_before_change
before update or delete on public.user_app_state
for each row execute function public.ursofit_archive_user_app_state();

comment on table public.user_app_state_history is
  'Últimas versões do snapshot do UrsoFit para recuperação segura por usuário.';

commit;
