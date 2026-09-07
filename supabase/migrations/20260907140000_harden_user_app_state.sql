begin;

-- A ETAPA 2 continua usando o snapshot local-first por usuário. Isso mantém a
-- sincronização atômica e evita duas fontes de verdade entre o aparelho e o banco.
alter table public.user_app_state enable row level security;
alter table public.user_app_state force row level security;

revoke all on table public.user_app_state from anon;
grant select, insert, update, delete on table public.user_app_state to authenticated;

drop policy if exists "Users can read their own DietUrso data" on public.user_app_state;
create policy "Users can read their own DietUrso data"
on public.user_app_state for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own DietUrso data" on public.user_app_state;
create policy "Users can create their own DietUrso data"
on public.user_app_state for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own DietUrso data" on public.user_app_state;
create policy "Users can update their own DietUrso data"
on public.user_app_state for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own DietUrso data" on public.user_app_state;
create policy "Users can delete their own DietUrso data"
on public.user_app_state for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists user_app_state_updated_at_idx
on public.user_app_state (updated_at desc);

comment on table public.user_app_state is
  'Snapshot local-first por usuário do DietUrso. A versão 3 inclui catálogo pessoal, receitas, diário estruturado e configuração da lista de compras.';

commit;
