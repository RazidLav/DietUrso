-- Evita a recursão entre as políticas de challenges e challenge_members.
-- A interface usa challenge_members apenas para consultar a participação do
-- próprio usuário; expor as linhas dos demais participantes não é necessário.

drop policy if exists "participants read members" on public.challenge_members;

drop policy if exists "users read own challenge memberships" on public.challenge_members;
create policy "users read own challenge memberships"
on public.challenge_members
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on policy "users read own challenge memberships" on public.challenge_members is
  'Permite consultar somente a própria participação e quebra a recursão de RLS com challenges.';
