create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  languages text[] not null default '{}',
  home_city text,
  country text,
  tz text,
  lat double precision,
  lng double precision,
  interests text[] not null default '{}',
  interest_vec double precision[],
  dream_places text[] not null default '{}',
  mutual_dreams boolean not null default true,
  hide_contact boolean not null default true,
  onboarded boolean not null default false,
  expo_push_token text,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid references public.profiles on delete set null,
  user_b uuid references public.profiles on delete set null,
  city text not null,
  reason text,
  status text not null default 'active' check (status in ('active','paused','ended')),
  itinerary jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.windows (
  id uuid primary key,
  match_id uuid not null references public.matches on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  photo_path text not null,
  audio_path text,
  caption text not null default '',
  spot text,
  spot_lat double precision,
  spot_lng double precision,
  local_date date not null,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, sender_id, local_date)
);

create table if not exists public.window_translations (
  window_id uuid primary key references public.windows on delete cascade,
  match_id uuid references public.matches on delete cascade,
  recipient_id uuid references public.profiles on delete cascade,
  src_lang text,
  lang text,
  caption_t text,
  transcript text,
  transcript_t text,
  context_note text,
  stickers jsonb not null default '[]',
  dub_path text,
  steps jsonb not null default '{}',
  status text not null default 'processing' check (status in ('processing','ready','blocked','failed')),
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.knocks (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  source text not null check (source in ('window','app')),
  pattern jsonb not null default '[0]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.knocks drop constraint if exists knocks_pattern_shape;
alter table public.knocks add constraint knocks_pattern_shape check (
  jsonb_typeof(pattern) = 'array' and jsonb_array_length(pattern) between 1 and 10
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  target_id uuid not null references public.profiles on delete cascade,
  window_id uuid references public.windows on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- Push tokens live in their own table so other users can never read them.
-- The server reads them with the service-role key when sending a push.
create table if not exists public.push_tokens (
  user_id uuid primary key references public.profiles on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
insert into public.push_tokens (user_id, token)
  select id, expo_push_token from public.profiles where expo_push_token is not null
  on conflict (user_id) do nothing;
update public.profiles set expo_push_token = null where expo_push_token is not null;

alter table public.profiles enable row level security;
drop policy if exists p_read on public.profiles;
-- You can read your own profile and the profiles of people you are (or were) matched with.
-- Matching runs on the server with the service-role key, so the app never needs to list strangers.
create policy p_read on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from public.matches m
    where (m.user_a = auth.uid() and m.user_b = profiles.id)
       or (m.user_b = auth.uid() and m.user_a = profiles.id)
  )
);
drop policy if exists p_ins on public.profiles;
create policy p_ins on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Location verification: the phone sends its position ONCE to POST /verify-location.
-- The server checks it is near the chosen home city, sets these two columns, and discards the coordinates.
alter table public.profiles add column if not exists location_verified boolean not null default false;
alter table public.profiles add column if not exists location_verified_at timestamptz;

-- Only the server (service role) may mark someone verified. Changing your home city resets it.
create or replace function public.protect_location_verification() returns trigger
language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.location_verified := false;
      new.location_verified_at := null;
    else
      new.location_verified := old.location_verified;
      new.location_verified_at := old.location_verified_at;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.home_city is distinct from old.home_city then
    new.location_verified := false;
    new.location_verified_at := null;
  end if;
  return new;
end $$;
drop trigger if exists protect_location_verification on public.profiles;
create trigger protect_location_verification before insert or update on public.profiles
for each row execute function public.protect_location_verification();

alter table public.push_tokens enable row level security;
drop policy if exists pt_read on public.push_tokens;
create policy pt_read on public.push_tokens for select to authenticated using (user_id = auth.uid());
drop policy if exists pt_ins on public.push_tokens;
create policy pt_ins on public.push_tokens for insert to authenticated with check (user_id = auth.uid());
drop policy if exists pt_upd on public.push_tokens;
create policy pt_upd on public.push_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.matches enable row level security;
drop policy if exists m_read on public.matches;
create policy m_read on public.matches for select to authenticated using (auth.uid() in (user_a,user_b));
drop policy if exists m_upd on public.matches;
create policy m_upd on public.matches for update to authenticated using (auth.uid() in (user_a,user_b)) with check (auth.uid() in (user_a,user_b));

-- The app may only change a match's status. The AI service uses the service-role
-- key to cache an itinerary, so it bypasses this client-side guard.
create or replace function public.guard_client_match_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    if new.user_a is distinct from old.user_a
      or new.user_b is distinct from old.user_b
      or new.city is distinct from old.city
      or new.reason is distinct from old.reason
      or new.itinerary is distinct from old.itinerary
      or new.created_at is distinct from old.created_at then
      raise exception 'Only a match status can be changed by a client.';
    end if;
    if old.status = 'ended' and new.status <> 'ended' then
      raise exception 'An ended match cannot be reopened.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_client_match_update on public.matches;
create trigger guard_client_match_update before update on public.matches
for each row execute function public.guard_client_match_update();

-- Serialise active-match creation across both profiles, so concurrent matching
-- requests cannot give either person more than one current pen pal.
create or replace function public.enforce_one_current_match()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('active', 'paused') then
    perform 1 from public.profiles
      where id in (new.user_a, new.user_b)
      order by id for update;
    if exists (
      select 1 from public.matches m
      where m.id is distinct from new.id
        and m.status in ('active', 'paused')
        and (new.user_a in (m.user_a, m.user_b) or new.user_b in (m.user_a, m.user_b))
    ) then
      raise exception 'Each person can only have one active or paused match.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_one_current_match on public.matches;
create trigger enforce_one_current_match before insert or update on public.matches
for each row execute function public.enforce_one_current_match();

alter table public.windows enable row level security;
drop policy if exists w_read on public.windows;
create policy w_read on public.windows for select to authenticated using (auth.uid() in (sender_id,recipient_id));
drop policy if exists w_ins on public.windows;
create policy w_ins on public.windows for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.matches m
    where m.id = match_id and m.status = 'active'
      and ((m.user_a = auth.uid() and m.user_b = recipient_id)
        or (m.user_b = auth.uid() and m.user_a = recipient_id))
  )
);
drop policy if exists w_upd on public.windows;
create policy w_upd on public.windows for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());

-- A recipient can bookmark a window, but may not alter its media, sender,
-- recipient, date, or match. The AI service bypasses this guard while adding
-- redaction and map metadata.
create or replace function public.guard_client_window_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and (
    new.id is distinct from old.id
    or new.match_id is distinct from old.match_id
    or new.sender_id is distinct from old.sender_id
    or new.recipient_id is distinct from old.recipient_id
    or new.photo_path is distinct from old.photo_path
    or new.audio_path is distinct from old.audio_path
    or new.caption is distinct from old.caption
    or new.spot is distinct from old.spot
    or new.spot_lat is distinct from old.spot_lat
    or new.spot_lng is distinct from old.spot_lng
    or new.local_date is distinct from old.local_date
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'A client may only change whether a received window is saved.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_client_window_update on public.windows;
create trigger guard_client_window_update before update on public.windows
for each row execute function public.guard_client_window_update();

alter table public.window_translations enable row level security;
drop policy if exists t_read on public.window_translations;
create policy t_read on public.window_translations for select to authenticated using (recipient_id=auth.uid() or exists (select 1 from public.windows w where w.id=window_id and w.sender_id=auth.uid()));

alter table public.knocks enable row level security;
drop policy if exists k_read on public.knocks;
create policy k_read on public.knocks for select to authenticated using (auth.uid() in (from_user,to_user));
drop policy if exists k_ins on public.knocks;
create policy k_ins on public.knocks for insert to authenticated with check (
  from_user=auth.uid() and exists (
    select 1 from public.matches m where m.status='active'
      and auth.uid() in (m.user_a,m.user_b)
      and to_user in (m.user_a,m.user_b)
      and to_user <> auth.uid()
  )
);

alter table public.reports enable row level security;
drop policy if exists r_ins on public.reports;
create policy r_ins on public.reports for insert to authenticated with check (reporter_id=auth.uid());
alter table public.blocks enable row level security;
drop policy if exists b_ins on public.blocks;
create policy b_ins on public.blocks for insert to authenticated with check (blocker_id=auth.uid());
drop policy if exists b_read on public.blocks;
create policy b_read on public.blocks for select to authenticated using (blocker_id=auth.uid() or blocked_id=auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.window_translations;
exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.knocks;
exception when duplicate_object then null; when duplicate_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null; when duplicate_table then null; end $$;

insert into storage.buckets (id,name,public) values ('media','media',true)
on conflict (id) do update set public=true;
drop policy if exists media_up on storage.objects;
create policy media_up on storage.objects for insert to authenticated
with check (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);
