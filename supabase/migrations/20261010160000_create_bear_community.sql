begin;

alter table public.profiles drop constraint if exists profiles_privacy_check;
alter table public.profiles
  add column if not exists banner_path text,
  add column if not exists favorite_modalities text[] not null default '{}',
  add column if not exists profile_visibility text not null default 'private' check (profile_visibility in ('private','friends','public')),
  add column if not exists content_visibility jsonb not null default '{"workouts":"friends","nutrition":"private","hydration":"private","achievements":"friends","evolution":"private","photos":"private","rugidos":"friends","challenges":"friends"}'::jsonb check (jsonb_typeof(content_visibility) = 'object');
update public.profiles set profile_visibility = case when privacy = 'future_public' then 'public' else 'private' end where profile_visibility = 'private';

create type public.friendship_status as enum ('pending','accepted','declined','canceled','removed');
create type public.social_audience as enum ('self','friends','public');
create type public.social_post_type as enum ('text','photo','workout','meal','achievement','trophy','medal','physical_summary','comparison','challenge_joined','challenge_completed');

create table public.profile_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (user_low_id < user_high_id),
  check (requested_by in (user_low_id, user_high_id)),
  unique(user_low_id, user_high_id)
);
create index friendships_user_low_idx on public.friendships(user_low_id, status);
create index friendships_user_high_idx on public.friendships(user_high_id, status);

create or replace function public.users_are_friends(left_user uuid, right_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.friendships f where f.user_low_id = least(left_user, right_user) and f.user_high_id = greatest(left_user, right_user) and f.status = 'accepted');
$$;
create or replace function public.users_are_blocked(left_user uuid, right_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profile_blocks b where (b.blocker_id = left_user and b.blocked_id = right_user) or (b.blocker_id = right_user and b.blocked_id = left_user));
$$;
create or replace function public.can_view_audience(owner uuid, audience public.social_audience)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = owner or (
    auth.uid() is not null and not public.users_are_blocked(auth.uid(), owner) and (
      audience = 'public' or (audience = 'friends' and public.users_are_friends(auth.uid(), owner))
    )
  );
$$;

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_type public.social_post_type not null,
  audience public.social_audience not null default 'friends',
  body text check (body is null or char_length(body) <= 3000),
  published_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(published_payload) = 'object'),
  source_type text,
  source_id text,
  allow_routine_copy boolean not null default false,
  hidden_at timestamptz,
  removed_at timestamptz,
  removal_reason text,
  reaction_count integer not null default 0 check (reaction_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text,
  unique(user_id, idempotency_key)
);
create index social_posts_feed_idx on public.social_posts(created_at desc) where removed_at is null and hidden_at is null;
create index social_posts_user_idx on public.social_posts(user_id, created_at desc);

create table public.social_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  media_type text not null check (media_type in ('image','video')),
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 26214400),
  width integer,
  height integer,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 60),
  alt_text text check (alt_text is null or char_length(alt_text) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.post_reactions (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','strength','support','celebrate')),
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments(post_id, created_at);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile','rugido')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','nudity','self_harm','misinformation','other')),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  audit_log jsonb not null default '[]'::jsonb check (jsonb_typeof(audit_log) = 'array'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(reporter_id, target_type, target_id)
);

create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('friend_request','friend_accepted','reaction','comment','reply','achievement','medal','challenge_invite','challenge_started','challenge_ended','rugido')),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 500),
  destination text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text,
  unique(user_id, dedupe_key)
);
create index internal_notifications_user_idx on public.internal_notifications(user_id, created_at desc) where deleted_at is null;

create or replace function public.request_friendship(target_user uuid)
returns public.friendships language plpgsql security definer set search_path = public as $$
declare result public.friendships;
begin
  if auth.uid() is null or target_user = auth.uid() then raise exception 'invalid friendship target'; end if;
  if public.users_are_blocked(auth.uid(), target_user) then raise exception 'friendship unavailable'; end if;
  insert into public.friendships(user_low_id,user_high_id,requested_by,status)
  values(least(auth.uid(),target_user),greatest(auth.uid(),target_user),auth.uid(),'pending')
  on conflict(user_low_id,user_high_id) do update set requested_by=excluded.requested_by,status='pending',responded_at=null,updated_at=now()
  where public.friendships.status in ('declined','canceled','removed')
  returning * into result;
  if result.id is null then raise exception 'friendship already exists'; end if;
  insert into public.internal_notifications(user_id,actor_id,category,title,destination,entity_type,entity_id,dedupe_key)
  values(target_user,auth.uid(),'friend_request','Novo pedido de amizade','/comunidade','friendship',result.id,'friend-request:'||result.id)
  on conflict(user_id,dedupe_key) do nothing;
  return result;
end $$;

create or replace function public.respond_friendship(friendship_id uuid, decision text)
returns public.friendships language plpgsql security definer set search_path = public as $$
declare result public.friendships;
begin
  if decision not in ('accepted','declined') then raise exception 'invalid decision'; end if;
  update public.friendships set status=decision::public.friendship_status,responded_at=now(),updated_at=now()
  where id=friendship_id and status='pending' and requested_by<>auth.uid() and auth.uid() in (user_low_id,user_high_id)
  returning * into result;
  if result.id is null then raise exception 'friendship unavailable'; end if;
  if decision='accepted' then
    insert into public.internal_notifications(user_id,actor_id,category,title,destination,entity_type,entity_id,dedupe_key)
    values(result.requested_by,auth.uid(),'friend_accepted','Pedido de amizade aceito','/comunidade','friendship',result.id,'friend-accepted:'||result.id)
    on conflict(user_id,dedupe_key) do nothing;
  end if;
  return result;
end $$;

create or replace function public.block_profile(target_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or target_user=auth.uid() then raise exception 'invalid block target'; end if;
  insert into public.profile_blocks(blocker_id,blocked_id) values(auth.uid(),target_user) on conflict do nothing;
  update public.friendships set status='removed',updated_at=now() where user_low_id=least(auth.uid(),target_user) and user_high_id=greatest(auth.uid(),target_user);
end $$;

create or replace function public.refresh_social_post_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.social_posts set
    reaction_count=(select count(*) from public.post_reactions where post_id=target_post),
    comment_count=(select count(*) from public.post_comments where post_id=target_post and removed_at is null)
  where id=target_post;
  return coalesce(new,old);
end $$;
create trigger post_reaction_count after insert or update or delete on public.post_reactions for each row execute function public.refresh_social_post_counts();
create trigger post_comment_count after insert or update or delete on public.post_comments for each row execute function public.refresh_social_post_counts();
create trigger friendships_updated before update on public.friendships for each row execute function public.ursofit_set_updated_at();
create trigger social_posts_updated before update on public.social_posts for each row execute function public.ursofit_set_updated_at();
create trigger post_comments_updated before update on public.post_comments for each row execute function public.ursofit_set_updated_at();

alter table public.profile_blocks enable row level security; alter table public.friendships enable row level security;
alter table public.social_posts enable row level security; alter table public.social_post_media enable row level security;
alter table public.post_reactions enable row level security; alter table public.post_comments enable row level security;
alter table public.content_reports enable row level security; alter table public.internal_notifications enable row level security;

create policy "participants read friendships" on public.friendships for select using (auth.uid() in (user_low_id,user_high_id));
create policy "users read own blocks" on public.profile_blocks for select using (auth.uid()=blocker_id);
create policy "users delete own blocks" on public.profile_blocks for delete using (auth.uid()=blocker_id);
create policy "audience reads posts" on public.social_posts for select using (removed_at is null and public.can_view_audience(user_id,audience));
create policy "owners insert posts" on public.social_posts for insert with check (auth.uid()=user_id);
create policy "owners update posts" on public.social_posts for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "owners delete posts" on public.social_posts for delete using (auth.uid()=user_id);
create policy "audience reads post media" on public.social_post_media for select using (exists(select 1 from public.social_posts p where p.id=post_id and public.can_view_audience(p.user_id,p.audience)));
create policy "owners manage post media" on public.social_post_media for all using (auth.uid()=user_id) with check (auth.uid()=user_id and exists(select 1 from public.social_posts p where p.id=post_id and p.user_id=auth.uid()));
create policy "audience reads reactions" on public.post_reactions for select using (exists(select 1 from public.social_posts p where p.id=post_id and public.can_view_audience(p.user_id,p.audience)));
create policy "users manage own reactions" on public.post_reactions for all using (auth.uid()=user_id) with check (auth.uid()=user_id and exists(select 1 from public.social_posts p where p.id=post_id and public.can_view_audience(p.user_id,p.audience)));
create policy "audience reads comments" on public.post_comments for select using (exists(select 1 from public.social_posts p where p.id=post_id and public.can_view_audience(p.user_id,p.audience)));
create policy "users insert own comments" on public.post_comments for insert with check (auth.uid()=user_id and exists(select 1 from public.social_posts p where p.id=post_id and public.can_view_audience(p.user_id,p.audience)));
create policy "users manage own comments" on public.post_comments for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users report visible content" on public.content_reports for insert with check (auth.uid()=reporter_id);
create policy "users read own reports" on public.content_reports for select using (auth.uid()=reporter_id);
create policy "users manage own notifications" on public.internal_notifications for select using (auth.uid()=user_id);
create policy "users update own notifications" on public.internal_notifications for update using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "users delete own notifications" on public.internal_notifications for delete using (auth.uid()=user_id);

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "users read permitted profiles" on public.profiles for select using (auth.uid()=user_id or (profile_visibility='public' and not public.users_are_blocked(auth.uid(),user_id)) or (profile_visibility='friends' and public.users_are_friends(auth.uid(),user_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('social-media','social-media',false,26214400,array['image/jpeg','image/png','image/webp','video/mp4']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "users upload own social media" on storage.objects for insert with check(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users manage own social media" on storage.objects for update using(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "users delete own social media" on storage.objects for delete using(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "audience reads social media objects" on storage.objects for select using(
  bucket_id='social-media' and auth.uid() is not null and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists(select 1 from public.social_post_media m join public.social_posts p on p.id=m.post_id where m.storage_path=name and public.can_view_audience(p.user_id,p.audience) and p.removed_at is null)
  )
);

revoke all on function public.request_friendship(uuid) from public; grant execute on function public.request_friendship(uuid) to authenticated;
revoke all on function public.respond_friendship(uuid,text) from public; grant execute on function public.respond_friendship(uuid,text) to authenticated;
revoke all on function public.block_profile(uuid) from public; grant execute on function public.block_profile(uuid) to authenticated;

commit;
