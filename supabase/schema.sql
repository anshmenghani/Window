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

alter table public.profiles enable row level security;
drop policy if exists p_read on public.profiles;
create policy p_read on public.profiles for select to authenticated using (true);
drop policy if exists p_ins on public.profiles;
create policy p_ins on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists p_upd on public.profiles;
create policy p_upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

alter table public.matches enable row level security;
drop policy if exists m_read on public.matches;
create policy m_read on public.matches for select to authenticated using (auth.uid() in (user_a,user_b));
drop policy if exists m_upd on public.matches;
create policy m_upd on public.matches for update to authenticated using (auth.uid() in (user_a,user_b)) with check (auth.uid() in (user_a,user_b));

alter table public.windows enable row level security;
drop policy if exists w_read on public.windows;
create policy w_read on public.windows for select to authenticated using (auth.uid() in (sender_id,recipient_id));
drop policy if exists w_ins on public.windows;
create policy w_ins on public.windows for insert to authenticated with check (sender_id = auth.uid() and exists (select 1 from public.matches m where m.id=match_id and auth.uid() in (m.user_a,m.user_b)));
drop policy if exists w_upd on public.windows;
create policy w_upd on public.windows for update to authenticated using (recipient_id=auth.uid()) with check (recipient_id=auth.uid());

alter table public.window_translations enable row level security;
drop policy if exists t_read on public.window_translations;
create policy t_read on public.window_translations for select to authenticated using (recipient_id=auth.uid() or exists (select 1 from public.windows w where w.id=window_id and w.sender_id=auth.uid()));

alter table public.knocks enable row level security;
drop policy if exists k_read on public.knocks;
create policy k_read on public.knocks for select to authenticated using (auth.uid() in (from_user,to_user));
drop policy if exists k_ins on public.knocks;
create policy k_ins on public.knocks for insert to authenticated with check (from_user=auth.uid());

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
