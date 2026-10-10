begin;

create table public.training_session_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  event_type text not null check (event_type in ('started','set_completed','set_reopened','paused','resumed','exercise_substituted','finished','synced')),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, idempotency_key)
);
create index training_session_events_session_idx on public.training_session_events(user_id, session_id, occurred_at);

create table public.exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  planned_exercise_id text,
  executed_exercise_id text not null,
  planned_snapshot jsonb not null check (jsonb_typeof(planned_snapshot) = 'object'),
  executed_snapshot jsonb not null check (jsonb_typeof(executed_snapshot) = 'object'),
  reason text check (reason is null or char_length(reason) <= 500),
  scope text not null default 'session' check (scope in ('session','plan')),
  created_at timestamptz not null default now(),
  unique(user_id, session_id, planned_exercise_id)
);

create table public.training_progression_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  source_session_id text not null,
  rule_key text not null,
  rule_version integer not null default 1 check (rule_version > 0),
  suggestion jsonb not null check (jsonb_typeof(suggestion) = 'object'),
  status text not null default 'pending' check (status in ('pending','accepted','dismissed','expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique(user_id, source_session_id, exercise_id, rule_key, rule_version)
);
create index training_progression_suggestions_user_idx on public.training_progression_suggestions(user_id, status, created_at desc);

alter table public.training_session_events enable row level security;
alter table public.exercise_substitutions enable row level security;
alter table public.training_progression_suggestions enable row level security;
create policy "owners read training events" on public.training_session_events for select using (auth.uid() = user_id);
create policy "owners insert training events" on public.training_session_events for insert with check (auth.uid() = user_id);
create policy "owners manage substitutions" on public.exercise_substitutions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners read suggestions" on public.training_progression_suggestions for select using (auth.uid() = user_id);
create policy "owners decide suggestions" on public.training_progression_suggestions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
