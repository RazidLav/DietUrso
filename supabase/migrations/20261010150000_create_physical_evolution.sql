begin;

create type public.physical_goal_type as enum ('fat_loss','muscle_gain','recomposition','maintenance','performance','custom');
create type public.assessment_completeness as enum ('partial','complete');
create type public.progress_photo_view as enum ('front','back','left','right','free','additional');

create table public.physical_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_type public.physical_goal_type not null default 'recomposition',
  custom_label text check (custom_label is null or char_length(custom_label) between 1 and 80),
  target_metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(target_metrics) = 'object'),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.physical_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null,
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg between 10 and 600),
  height_cm numeric(6,2) check (height_cm is null or height_cm between 50 and 280),
  notes text check (notes is null or char_length(notes) <= 2000),
  source text check (source is null or char_length(source) <= 120),
  method text check (method is null or char_length(method) <= 120),
  unit_system text not null default 'metric' check (unit_system in ('metric','imperial')),
  equipment text check (equipment is null or char_length(equipment) <= 120),
  completeness public.assessment_completeness not null default 'partial',
  composition jsonb not null default '{}'::jsonb check (jsonb_typeof(composition) = 'object'),
  custom_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(custom_fields) = 'array'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint physical_assessments_has_data check (weight_kg is not null or composition <> '{}'::jsonb or custom_fields <> '[]'::jsonb)
);
create index physical_assessments_user_taken_idx on public.physical_assessments(user_id, taken_at desc) where deleted_at is null;

create table public.assessment_measurements (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.physical_assessments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('neck','shoulders','chest','right_arm','left_arm','right_forearm','left_forearm','waist','abdomen','hips','right_thigh','left_thigh','right_calf','left_calf')),
  value numeric(8,2) not null check (value > 0 and value < 1000),
  unit text not null default 'cm' check (unit in ('cm','in')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, metric)
);
create index assessment_measurements_user_metric_idx on public.assessment_measurements(user_id, metric, created_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid references public.physical_assessments(id) on delete set null,
  view_type public.progress_photo_view not null,
  storage_path text not null,
  thumbnail_path text,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  captured_at timestamptz not null,
  notes text check (notes is null or char_length(notes) <= 500),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, storage_path)
);
create index progress_photos_user_captured_idx on public.progress_photos(user_id, captured_at desc) where deleted_at is null;

create table public.assessment_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  before_assessment_id uuid not null references public.physical_assessments(id) on delete cascade,
  after_assessment_id uuid not null references public.physical_assessments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (before_assessment_id <> after_assessment_id),
  unique(user_id, before_assessment_id, after_assessment_id)
);

create or replace function public.validate_assessment_measurement_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.physical_assessments a where a.id = new.assessment_id and a.user_id = new.user_id) then
    raise exception 'assessment does not belong to user';
  end if;
  return new;
end $$;
create trigger assessment_measurement_owner before insert or update on public.assessment_measurements for each row execute function public.validate_assessment_measurement_owner();

create or replace function public.validate_progress_photo_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.assessment_id is not null and not exists (select 1 from public.physical_assessments a where a.id = new.assessment_id and a.user_id = new.user_id) then
    raise exception 'assessment does not belong to user';
  end if;
  return new;
end $$;
create trigger progress_photo_owner before insert or update on public.progress_photos for each row execute function public.validate_progress_photo_owner();

create trigger physical_goals_updated before update on public.physical_goals for each row execute function public.ursofit_set_updated_at();
create trigger physical_assessments_updated before update on public.physical_assessments for each row execute function public.ursofit_set_updated_at();
create trigger assessment_measurements_updated before update on public.assessment_measurements for each row execute function public.ursofit_set_updated_at();
create trigger progress_photos_updated before update on public.progress_photos for each row execute function public.ursofit_set_updated_at();

alter table public.physical_goals enable row level security;
alter table public.physical_assessments enable row level security;
alter table public.assessment_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.assessment_comparisons enable row level security;

create policy "owners manage physical goals" on public.physical_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners manage assessments" on public.physical_assessments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners manage assessment measurements" on public.assessment_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners manage progress photo metadata" on public.progress_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "owners manage comparisons" on public.assessment_comparisons for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "users read own progress photos" on storage.objects for select using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users upload own progress photos" on storage.objects for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));
create policy "users update own progress photos" on storage.objects for update using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own progress photos" on storage.objects for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
