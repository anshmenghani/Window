-- Window bridge: connects the physical Raspberry Pi windows (Ansh's window_sync project)
-- to the Window app, inside the database. Neither the Pi code nor the app code changes.
--
-- Run order in the Supabase SQL Editor (all safe to re-run):
--   1. supabase/schema.sql                          (the app)
--   2. window_sync_supabase_project/supabase/schema.sql   (the Pis: window_pairs, window_sides, window_knocks)
--   3. this file
-- Then link a pair of windows to two app users, once:
--   select public.window_link('AB12CD34', 'sid', 'aiko');   -- side A = sid's window, side B = aiko's
--
-- What it does:
--   * A knock on a Pi (window_knocks) is copied into the app's knocks table, so the partner's
--     phone shows "Aiko knocked" and the crane hops.
--   * A knock sent from the app (knocks, source 'app') is copied into window_knocks, so the
--     partner's Pi buzzes the same rhythm.
--   * Each window's LED follows the partner's time zone straight from their app profile.
--   * While the pen pals' window is paused or ended, linked windows don't knock at all
--     (not to each other, not to the app), the same rule the app follows.
--
-- Rhythm formats differ, so every copy converts:
--   Pi  window_knocks.intervals_ms = gap since the previous knock   [0, 180, 520]
--   App knocks.pattern             = time since the first knock     [0, 180, 700]
-- The app allows up to 10 knocks, the Pi up to 20; longer Pi rhythms are cut to the first 10.

-- Which app user owns each side of a physical pair.
alter table public.window_sides add column if not exists user_id uuid references public.profiles on delete set null;
create index if not exists idx_window_sides_user on public.window_sides(user_id);

-- The two users have an ACTIVE pen pal window with each other (either order).
create or replace function public.window_bridge_active(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.status = 'active'
      and ((m.user_a = p_a and m.user_b = p_b) or (m.user_a = p_b and m.user_b = p_a))
  );
$$;

-- ---------------------------------------------------------------------------
-- Paused or ended pen pals: a linked window's knock is dropped before it's stored, so the other
-- window doesn't buzz either. Windows that aren't linked to app users are left alone.
-- ---------------------------------------------------------------------------
create or replace function public.window_knock_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
  v_to uuid;
begin
  select user_id into v_from from public.window_sides where pair_id = new.pair_id and side = new.sender_side;
  select user_id into v_to from public.window_sides where pair_id = new.pair_id and side <> new.sender_side;
  if v_from is not null and v_to is not null and not public.window_bridge_active(v_from, v_to) then
    return null; -- quietly dropped: the Pi logs "uploaded event=None"
  end if;
  return new;
end;
$$;

drop trigger if exists window_knock_gate on public.window_knocks;
create trigger window_knock_gate before insert on public.window_knocks
for each row execute function public.window_knock_gate();

-- ---------------------------------------------------------------------------
-- Pi -> app: a knock felt by a window's accelerometer shows up in the partner's app.
-- ---------------------------------------------------------------------------
create or replace function public.window_knock_to_app()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from uuid;
  v_to uuid;
  v_pattern jsonb;
begin
  -- this knock was just copied here FROM the app (below): don't copy it back, or it arrives twice
  if current_setting('window_bridge.copying_from_app', true) = 'on' then
    return new;
  end if;

  select user_id into v_from from public.window_sides where pair_id = new.pair_id and side = new.sender_side;
  select user_id into v_to from public.window_sides where pair_id = new.pair_id and side <> new.sender_side;
  if v_from is null or v_to is null or v_from = v_to then
    return new; -- this pair isn't linked to two app users yet
  end if;
  if not public.window_bridge_active(v_from, v_to) then
    return new; -- paused or ended (normally already stopped by window_knock_gate)
  end if;

  -- gaps -> running total (time since the first knock), first 10 knocks only
  select jsonb_agg(total order by i)
    into v_pattern
  from (
    select i, sum(greatest(0, gap)) over (order by i) as total
    from unnest(new.intervals_ms[1:10]) with ordinality as t(gap, i)
  ) as q;

  insert into public.knocks (from_user, to_user, source, pattern)
  values (v_from, v_to, 'window', coalesce(v_pattern, '[0]'::jsonb));
  return new;
end;
$$;

drop trigger if exists window_knock_to_app on public.window_knocks;
create trigger window_knock_to_app after insert on public.window_knocks
for each row execute function public.window_knock_to_app();

-- ---------------------------------------------------------------------------
-- App -> Pi: a knock tapped on the phone's knock rail buzzes the partner's window.
-- Only app knocks are copied (knocks that came from a Pi are marked 'window'), so a knock
-- can never bounce back and forth.
-- ---------------------------------------------------------------------------
create or replace function public.app_knock_to_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pair text;
  v_side text;
  v_intervals integer[];
begin
  if new.source <> 'app' then
    return new;
  end if;

  -- the sender's side of a pair whose other side belongs to the recipient
  select mine.pair_id, mine.side
    into v_pair, v_side
  from public.window_sides mine
  join public.window_sides theirs on theirs.pair_id = mine.pair_id and theirs.side <> mine.side
  where mine.user_id = new.from_user and theirs.user_id = new.to_user
  limit 1;

  if v_pair is null or not public.window_bridge_active(new.from_user, new.to_user) then
    return new;
  end if;

  -- running total -> gaps, clamped to what the Pi accepts (0..10000 ms each)
  select array_agg(least(10000, greatest(0, gap))::int order by i)
    into v_intervals
  from (
    select i,
           case when i = 1 then 0
                else round(t.ms - lag(t.ms) over (order by i)) end as gap
    from jsonb_array_elements_text(new.pattern) with ordinality as e(value, i)
    cross join lateral (select e.value::numeric as ms) as t
  ) as q;

  if v_intervals is null or cardinality(v_intervals) = 0 then
    v_intervals := array[0];
  end if;

  perform set_config('window_bridge.copying_from_app', 'on', true);
  insert into public.window_knocks (pair_id, sender_side, intervals_ms)
  values (v_pair, v_side, v_intervals[1:20]);
  perform set_config('window_bridge.copying_from_app', 'off', true);
  return new;
end;
$$;

drop trigger if exists app_knock_to_window on public.knocks;
create trigger app_knock_to_window after insert on public.knocks
for each row execute function public.app_knock_to_window();

-- ---------------------------------------------------------------------------
-- Time zones: each window's LED shows the partner's local time of day. The Pi reads it
-- from window_sides.timezone, so keep that in step with the app profile.
-- ---------------------------------------------------------------------------
create or replace function public.window_follow_profile_tz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tz is distinct from old.tz and new.tz is not null then
    update public.window_sides
    set timezone = new.tz, timezone_updated_at = now()
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists window_follow_profile_tz on public.profiles;
create trigger window_follow_profile_tz after update of tz on public.profiles
for each row execute function public.window_follow_profile_tz();

-- ---------------------------------------------------------------------------
-- Link a physical pair to two app users by username (run in the SQL Editor).
--   select public.window_link('AB12CD34', 'sid', 'aiko');
-- Side A becomes the first user's window, side B the second's. Re-running re-links.
-- ---------------------------------------------------------------------------
create or replace function public.window_link(p_pair_id text, p_username_a text, p_username_b text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a uuid;
  v_b uuid;
  v_tz_a text;
  v_tz_b text;
begin
  if not exists (select 1 from public.window_pairs where pair_id = p_pair_id) then
    raise exception 'No window pair called %. Create one first with tools/app_cli.py create-pair.', p_pair_id;
  end if;

  -- usernames are stored as hidden emails: <username>@users.windowapp.dev (app/src/lib/config.ts)
  select id into v_a from auth.users where email = lower(trim(p_username_a)) || '@users.windowapp.dev';
  select id into v_b from auth.users where email = lower(trim(p_username_b)) || '@users.windowapp.dev';
  if v_a is null then raise exception 'No app user with username %', p_username_a; end if;
  if v_b is null then raise exception 'No app user with username %', p_username_b; end if;

  select tz into v_tz_a from public.profiles where id = v_a;
  select tz into v_tz_b from public.profiles where id = v_b;

  update public.window_sides set user_id = v_a, timezone = coalesce(v_tz_a, timezone), timezone_updated_at = now()
  where pair_id = p_pair_id and side = 'A';
  update public.window_sides set user_id = v_b, timezone = coalesce(v_tz_b, timezone), timezone_updated_at = now()
  where pair_id = p_pair_id and side = 'B';

  return jsonb_build_object(
    'pair_id', p_pair_id,
    'side_a', jsonb_build_object('username', p_username_a, 'timezone', v_tz_a),
    'side_b', jsonb_build_object('username', p_username_b, 'timezone', v_tz_b),
    'pen_pals_active', public.window_bridge_active(v_a, v_b)
  );
end;
$$;

-- These are for the SQL Editor and the triggers only, never for the app or the Pis.
revoke all on function public.window_link(text, text, text) from public, anon, authenticated;
revoke all on function public.window_bridge_active(uuid, uuid) from public, anon, authenticated;
revoke all on function public.window_knock_to_app() from public, anon, authenticated;
revoke all on function public.app_knock_to_window() from public, anon, authenticated;
revoke all on function public.window_follow_profile_tz() from public, anon, authenticated;
revoke all on function public.window_knock_gate() from public, anon, authenticated;
