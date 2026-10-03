begin;

create or replace function public.ursofit_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.chapter_definitions (
  id text primary key,
  number smallint not null unique check (number between 1 and 10),
  title text not null,
  first_level smallint not null check (first_level between 1 and 100),
  last_level smallint not null check (last_level between 1 and 100 and last_level >= first_level),
  asset_key text not null unique,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cosmetic_definitions (
  id text primary key,
  kind text not null check (kind in ('avatar', 'frame', 'title', 'banner', 'medallion', 'trophy', 'relic')),
  name text not null,
  description text not null default '',
  asset_key text not null unique,
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary', 'mythic')),
  unlock_type text not null check (unlock_type in ('default', 'level', 'streak', 'achievement', 'chapter', 'future')),
  unlock_value text,
  secret boolean not null default false,
  display_order integer not null default 0,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.level_definitions (
  id text primary key,
  number smallint not null unique check (number between 1 and 100),
  chapter_id text not null references public.chapter_definitions(id),
  title text not null,
  description text not null default '',
  min_xp bigint not null check (min_xp >= 0),
  xp_for_next_level integer not null check (xp_for_next_level >= 0),
  asset_key text not null unique,
  asset_description text not null default '',
  reward_id text references public.cosmetic_definitions(id),
  special boolean not null default false,
  content_status text not null default 'awaiting_master_document'
    check (content_status in ('official', 'awaiting_master_document')),
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Amigo do Urso' check (char_length(display_name) between 1 and 50),
  username text check (
    username is null or (
      username ~ '^[a-z0-9_]{3,24}$'
      and lower(username) not in ('admin','administrator','api','app','auth','moderador','moderator','suporte','support','ursofit','dieturso','root','system')
    )
  ),
  bio text not null default '' check (char_length(bio) <= 160),
  photo_path text,
  avatar_mode text not null default 'bear' check (avatar_mode in ('bear', 'photo')),
  privacy text not null default 'private' check (privacy in ('private', 'future_public')),
  show_progress_stats boolean not null default false,
  show_streak_stats boolean not null default false,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username)) where username is not null;

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp bigint not null default 0 check (total_xp >= 0),
  narrative_level smallint not null default 1 check (narrative_level between 1 and 100),
  legacy_level integer not null default 1 check (legacy_level >= 1),
  journey_version integer not null default 1 check (journey_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  event_type text not null,
  xp_amount integer not null default 0 check (xp_amount >= 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists gamification_events_user_occurred_idx
on public.gamification_events (user_id, occurred_at desc);

create table if not exists public.user_chapter_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id text not null references public.chapter_definitions(id),
  completed_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

create table if not exists public.user_achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

create table if not exists public.user_cosmetic_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null references public.cosmetic_definitions(id),
  unlocked_at timestamptz not null default now(),
  source_key text,
  primary key (user_id, cosmetic_id)
);

create table if not exists public.user_equipped_cosmetics (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('avatar', 'frame', 'title', 'banner', 'medallion')),
  cosmetic_id text not null references public.cosmetic_definitions(id),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create table if not exists public.profile_featured_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 3),
  item_type text not null check (item_type in ('achievement', 'trophy', 'relic')),
  item_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, position),
  unique (user_id, item_type, item_key)
);

create index if not exists profile_featured_items_user_idx on public.profile_featured_items (user_id);
create index if not exists user_cosmetic_unlocks_user_idx on public.user_cosmetic_unlocks (user_id, unlocked_at desc);
create index if not exists user_achievement_unlocks_user_idx on public.user_achievement_unlocks (user_id, unlocked_at desc);

drop trigger if exists chapter_definitions_updated_at on public.chapter_definitions;
create trigger chapter_definitions_updated_at before update on public.chapter_definitions
for each row execute function public.ursofit_set_updated_at();
drop trigger if exists cosmetic_definitions_updated_at on public.cosmetic_definitions;
create trigger cosmetic_definitions_updated_at before update on public.cosmetic_definitions
for each row execute function public.ursofit_set_updated_at();
drop trigger if exists level_definitions_updated_at on public.level_definitions;
create trigger level_definitions_updated_at before update on public.level_definitions
for each row execute function public.ursofit_set_updated_at();
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.ursofit_set_updated_at();
drop trigger if exists user_progress_updated_at on public.user_progress;
create trigger user_progress_updated_at before update on public.user_progress
for each row execute function public.ursofit_set_updated_at();

insert into public.chapter_definitions (id, number, title, first_level, last_level, asset_key)
values
  ('chapter-01', 1, 'O Despertar', 1, 10, 'chapter-01-o-despertar'),
  ('chapter-02', 2, 'Criando Raízes', 11, 20, 'chapter-02-criando-raizes'),
  ('chapter-03', 3, 'Explorando o Caminho', 21, 30, 'chapter-03-explorando-o-caminho'),
  ('chapter-04', 4, 'Força em Construção', 31, 40, 'chapter-04-forca-em-construcao'),
  ('chapter-05', 5, 'A Jornada Fica Séria', 41, 50, 'chapter-05-a-jornada-fica-seria'),
  ('chapter-06', 6, 'Subindo a Montanha', 51, 60, 'chapter-06-subindo-a-montanha'),
  ('chapter-07', 7, 'Provação', 61, 70, 'chapter-07-provacao'),
  ('chapter-08', 8, 'Maestria', 71, 80, 'chapter-08-maestria'),
  ('chapter-09', 9, 'O Raro e o Lendário', 81, 90, 'chapter-09-raro-e-lendario'),
  ('chapter-10', 10, 'A Lenda UrsoFit', 91, 100, 'chapter-10-lenda-ursofit')
on conflict (id) do update set
  number = excluded.number, title = excluded.title, first_level = excluded.first_level,
  last_level = excluded.last_level, asset_key = excluded.asset_key, active = true;

insert into public.cosmetic_definitions
  (id, kind, name, description, asset_key, rarity, unlock_type, unlock_value, secret, display_order)
values
  ('frame-classic', 'frame', 'Moldura da Toca', 'Moldura inicial do perfil.', 'frame-classic', 'common', 'default', null, false, 1),
  ('banner-cave', 'banner', 'Luz da Caverna', 'Banner inicial da jornada.', 'banner-cave', 'common', 'default', null, false, 1),
  ('avatar-01', 'avatar', 'Urso Clássico', 'Avatar colecionável do UrsoFit.', 'bear-urso-classico', 'common', 'default', null, false, 1),
  ('avatar-02', 'avatar', 'Urso Maromba', 'Avatar colecionável do UrsoFit.', 'bear-urso-maromba', 'common', 'level', '10', false, 2),
  ('avatar-03', 'avatar', 'Urso das Neves', 'Avatar colecionável do UrsoFit.', 'bear-urso-das-neves', 'common', 'future', null, false, 3),
  ('avatar-04', 'avatar', 'Urso Emo', 'Avatar colecionável do UrsoFit.', 'bear-urso-emo', 'common', 'future', null, false, 4),
  ('avatar-05', 'avatar', 'Urso Gratiluz', 'Avatar colecionável do UrsoFit.', 'bear-urso-gratiluz', 'common', 'future', null, false, 5),
  ('avatar-06', 'avatar', 'Urso Caipira', 'Avatar colecionável do UrsoFit.', 'bear-urso-caipira', 'rare', 'future', null, false, 6),
  ('avatar-07', 'avatar', 'Urso Corredor', 'Avatar colecionável do UrsoFit.', 'bear-urso-corredor', 'rare', 'achievement', 'first-run', false, 7),
  ('avatar-08', 'avatar', 'Urso Ciclista', 'Avatar colecionável do UrsoFit.', 'bear-urso-ciclista', 'rare', 'achievement', 'first-bike', false, 8),
  ('avatar-09', 'avatar', 'Urso Lutador', 'Avatar colecionável do UrsoFit.', 'bear-urso-lutador', 'rare', 'future', null, false, 9),
  ('avatar-10', 'avatar', 'Urso Zen', 'Avatar colecionável do UrsoFit.', 'bear-urso-zen', 'rare', 'achievement', 'first-mobility', false, 10),
  ('avatar-11', 'avatar', 'Urso HIIT', 'Avatar colecionável do UrsoFit.', 'bear-urso-hiit', 'rare', 'future', null, false, 11),
  ('avatar-12', 'avatar', 'Chef da Caverna', 'Avatar colecionável do UrsoFit.', 'bear-chef-da-caverna', 'epic', 'achievement', 'first-recipe', false, 12),
  ('avatar-13', 'avatar', 'Urso Noturno', 'Avatar colecionável do UrsoFit.', 'bear-urso-noturno', 'epic', 'future', null, false, 13),
  ('avatar-14', 'avatar', 'Urso Explorador', 'Avatar colecionável do UrsoFit.', 'bear-urso-explorador', 'epic', 'chapter', '3', false, 14),
  ('avatar-15', 'avatar', 'Urso Brilho Raro', 'Avatar secreto da lenda UrsoFit.', 'bear-urso-brilho-raro', 'mythic', 'level', '100', true, 15)
on conflict (id) do update set
  kind = excluded.kind, name = excluded.name, description = excluded.description,
  asset_key = excluded.asset_key, rarity = excluded.rarity, unlock_type = excluded.unlock_type,
  unlock_value = excluded.unlock_value, secret = excluded.secret,
  display_order = excluded.display_order, active = true;

insert into public.cosmetic_definitions
  (id, kind, name, description, asset_key, rarity, unlock_type, unlock_value, display_order)
select
  'medallion-chapter-' || lpad(chapter::text, 2, '0'),
  'medallion',
  'Medalhão do Capítulo ' || chapter,
  'Concedido ao concluir todos os níveis do capítulo.',
  'medallion-chapter-' || lpad(chapter::text, 2, '0'),
  case when chapter >= 9 then 'legendary' when chapter >= 6 then 'epic' else 'rare' end,
  'chapter', chapter::text, chapter
from generate_series(1, 10) as chapter
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity,
  unlock_type = excluded.unlock_type, unlock_value = excluded.unlock_value,
  display_order = excluded.display_order, active = true;

insert into public.level_definitions
  (id, number, chapter_id, title, description, min_xp, xp_for_next_level,
   asset_key, asset_description, reward_id, special, content_status)
select
  'level-' || lpad(level_number::text, 3, '0'),
  level_number,
  'chapter-' || lpad((((level_number - 1) / 10) + 1)::text, 2, '0'),
  'Nível ' || level_number,
  'Conteúdo narrativo oficial aguardando o documento-mestre.',
  ((level_number - 1)::bigint * (360 + (level_number - 2) * 45) / 2),
  case when level_number = 100 then 0 else 180 + (level_number - 1) * 45 end,
  'level-' || lpad(level_number::text, 3, '0') || '-collectible',
  'Asset oficial aguardando produção ou importação.',
  case when level_number % 10 = 0 then 'medallion-chapter-' || lpad((level_number / 10)::text, 2, '0') else null end,
  level_number = any(array[1,5,10,20,25,30,42,50,60,69,70,80,88,89,95,99,100]),
  'awaiting_master_document'
from generate_series(1, 100) as level_number
on conflict (id) do update set
  number = excluded.number, chapter_id = excluded.chapter_id, min_xp = excluded.min_xp,
  xp_for_next_level = excluded.xp_for_next_level, asset_key = excluded.asset_key,
  reward_id = excluded.reward_id, special = excluded.special, active = true;

update public.level_definitions
set title = case number
  when 1 then 'Ursinho Desperto'
  when 2 then 'Saindo da Toca'
  when 10 then 'Primeira Insígnia'
  when 100 then 'Lenda UrsoFit'
end,
content_status = 'official'
where number in (1, 2, 10, 100);

insert into public.cosmetic_definitions
  (id, kind, name, description, asset_key, rarity, unlock_type, unlock_value, display_order)
values
  ('title-legacy-1', 'title', 'Ursinho Recém-Acordado', 'Título preservado da progressão original.', 'title-legacy-1', 'rare', 'level', '1', 1),
  ('title-legacy-3', 'title', 'Urso do Lanchinho', 'Título preservado da progressão original.', 'title-legacy-3', 'rare', 'level', '3', 2),
  ('title-legacy-5', 'title', 'Urso Proteinado', 'Título preservado da progressão original.', 'title-legacy-5', 'rare', 'level', '5', 3),
  ('title-legacy-10', 'title', 'Urso Maromba', 'Título preservado da progressão original.', 'title-legacy-10', 'rare', 'level', '10', 4),
  ('title-legacy-15', 'title', 'Urso Parrudo', 'Título preservado da progressão original.', 'title-legacy-15', 'rare', 'level', '15', 5),
  ('title-legacy-20', 'title', 'Urso Brabo', 'Título preservado da progressão original.', 'title-legacy-20', 'rare', 'level', '20', 6),
  ('title-legacy-30', 'title', 'Urso Absolutamente Enorme', 'Título preservado da progressão original.', 'title-legacy-30', 'epic', 'level', '30', 7),
  ('title-legacy-40', 'title', 'Rei da Floresta Proteica', 'Título preservado da progressão original.', 'title-legacy-40', 'epic', 'level', '40', 8),
  ('title-legacy-50', 'title', 'Urso Anabolizado Naturalmente™', 'Título preservado da progressão original.', 'title-legacy-50', 'epic', 'level', '50', 9),
  ('title-legacy-75', 'title', 'Urso Cósmico', 'Título preservado da progressão original.', 'title-legacy-75', 'legendary', 'level', '75', 10),
  ('title-streak-3', 'title', 'Pegando o Ritmo', 'Título por 3 dias de constância.', 'title-streak-3', 'rare', 'streak', '3', 11),
  ('title-streak-7', 'title', 'Urso Consistente', 'Título por 7 dias de constância.', 'title-streak-7', 'rare', 'streak', '7', 12),
  ('title-streak-14', 'title', 'Firme igual pata de urso', 'Título por 14 dias de constância.', 'title-streak-14', 'rare', 'streak', '14', 13),
  ('title-streak-30', 'title', 'Modo Maromba Ativado', 'Título por 30 dias de constância.', 'title-streak-30', 'epic', 'streak', '30', 14),
  ('title-streak-60', 'title', 'Isso já virou personalidade', 'Título por 60 dias de constância.', 'title-streak-60', 'epic', 'streak', '60', 15),
  ('title-streak-100', 'title', 'Lendário da Floresta', 'Título por 100 dias de constância.', 'title-streak-100', 'mythic', 'streak', '100', 16)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, rarity = excluded.rarity,
  unlock_type = excluded.unlock_type, unlock_value = excluded.unlock_value,
  display_order = excluded.display_order, active = true;

-- Migração conservadora: copia o progresso já persistido no snapshot, sem apagá-lo.
with existing_progress as (
  select
    user_id,
    greatest(0, coalesce((payload->'gamification'->>'totalXp')::bigint, 0)) as total_xp,
    greatest(1, coalesce((payload->'gamification'->>'legacyLevelFloor')::integer, 1)) as legacy_floor
  from public.user_app_state
  where jsonb_typeof(payload->'gamification') = 'object'
), calculated_progress as (
  select
    current.user_id,
    current.total_xp,
    current.legacy_floor,
    coalesce((
      select max(level_number)
      from generate_series(1, 999) as level_number
      where ((level_number - 1)::bigint * (360 + (level_number - 2) * 45) / 2) <= current.total_xp
    ), 1) as calculated_level
  from existing_progress as current
)
insert into public.user_progress (user_id, total_xp, narrative_level, legacy_level, journey_version)
select
  user_id,
  total_xp,
  least(100, greatest(legacy_floor, calculated_level)),
  greatest(legacy_floor, calculated_level),
  1
from calculated_progress
on conflict (user_id) do nothing;

insert into public.user_achievement_unlocks (user_id, achievement_key, unlocked_at)
select state.user_id, achievement.key, (achievement.value #>> '{}')::timestamptz
from public.user_app_state as state
cross join lateral jsonb_each(
  case when jsonb_typeof(state.payload->'gamification'->'unlockedAt') = 'object'
    then state.payload->'gamification'->'unlockedAt' else '{}'::jsonb end
) as achievement
on conflict (user_id, achievement_key) do nothing;

insert into public.gamification_events (user_id, idempotency_key, event_type, xp_amount, occurred_at)
select state.user_id, rewarded.value, 'legacy_snapshot', 0, state.updated_at
from public.user_app_state as state
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(state.payload->'gamification'->'rewardedEvents') = 'array'
    then state.payload->'gamification'->'rewardedEvents' else '[]'::jsonb end
) as rewarded(value)
on conflict (user_id, idempotency_key) do nothing;

insert into public.user_chapter_completions (user_id, chapter_id, completed_at)
select
  state.user_id,
  'chapter-' || lpad(completion.key, 2, '0'),
  (completion.value #>> '{}')::timestamptz
from public.user_app_state as state
cross join lateral jsonb_each(
  case when jsonb_typeof(state.payload->'gamification'->'chapterCompletions') = 'object'
    then state.payload->'gamification'->'chapterCompletions' else '{}'::jsonb end
) as completion
where completion.key ~ '^([1-9]|10)$'
on conflict (user_id, chapter_id) do nothing;

insert into public.user_cosmetic_unlocks (user_id, cosmetic_id, source_key)
select progress.user_id, cosmetic.id, 'journey-migration-v1'
from public.user_progress as progress
join public.cosmetic_definitions as cosmetic on
  cosmetic.active = true and (
    cosmetic.unlock_type = 'default'
    or (cosmetic.unlock_type = 'level' and cosmetic.unlock_value::integer <= progress.legacy_level)
  )
on conflict (user_id, cosmetic_id) do nothing;

insert into public.user_cosmetic_unlocks (user_id, cosmetic_id, source_key)
select unlocked.user_id, cosmetic.id, 'achievement:' || unlocked.achievement_key
from public.user_achievement_unlocks as unlocked
join public.cosmetic_definitions as cosmetic
  on cosmetic.unlock_type = 'achievement' and cosmetic.unlock_value = unlocked.achievement_key
on conflict (user_id, cosmetic_id) do nothing;

alter table public.chapter_definitions enable row level security;
alter table public.cosmetic_definitions enable row level security;
alter table public.level_definitions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_progress enable row level security;
alter table public.gamification_events enable row level security;
alter table public.user_chapter_completions enable row level security;
alter table public.user_achievement_unlocks enable row level security;
alter table public.user_cosmetic_unlocks enable row level security;
alter table public.user_equipped_cosmetics enable row level security;
alter table public.profile_featured_items enable row level security;

revoke all on public.chapter_definitions, public.cosmetic_definitions, public.level_definitions from anon;
grant select on public.chapter_definitions, public.cosmetic_definitions, public.level_definitions to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.user_progress, public.gamification_events, public.user_chapter_completions,
  public.user_achievement_unlocks, public.user_cosmetic_unlocks, public.user_equipped_cosmetics to authenticated;
grant select, insert, update, delete on public.profile_featured_items to authenticated;

drop policy if exists "Authenticated users can read chapters" on public.chapter_definitions;
create policy "Authenticated users can read chapters" on public.chapter_definitions for select to authenticated using (true);
drop policy if exists "Authenticated users can read cosmetics" on public.cosmetic_definitions;
create policy "Authenticated users can read cosmetics" on public.cosmetic_definitions for select to authenticated using (true);
drop policy if exists "Authenticated users can read levels" on public.level_definitions;
create policy "Authenticated users can read levels" on public.level_definitions for select to authenticated using (true);

drop policy if exists "Users manage their own private profile" on public.profiles;
create policy "Users manage their own private profile" on public.profiles for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users read their own progress" on public.user_progress;
create policy "Users read their own progress" on public.user_progress for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read their own gamification events" on public.gamification_events;
create policy "Users read their own gamification events" on public.gamification_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read their own chapter completions" on public.user_chapter_completions;
create policy "Users read their own chapter completions" on public.user_chapter_completions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read their own achievement unlocks" on public.user_achievement_unlocks;
create policy "Users read their own achievement unlocks" on public.user_achievement_unlocks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read their own cosmetic unlocks" on public.user_cosmetic_unlocks;
create policy "Users read their own cosmetic unlocks" on public.user_cosmetic_unlocks for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users read their equipped cosmetics" on public.user_equipped_cosmetics;
create policy "Users read their equipped cosmetics" on public.user_equipped_cosmetics for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users manage their featured items" on public.profile_featured_items;
create policy "Users manage their featured items" on public.profile_featured_items for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.validate_my_featured_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id <> auth.uid() then
    raise exception 'Destaque pertence a outro usuário.';
  end if;
  if new.item_type = 'achievement' and not exists (
    select 1 from public.user_achievement_unlocks
    where user_id = new.user_id and achievement_key = new.item_key
  ) then
    raise exception 'Conquista ainda não desbloqueada.';
  end if;
  if new.item_type in ('trophy', 'relic') and not exists (
    select 1
    from public.user_cosmetic_unlocks as unlocked
    join public.cosmetic_definitions as definition on definition.id = unlocked.cosmetic_id
    where unlocked.user_id = new.user_id
      and unlocked.cosmetic_id = new.item_key
      and definition.kind = case when new.item_type = 'trophy' then 'trophy' else 'relic' end
  ) then
    raise exception 'Item ainda não desbloqueado.';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_featured_items_validate on public.profile_featured_items;
create trigger profile_featured_items_validate
before insert or update on public.profile_featured_items
for each row execute function public.validate_my_featured_item();

revoke all on function public.validate_my_featured_item() from public, anon, authenticated;

create or replace function public.equip_my_cosmetic(p_kind text, p_cosmetic_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  definition_kind text;
  definition_unlock_type text;
begin
  if p_kind not in ('avatar', 'frame', 'title', 'banner', 'medallion') then
    raise exception 'Tipo de cosmético inválido.';
  end if;
  select kind, unlock_type into definition_kind, definition_unlock_type
  from public.cosmetic_definitions where id = p_cosmetic_id and active = true;
  if definition_kind is null or definition_kind <> p_kind then
    raise exception 'Cosmético incompatível.';
  end if;
  if definition_unlock_type <> 'default' and not exists (
    select 1 from public.user_cosmetic_unlocks
    where user_id = auth.uid() and cosmetic_id = p_cosmetic_id
  ) then
    raise exception 'Cosmético ainda não desbloqueado.';
  end if;
  insert into public.user_equipped_cosmetics (user_id, kind, cosmetic_id)
  values (auth.uid(), p_kind, p_cosmetic_id)
  on conflict (user_id, kind) do update
    set cosmetic_id = excluded.cosmetic_id, updated_at = now();
end;
$$;

revoke all on function public.equip_my_cosmetic(text, text) from public, anon;
grant execute on function public.equip_my_cosmetic(text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their own profile photos" on storage.objects;
create policy "Users read their own profile photos" on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users upload their own profile photos" on storage.objects;
create policy "Users upload their own profile photos" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users update their own profile photos" on storage.objects;
create policy "Users update their own profile photos" on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Users delete their own profile photos" on storage.objects;
create policy "Users delete their own profile photos" on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on table public.level_definitions is
  'Catálogo versionado da jornada de 100 níveis. Registros pending aguardam o documento-mestre oficial.';
comment on table public.profiles is
  'Perfil próprio do UrsoFit; privado por padrão e sem perfil público nesta etapa.';

commit;
