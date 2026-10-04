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
  description text not null default '',
  first_level smallint not null check (first_level between 1 and 100),
  last_level smallint not null check (last_level between 1 and 100 and last_level >= first_level),
  asset_key text not null unique,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chapter_definitions
  add column if not exists description text not null default '';

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

insert into public.chapter_definitions (id, number, title, description, first_level, last_level, asset_key)
values
  ('chapter-01', 1, 'O Despertar', 'Todo urso começa em algum lugar. Geralmente dormindo.', 1, 10, 'chapter-01-o-despertar'),
  ('chapter-02', 2, 'Criando Raízes', 'O entusiasmo inicial passou. O que fica agora é mais valioso: estrutura.', 11, 20, 'chapter-02-criando-raizes'),
  ('chapter-03', 3, 'Explorando o Caminho', 'Agora não é só manter. É avançar.', 21, 30, 'chapter-03-explorando-o-caminho'),
  ('chapter-04', 4, 'Força em Construção', 'É aqui que o urso começa a parecer mais herói do que iniciante.', 31, 40, 'chapter-04-forca-em-construcao'),
  ('chapter-05', 5, 'A Jornada Fica Séria', 'Aqui o jogo muda. Você já foi longe demais para fingir que foi por acaso.', 41, 50, 'chapter-05-a-jornada-fica-seria'),
  ('chapter-06', 6, 'Subindo a Montanha', 'Agora o ar fica mais fino e o progresso mais nobre.', 51, 60, 'chapter-06-subindo-a-montanha'),
  ('chapter-07', 7, 'Provação', 'Toda boa jornada passa por um trecho em que a chama precisa vir de dentro.', 61, 70, 'chapter-07-provacao'),
  ('chapter-08', 8, 'Maestria', 'O esforço deixou de parecer esforço. Virou linguagem natural.', 71, 80, 'chapter-08-maestria'),
  ('chapter-09', 9, 'O Raro e o Lendário', 'Agora a jornada ganha brilho próprio.', 81, 90, 'chapter-09-raro-e-lendario'),
  ('chapter-10', 10, 'A Lenda UrsoFit', 'O fim da jornada não é um fim. É um título.', 91, 100, 'chapter-10-lenda-ursofit')
on conflict (id) do update set
  number = excluded.number, title = excluded.title, description = excluded.description, first_level = excluded.first_level,
  last_level = excluded.last_level, asset_key = excluded.asset_key, active = true;

insert into public.cosmetic_definitions
  (id, kind, name, description, asset_key, rarity, unlock_type, unlock_value, secret, display_order)
values
  ('frame-classic', 'frame', 'Moldura da Toca', 'Moldura inicial do perfil.', 'frame-classic', 'common', 'default', null, false, 1),
  ('banner-cave', 'banner', 'Luz da Caverna', 'Banner inicial da jornada.', 'banner-cave', 'common', 'default', null, false, 1),
  ('avatar-01', 'avatar', 'Urso Clássico', 'Mascote padrão, esportivo e simpático.', 'bear-urso-classico', 'common', 'default', null, false, 1),
  ('avatar-02', 'avatar', 'Urso Maromba', 'Regata, físico atlético e shaker.', 'bear-urso-maromba', 'common', 'achievement', 'strength-milestone', false, 2),
  ('avatar-03', 'avatar', 'Urso das Neves', 'Pelagem branca, detalhes azul-claro.', 'bear-urso-das-neves', 'common', 'future', 'journey-or-event-milestone', false, 3),
  ('avatar-04', 'avatar', 'Urso Emo', 'Preto/roxo, franja e expressão dramática.', 'bear-urso-emo', 'common', 'future', 'emo-theme-cosmetic', false, 4),
  ('avatar-05', 'avatar', 'Urso Gratiluz', 'Claro, solar, flor/estrela discreta.', 'bear-urso-gratiluz', 'common', 'future', 'gratiluz-theme-cosmetic', false, 5),
  ('avatar-06', 'avatar', 'Urso Caipira', 'Chapéu de palha e xadrez discreto.', 'bear-urso-caipira', 'rare', 'future', 'seasonal-collection', false, 6),
  ('avatar-07', 'avatar', 'Urso Corredor', 'Faixa, smartwatch e visual runner.', 'bear-urso-corredor', 'rare', 'achievement', 'running-milestone', false, 7),
  ('avatar-08', 'avatar', 'Urso Ciclista', 'Capacete e óculos esportivos.', 'bear-urso-ciclista', 'rare', 'achievement', 'cycling-milestone', false, 8),
  ('avatar-09', 'avatar', 'Urso Lutador', 'Bandagens/luvas; visual genérico de luta.', 'bear-urso-lutador', 'rare', 'achievement', 'combat-milestone', false, 9),
  ('avatar-10', 'avatar', 'Urso Zen', 'Roupa leve e pose tranquila.', 'bear-urso-zen', 'rare', 'achievement', 'mobility-milestone', false, 10),
  ('avatar-11', 'avatar', 'Urso HIIT', 'Faixa, suor fofo e energia.', 'bear-urso-hiit', 'rare', 'achievement', 'hiit-cardio-milestone', false, 11),
  ('avatar-12', 'avatar', 'Chef da Caverna', 'Avental e chapéu de chef.', 'bear-chef-da-caverna', 'epic', 'achievement', 'food-creation-milestone', false, 12),
  ('avatar-13', 'avatar', 'Urso Noturno', 'Azul-marinho, lua e olheiras fofas.', 'bear-urso-noturno', 'epic', 'achievement', 'night-owl', true, 13),
  ('avatar-14', 'avatar', 'Urso Explorador', 'Mochila e bússola.', 'bear-urso-explorador', 'epic', 'chapter', '3', false, 14),
  ('avatar-15', 'avatar', 'Urso Brilho Raro', 'Variante shiny/iridescente.', 'bear-urso-brilho-raro', 'mythic', 'level', '95', false, 15)
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

update public.level_definitions as levels
set
  title = official.title,
  description = official.description,
  asset_description = 'Colecionável 3D exclusivo do nível ' || official.number ||
    ', ' || official.title || '; produção gráfica tratada separadamente.',
  content_status = 'official'
from (values
  (1, 'Ursinho Desperto', 'Toda grande jornada começa quando alguém finalmente abre os olhos.'),
  (2, 'Saindo da Toca', 'O primeiro desafio nem sempre é treinar. Às vezes é só sair da toca mesmo.'),
  (3, 'Primeiros Passos', 'Um pequeno passo para o urso, um grande passo para a sua rotina.'),
  (4, 'Urso Persistente', 'Nem todo dia é grandioso. O importante é aparecer.'),
  (5, 'Guardião da Rotina', 'A rotina começou a nascer. Agora ela precisa ser protegida.'),
  (6, 'Ritmo Encontrado', 'Motivação vai e volta. Ritmo é o que faz você continuar.'),
  (7, 'Caminho Aberto', 'Você não está mais parado. A trilha já reconhece seus passos.'),
  (8, 'Passos Firmes', 'Ainda não é velocidade. É constância com convicção.'),
  (9, 'Quase um Hábito', 'Você já não depende tanto do ''amanhã eu começo''.'),
  (10, 'Primeira Insígnia', 'Parabéns, treinador... digo, aventureiro. A jornada começou de verdade.'),
  (11, 'Urso Comprometido', 'Você deixou de testar. Agora está se comprometendo.'),
  (12, 'Força do Hábito', 'Pequenas ações repetidas começam a parecer magia.'),
  (13, 'Pequenas Vitórias', 'Nem todo troféu faz barulho. Alguns só fazem diferença.'),
  (14, 'Constância Silenciosa', 'O progresso gosta de gente que não precisa anunciar tudo.'),
  (15, 'Raízes Fortes', 'O que cresce bonito costuma começar por baixo da terra.'),
  (16, 'Dia Após Dia', 'Não parece épico... e é exatamente assim que funciona.'),
  (17, 'Ritual da Toca', 'Alguns chamam de rotina. Outros de ritual sagrado.'),
  (18, 'Companheiro da Rotina', 'A rotina já não é inimiga. Ela sentou do seu lado.'),
  (19, 'Caminho Conhecido', 'O início já não assusta. Você sabe por onde ir.'),
  (20, 'Urso Disciplinado', 'Motivação é visita. Disciplina já mora aqui.'),
  (21, 'Além da Toca', 'Existe um mundo inteiro depois do ''não tô com vontade''.'),
  (22, 'Trilha Conhecida', 'Você não está perdido; só está indo mais longe do que antes.'),
  (23, 'Passos de Aventureiro', 'Sua rotina ganhou espírito de jornada.'),
  (24, 'Urso Explorador', 'Quem sai da toca descobre que o mundo é maior do que o sofá.'),
  (25, 'Primeiro Marco', 'Você chegou num ponto em que dá para olhar para trás e sorrir.'),
  (26, 'Caminho das Pedras', 'Nem todo terreno é confortável. Ainda bem.'),
  (27, 'Subindo a Colina', 'O cenário muda quando você continua mesmo cansado.'),
  (28, 'Fôlego de Aventureiro', 'Você aprendeu que respirar fundo também é estratégia.'),
  (29, 'Horizonte Novo', 'Quanto mais você anda, mais o mapa cresce.'),
  (30, 'Guardião da Trilha', 'Você não apenas segue o caminho. Agora parece fazer parte dele.'),
  (31, 'Urso Determinado', 'Determinação é continuar mesmo sem trilha sonora épica.'),
  (32, 'Força em Construção', 'Nem toda evolução aparece no espelho primeiro.'),
  (33, 'Mais Forte que Ontem', 'A competição mais justa continua sendo contra o seu eu de ontem.'),
  (34, 'Passo Pesado', 'Seus passos já fazem o chão perceber sua presença.'),
  (35, 'Patas Firmes', 'Base forte, mente estável, rotina viva.'),
  (36, 'Urso Resistente', 'A força impressiona. A resistência sustenta.'),
  (37, 'Força Interior', 'O verdadeiro upgrade quase nunca é só físico.'),
  (38, 'Ritmo de Ferro', 'O corpo cansa. O hábito empurra.'),
  (39, 'Coragem Renovada', 'Às vezes a coragem volta depois do banho e da creatina.'),
  (40, 'Guardião da Força', 'A força deixou de ser meta. Já é parte da sua identidade.'),
  (41, 'Viajante Experiente', 'Não é mais começo de jornada. É bagagem.'),
  (42, 'A Resposta do Caminho', 'Você chegou até aqui buscando respostas. Pena que ninguém lembrou a pergunta.'),
  (43, 'Urso Experiente', 'Você já sabe reconhecer o que é cansaço... e o que é desculpa.'),
  (44, 'Caminho sem Atalhos', 'Infelizmente, o portal mágico ainda não foi desbloqueado.'),
  (45, 'Persistência Rara', 'Pouca gente entende o poder de insistir com elegância.'),
  (46, 'Além do Cansaço', 'Às vezes a linha entre desistir e evoluir dura mais cinco minutos.'),
  (47, 'Passos de Veterano', 'Seus passos carregam memória. E um pouco de dor na panturrilha também.'),
  (48, 'Força e Equilíbrio', 'Ficar forte é bom. Permanecer inteiro é melhor.'),
  (49, 'Quase Mestre', 'Você ainda não virou lenda. Mas já está dando trabalho pros iniciantes.'),
  (50, 'Metade da Montanha', 'Metade do caminho. O bom é que a vista já começou a compensar.'),
  (51, 'Urso Montanhista', 'O terreno ficou mais inclinado, mas você também ficou maior.'),
  (52, 'Terreno Elevado', 'Você começou a habitar lugares que antes pareciam difíceis demais.'),
  (53, 'Subida Constante', 'Nem rápido, nem bonito. Só constante. E isso resolve muita coisa.'),
  (54, 'Sem Voltar Atrás', 'Não porque não dá, mas porque já não faz sentido.'),
  (55, 'Acima das Nuvens', 'Você descobriu que alguns cenários só aparecem pra quem continua subindo.'),
  (56, 'Passos nas Alturas', 'O medo ainda existe. Só não manda mais.'),
  (57, 'Resistência Ancestral', 'Há uma energia antiga em quem aprende a persistir.'),
  (58, 'Urso Implacável', 'Não confundir com raiva. É só consistência em estado bruto.'),
  (59, 'O Caminho Continua', 'O topo sempre revela outro topo. Curiosamente, isso é animador.'),
  (60, 'Guardião da Montanha', 'Você já não parece visitante. Parece parte da paisagem.'),
  (61, 'Urso Incansável', 'Cansa, sim. Só não para.'),
  (62, 'Chama Interior', 'Alguns combustíveis não vêm em pote.'),
  (63, 'Dias Difíceis', 'Nem todo vilão tem rosto. Às vezes ele atende por preguiça.'),
  (64, 'Ainda de Pé', 'Se você permaneceu, já venceu mais do que parece.'),
  (65, 'Força Renovada', 'Às vezes o upgrade vem depois da pausa certa.'),
  (66, 'Depois da Tempestade', 'Há algo de mágico na calmaria depois de um período difícil.'),
  (67, 'Mais Uma Vez', 'Heróis e hábitos têm isso em comum: voltam no dia seguinte.'),
  (68, 'Além dos Limites', 'Muitos limites eram só cercas mal posicionadas.'),
  (69, 'Equilíbrio Perfeito', 'Algumas conquistas são autoexplicativas. Esta, por educação, deixaremos em silêncio.'),
  (70, 'Guardião da Chama', 'A chama não é mais acaso. Você aprendeu a cuidar dela.'),
  (71, 'Urso Mestre', 'Não porque sabe tudo. Mas porque aprendeu a continuar.'),
  (72, 'Mestre da Rotina', 'A rotina já não exige negociação diária.'),
  (73, 'Passos Precisos', 'Menos desperdício. Mais intenção.'),
  (74, 'Força Tranquila', 'A verdadeira força raramente precisa fazer alarde.'),
  (75, 'Veterano da Toca', 'Você se lembra de onde começou — e isso torna tudo melhor.'),
  (76, 'Caminho Dominado', 'O mapa deixou de ser um mistério. Agora é território conhecido.'),
  (77, 'Disciplina Natural', 'O que antes era esforço, agora parece parte da sua natureza.'),
  (78, 'Mestre dos Hábitos', 'Pequenas repetições: o superpoder mais subestimado do mundo.'),
  (79, 'Urso Inabalável', 'O vento muda. A rotina não.'),
  (80, 'Guardião do Equilíbrio', 'Força, descanso, constância e leveza finalmente aprenderam a morar juntos.'),
  (81, 'Urso Excepcional', 'Você começou a se destacar até do seu eu imaginário.'),
  (82, 'Além da Rotina', 'Isso já não é só hábito. É identidade.'),
  (83, 'Marca do Veterano', 'Todo aventureiro de verdade carrega sinais da jornada.'),
  (84, 'Trilha Lendária', 'Há caminhos que se tornam lenda porque alguém insistiu neles.'),
  (85, 'Guardião Antigo', 'Sua rotina parece ter sido escrita em pedra.'),
  (86, 'Urso de Muitas Jornadas', 'Você já não acumula dias. Acumula capítulos.'),
  (87, 'Sabedoria da Toca', 'Nem todo conhecimento vem de livros. Às vezes vem de repetir o básico muito bem.'),
  (88, 'Caminhante das Estrelas', 'Seus passos parecem guiados por alguma força... cósmica, talvez.'),
  (89, 'Força Desperta', 'Sentiu isso? Pode ser evolução. Pode ser o pré-treino.'),
  (90, 'Guardião da Jornada', 'Você não só venceu etapas. Você se tornou símbolo do caminho.'),
  (91, 'Urso Ascendente', 'Já não dá para falar em progresso. Agora é ascensão mesmo.'),
  (92, 'Além da Montanha', 'O topo era só o começo do que vinha depois.'),
  (93, 'Guardião Supremo', 'Você protege aquilo que construiu porque sabe o valor de cada passo.'),
  (94, 'Urso Lendário', 'Alguns ouvem falar. Poucos chegam aqui.'),
  (95, 'Brilho Raro', 'Há quem passe a vida inteira sem encontrar um destes.'),
  (96, 'Lenda da Floresta', 'Seu nome já circula pela mata em tom de respeito... e leve inveja.'),
  (97, 'Mestre da Jornada', 'Você não venceu apenas níveis. Você aprendeu a jornada.'),
  (98, 'Último Desafio', 'Todo final digno precisa de um último portal.'),
  (99, 'Guardião da Toca', 'Você voltou ao início, mas já não é o mesmo urso que saiu de lá.'),
  (100, 'Lenda UrsoFit', 'O urso despertou, caminhou, caiu, subiu, brilhou — e virou lenda.')
) as official(number, title, description)
where levels.number = official.number;

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
  'Catálogo versionado da jornada oficial de 100 níveis do UrsoGame.';
comment on table public.profiles is
  'Perfil próprio do UrsoFit; privado por padrão e sem perfil público nesta etapa.';

commit;
