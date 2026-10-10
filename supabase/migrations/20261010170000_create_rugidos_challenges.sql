begin;

create table public.rugidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience public.social_audience not null default 'friends',
  rugido_type text not null check (rugido_type in ('photo','video','text','workout','meal','achievement','trophy','progress','challenge','mascot')),
  body text check (body is null or char_length(body) <= 1000),
  background_key text,
  published_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(published_payload)='object'),
  archive_privately boolean not null default true,
  expires_at timestamptz not null default (now()+interval '24 hours'),
  deleted_at timestamptz,
  view_count integer not null default 0 check(view_count>=0),
  reaction_count integer not null default 0 check(reaction_count>=0),
  created_at timestamptz not null default now(),
  idempotency_key text,
  unique(user_id,idempotency_key),
  check(expires_at<=created_at+interval '25 hours')
);
create index rugidos_active_idx on public.rugidos(created_at desc) where deleted_at is null;

create table public.rugido_media (
  id uuid primary key default gen_random_uuid(), rugido_id uuid not null references public.rugidos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, storage_path text not null,
  media_type text not null check(media_type in ('image','video')), mime_type text not null,
  size_bytes integer not null check(size_bytes between 1 and 26214400), duration_seconds integer check(duration_seconds is null or duration_seconds between 1 and 30),
  alt_text text check(alt_text is null or char_length(alt_text)<=500), created_at timestamptz not null default now()
);
create table public.rugido_views (
  rugido_id uuid not null references public.rugidos(id) on delete cascade, viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(), primary key(rugido_id,viewer_id)
);
create table public.rugido_reactions (
  rugido_id uuid not null references public.rugidos(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check(reaction in ('like','strength','support','celebrate')), created_at timestamptz not null default now(), primary key(rugido_id,user_id)
);

create type public.challenge_state as enum ('draft','enrollment','scheduled','active','finished','canceled','archived');
create type public.challenge_privacy as enum ('private','friends','public');
create type public.challenge_kind as enum ('individual','friends','group','teams','system');

create table public.challenges (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(btrim(name)) between 3 and 100), description text check(description is null or char_length(description)<=3000),
  image_path text, kind public.challenge_kind not null default 'friends', privacy public.challenge_privacy not null default 'friends',
  starts_at timestamptz not null, ends_at timestamptz not null, valid_modalities text[] not null default '{}',
  max_participants integer check(max_participants is null or max_participants between 2 and 10000), tie_breaker text not null default 'earliest_score',
  entry_rules text, state public.challenge_state not null default 'draft', rule_version integer not null default 1 check(rule_version>0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  check(ends_at>starts_at)
);
create index challenges_discovery_idx on public.challenges(state,privacy,starts_at);

create table public.challenge_rules (
  challenge_id uuid primary key references public.challenges(id) on delete cascade,
  metric text not null check(metric in ('sessions','activity_minutes','distance_km','modality_sessions','plan_days','hydration_goal','food_log','streak','strength_volume','custom_points')),
  points_per_unit numeric(10,3) not null default 1 check(points_per_unit>0), daily_limit numeric(12,3) check(daily_limit is null or daily_limit>0),
  proof_type text not null default 'ursofit_activity' check(proof_type in ('ursofit_activity','photo','manual','creator_approval')),
  custom_rule jsonb not null default '{}'::jsonb check(jsonb_typeof(custom_rule)='object'), rule_version integer not null default 1 check(rule_version>0),
  updated_at timestamptz not null default now()
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid, status text not null default 'joined' check(status in ('invited','joined','left','finished','disqualified')),
  joined_at timestamptz not null default now(), finished_at timestamptz, primary key(challenge_id,user_id)
);
create index challenge_members_user_idx on public.challenge_members(user_id,status,joined_at desc);

create table public.challenge_teams (
  id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  captain_id uuid not null references auth.users(id) on delete cascade, name text not null check(char_length(btrim(name)) between 2 and 60),
  created_at timestamptz not null default now(), unique(challenge_id,name)
);
alter table public.challenge_members add constraint challenge_members_team_fk foreign key(team_id) references public.challenge_teams(id) on delete set null;

create table public.challenge_activities (
  id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, source_type text not null check(source_type in ('workout','running','cycling','hydration','nutrition','manual')),
  source_id text not null, occurred_at timestamptz not null, raw_value numeric(12,3) not null check(raw_value>=0),
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'), rule_version integer not null,
  verified_status text not null default 'verified' check(verified_status in ('pending','verified','rejected')), points_awarded numeric(12,3) not null default 0 check(points_awarded>=0),
  created_at timestamptz not null default now(), unique(challenge_id,user_id,source_type,source_id)
);
create index challenge_activities_rank_idx on public.challenge_activities(challenge_id,user_id,occurred_at);

create table public.challenge_scores (
  challenge_id uuid not null references public.challenges(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  points numeric(14,3) not null default 0, activity_count integer not null default 0, last_activity_at timestamptz,
  updated_at timestamptz not null default now(), primary key(challenge_id,user_id)
);

create table public.challenge_medals (
  id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.challenges(id) on delete cascade,
  medal_key text not null, title text not null, position integer, rarity text not null default 'Comum', asset_key text not null,
  rule_version integer not null, created_at timestamptz not null default now(), unique(challenge_id,medal_key)
);
create table public.user_medals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id) on delete cascade, medal_id uuid not null references public.challenge_medals(id) on delete restrict,
  position integer, final_score numeric(14,3) not null, rule_version integer not null, awarded_at timestamptz not null default now(),
  audit_payload jsonb not null default '{}'::jsonb, unique(user_id,challenge_id,medal_id)
);

create or replace function public.record_gamification_event(event_key text,event_name text,event_xp integer,event_metadata jsonb default '{}'::jsonb)
returns public.gamification_events language plpgsql security definer set search_path=public as $$
declare result public.gamification_events; allowed text[]:=array['physical_assessment_created','body_measurement_logged','progress_photo_added','assessment_compared','goal_progress_detected','friendship_created','social_post_created','achievement_shared','rugido_created','challenge_joined','challenge_completed','challenge_medal_awarded','social_reaction_received'];
begin
  if auth.uid() is null or not(event_name=any(allowed)) or event_xp<0 or event_xp>500 then raise exception 'invalid gamification event'; end if;
  insert into public.gamification_events(user_id,idempotency_key,event_type,xp_amount,metadata)
  values(auth.uid(),event_key,event_name,event_xp,coalesce(event_metadata,'{}'::jsonb))
  on conflict(user_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into result;
  return result;
end $$;

create or replace function public.join_challenge(target_challenge uuid)
returns public.challenge_members language plpgsql security definer set search_path=public as $$
declare result public.challenge_members; challenge_row public.challenges;
begin
  select * into challenge_row from public.challenges where id=target_challenge and state in ('enrollment','scheduled','active') and (privacy='public' or creator_id=auth.uid() or (privacy='friends' and public.users_are_friends(creator_id,auth.uid())));
  if challenge_row.id is null then raise exception 'challenge unavailable'; end if;
  if challenge_row.max_participants is not null and (select count(*) from public.challenge_members where challenge_id=target_challenge and status='joined')>=challenge_row.max_participants then raise exception 'challenge full'; end if;
  insert into public.challenge_members(challenge_id,user_id,status) values(target_challenge,auth.uid(),'joined') on conflict(challenge_id,user_id) do update set status='joined',joined_at=now() returning * into result;
  perform public.record_gamification_event('challenge_joined:'||target_challenge,'challenge_joined',25,jsonb_build_object('challenge_id',target_challenge));
  return result;
end $$;

create or replace function public.submit_challenge_activity(target_challenge uuid,activity_source_type text,activity_source_id text,activity_at timestamptz,activity_value numeric,activity_evidence jsonb default '{}'::jsonb)
returns public.challenge_activities language plpgsql security definer set search_path=public as $$
declare result public.challenge_activities; rule_row public.challenge_rules; challenge_row public.challenges; awarded numeric; used_today numeric;
begin
  select * into challenge_row from public.challenges where id=target_challenge and state='active' and activity_at between starts_at and ends_at;
  if challenge_row.id is null or not exists(select 1 from public.challenge_members where challenge_id=target_challenge and user_id=auth.uid() and status='joined') then raise exception 'challenge activity unavailable'; end if;
  select * into rule_row from public.challenge_rules where challenge_id=target_challenge;
  if rule_row.challenge_id is null or activity_value<0 then raise exception 'invalid activity'; end if;
  select coalesce(sum(raw_value),0) into used_today from public.challenge_activities where challenge_id=target_challenge and user_id=auth.uid() and occurred_at::date=activity_at::date and verified_status='verified';
  awarded:=least(activity_value,coalesce(greatest(rule_row.daily_limit-used_today,0),activity_value))*rule_row.points_per_unit;
  insert into public.challenge_activities(challenge_id,user_id,source_type,source_id,occurred_at,raw_value,evidence,rule_version,verified_status,points_awarded)
  values(target_challenge,auth.uid(),activity_source_type,activity_source_id,activity_at,activity_value,coalesce(activity_evidence,'{}'::jsonb),rule_row.rule_version,case when rule_row.proof_type in ('manual','creator_approval') then 'pending' else 'verified' end,case when rule_row.proof_type in ('manual','creator_approval') then 0 else awarded end)
  on conflict(challenge_id,user_id,source_type,source_id) do nothing returning * into result;
  if result.id is null then raise exception 'activity already submitted'; end if;
  insert into public.challenge_scores(challenge_id,user_id,points,activity_count,last_activity_at)
  values(target_challenge,auth.uid(),result.points_awarded,case when result.points_awarded>0 then 1 else 0 end,activity_at)
  on conflict(challenge_id,user_id) do update set points=public.challenge_scores.points+excluded.points,activity_count=public.challenge_scores.activity_count+excluded.activity_count,last_activity_at=greatest(public.challenge_scores.last_activity_at,excluded.last_activity_at),updated_at=now();
  return result;
end $$;

create or replace function public.refresh_rugido_counts()
returns trigger language plpgsql security definer set search_path=public as $$ declare target uuid:=coalesce(new.rugido_id,old.rugido_id); begin
 update public.rugidos set view_count=(select count(*) from public.rugido_views where rugido_id=target),reaction_count=(select count(*) from public.rugido_reactions where rugido_id=target) where id=target; return coalesce(new,old); end $$;
create trigger rugido_view_count after insert or delete on public.rugido_views for each row execute function public.refresh_rugido_counts();
create trigger rugido_reaction_count after insert or delete on public.rugido_reactions for each row execute function public.refresh_rugido_counts();
create trigger challenges_updated before update on public.challenges for each row execute function public.ursofit_set_updated_at();

alter table public.rugidos enable row level security; alter table public.rugido_media enable row level security; alter table public.rugido_views enable row level security; alter table public.rugido_reactions enable row level security;
alter table public.challenges enable row level security; alter table public.challenge_rules enable row level security; alter table public.challenge_members enable row level security; alter table public.challenge_teams enable row level security; alter table public.challenge_activities enable row level security; alter table public.challenge_scores enable row level security; alter table public.challenge_medals enable row level security; alter table public.user_medals enable row level security;
create policy "audience reads active rugidos" on public.rugidos for select using((deleted_at is null and expires_at>now() and public.can_view_audience(user_id,audience)) or (auth.uid()=user_id and archive_privately));
create policy "owners create rugidos" on public.rugidos for insert with check(auth.uid()=user_id); create policy "owners update rugidos" on public.rugidos for update using(auth.uid()=user_id) with check(auth.uid()=user_id); create policy "owners delete rugidos" on public.rugidos for delete using(auth.uid()=user_id);
create policy "audience reads rugido media" on public.rugido_media for select using(exists(select 1 from public.rugidos r where r.id=rugido_id and public.can_view_audience(r.user_id,r.audience) and r.deleted_at is null));
create policy "owners manage rugido media" on public.rugido_media for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "owners read rugido views" on public.rugido_views for select using(exists(select 1 from public.rugidos r where r.id=rugido_id and r.user_id=auth.uid()));
create policy "viewers record own view" on public.rugido_views for insert with check(auth.uid()=viewer_id and exists(select 1 from public.rugidos r where r.id=rugido_id and public.can_view_audience(r.user_id,r.audience)));
create policy "audience reads rugido reactions" on public.rugido_reactions for select using(exists(select 1 from public.rugidos r where r.id=rugido_id and public.can_view_audience(r.user_id,r.audience)));
create policy "users manage own rugido reactions" on public.rugido_reactions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "users discover challenges" on public.challenges for select using(creator_id=auth.uid() or privacy='public' or (privacy='friends' and public.users_are_friends(creator_id,auth.uid())) or exists(select 1 from public.challenge_members m where m.challenge_id=challenges.id and m.user_id=auth.uid()));
create policy "users create challenges" on public.challenges for insert with check(auth.uid()=creator_id and kind<>'system'); create policy "creators update challenges" on public.challenges for update using(auth.uid()=creator_id) with check(auth.uid()=creator_id);
create policy "participants read rules" on public.challenge_rules for select using(exists(select 1 from public.challenges c where c.id=challenge_id)); create policy "creators manage rules" on public.challenge_rules for all using(exists(select 1 from public.challenges c where c.id=challenge_id and c.creator_id=auth.uid())) with check(exists(select 1 from public.challenges c where c.id=challenge_id and c.creator_id=auth.uid()));
create policy "participants read members" on public.challenge_members for select using(exists(select 1 from public.challenges c where c.id=challenge_id)); create policy "members leave challenge" on public.challenge_members for update using(auth.uid()=user_id) with check(auth.uid()=user_id and status in ('left','finished'));
create policy "participants read teams" on public.challenge_teams for select using(exists(select 1 from public.challenges c where c.id=challenge_id)); create policy "creators manage teams" on public.challenge_teams for all using(exists(select 1 from public.challenges c where c.id=challenge_id and c.creator_id=auth.uid())) with check(exists(select 1 from public.challenges c where c.id=challenge_id and c.creator_id=auth.uid()));
create policy "participants read challenge activities" on public.challenge_activities for select using(exists(select 1 from public.challenge_members m where m.challenge_id=challenge_id and m.user_id=auth.uid()) or exists(select 1 from public.challenges c where c.id=challenge_id and c.creator_id=auth.uid()));
create policy "participants read scores" on public.challenge_scores for select using(exists(select 1 from public.challenges c where c.id=challenge_id));
create policy "users read challenge medals" on public.challenge_medals for select using(exists(select 1 from public.challenges c where c.id=challenge_id)); create policy "users read awarded medals" on public.user_medals for select using(auth.uid()=user_id or exists(select 1 from public.profiles p where p.user_id=user_medals.user_id and (p.profile_visibility='public' or (p.profile_visibility='friends' and public.users_are_friends(auth.uid(),p.user_id)))));

create policy "audience reads Rugido media objects" on storage.objects for select using(
  bucket_id='social-media' and auth.uid() is not null and exists(
    select 1 from public.rugido_media m join public.rugidos r on r.id=m.rugido_id
    where m.storage_path=name and r.deleted_at is null and (r.expires_at>now() or r.user_id=auth.uid()) and public.can_view_audience(r.user_id,r.audience)
  )
);

revoke all on function public.record_gamification_event(text,text,integer,jsonb) from public; grant execute on function public.record_gamification_event(text,text,integer,jsonb) to authenticated;
revoke all on function public.join_challenge(uuid) from public; grant execute on function public.join_challenge(uuid) to authenticated;
revoke all on function public.submit_challenge_activity(uuid,text,text,timestamptz,numeric,jsonb) from public; grant execute on function public.submit_challenge_activity(uuid,text,text,timestamptz,numeric,jsonb) to authenticated;

commit;
