-- Window Sync / Supabase backend
-- Run this file once in Supabase Dashboard -> SQL Editor.
--
-- The Raspberry Pis and app use ONLY the RPC functions below.
-- Underlying tables are not directly readable/writable by public clients.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.window_pairs (
    pair_id text primary key,
    secret_hash bytea not null,
    created_at timestamptz not null default now()
);

create table if not exists public.window_sides (
    pair_id text not null references public.window_pairs(pair_id) on delete cascade,
    side text not null check (side in ('A', 'B')),
    timezone text,
    timezone_updated_at timestamptz,
    primary key (pair_id, side)
);

create table if not exists public.window_knocks (
    id bigint generated always as identity primary key,
    pair_id text not null references public.window_pairs(pair_id) on delete cascade,
    sender_side text not null check (sender_side in ('A', 'B')),
    intervals_ms integer[] not null,
    created_at timestamptz not null default now(),
    constraint window_knocks_nonempty
        check (cardinality(intervals_ms) between 1 and 20)
);

create index if not exists idx_window_knocks_pair_id
    on public.window_knocks(pair_id, id);

alter table public.window_pairs enable row level security;
alter table public.window_sides enable row level security;
alter table public.window_knocks enable row level security;

revoke all on table public.window_pairs from anon, authenticated;
revoke all on table public.window_sides from anon, authenticated;
revoke all on table public.window_knocks from anon, authenticated;

-- Internal credential checker.
create or replace function public.window_assert_pair(
    p_pair_id text,
    p_pair_secret text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (
        select 1
        from public.window_pairs wp
        where wp.pair_id = p_pair_id
          and wp.secret_hash = extensions.digest(p_pair_secret, 'sha256')
    ) then
        raise exception 'Invalid pair credentials'
            using errcode = '28000';
    end if;
end;
$$;

revoke all on function public.window_assert_pair(text, text)
from public, anon, authenticated;

-- Creates one paired A/B Window set.
-- The pair secret is returned once and only its SHA-256 hash is stored.
create or replace function public.window_create_pair()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_pair_id text;
    v_secret text;
begin
    loop
        v_pair_id :=
            upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8));

        exit when not exists (
            select 1
            from public.window_pairs
            where pair_id = v_pair_id
        );
    end loop;

    v_secret := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.window_pairs(pair_id, secret_hash)
    values (v_pair_id, extensions.digest(v_secret, 'sha256'));

    insert into public.window_sides(pair_id, side)
    values (v_pair_id, 'A'), (v_pair_id, 'B');

    return jsonb_build_object(
        'pair_id', v_pair_id,
        'pair_secret', v_secret
    );
end;
$$;

create or replace function public.window_set_timezone(
    p_pair_id text,
    p_pair_secret text,
    p_side text,
    p_timezone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_side text := upper(p_side);
    v_now timestamptz := now();
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);

    if v_side not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;

    if not exists (
        select 1
        from pg_catalog.pg_timezone_names
        where name = p_timezone
    ) then
        raise exception 'Unknown IANA timezone: %', p_timezone;
    end if;

    update public.window_sides
    set timezone = p_timezone,
        timezone_updated_at = v_now
    where pair_id = p_pair_id
      and side = v_side;

    return jsonb_build_object(
        'side', v_side,
        'timezone', p_timezone,
        'timezone_updated_at', v_now
    );
end;
$$;

create or replace function public.window_get_partner(
    p_pair_id text,
    p_pair_secret text,
    p_side text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_side text := upper(p_side);
    v_partner text;
    v_timezone text;
    v_updated timestamptz;
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);

    if v_side not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;

    v_partner := case when v_side = 'A' then 'B' else 'A' end;

    select timezone, timezone_updated_at
      into v_timezone, v_updated
    from public.window_sides
    where pair_id = p_pair_id
      and side = v_partner;

    return jsonb_build_object(
        'partner_side', v_partner,
        'timezone', v_timezone,
        'timezone_updated_at', v_updated
    );
end;
$$;

create or replace function public.window_send_knock(
    p_pair_id text,
    p_pair_secret text,
    p_side text,
    p_intervals_ms integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_side text := upper(p_side);
    v_id bigint;
    v_created timestamptz;
    v_interval integer;
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);

    if v_side not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;

    if p_intervals_ms is null
       or cardinality(p_intervals_ms) < 1
       or cardinality(p_intervals_ms) > 20 then
        raise exception 'Knock pattern must contain 1 to 20 knocks';
    end if;

    if p_intervals_ms[1] <> 0 then
        raise exception 'First knock interval must be 0';
    end if;

    foreach v_interval in array p_intervals_ms loop
        if v_interval < 0 or v_interval > 10000 then
            raise exception 'Each interval must be between 0 and 10000 ms';
        end if;
    end loop;

    if (
        select coalesce(sum(x), 0)
        from unnest(p_intervals_ms) as t(x)
    ) > 30000 then
        raise exception 'Knock pattern is too long';
    end if;

    insert into public.window_knocks(pair_id, sender_side, intervals_ms)
    values (p_pair_id, v_side, p_intervals_ms)
    returning id, created_at into v_id, v_created;

    return jsonb_build_object(
        'id', v_id,
        'created_at', v_created
    );
end;
$$;

create or replace function public.window_get_knock_cursor(
    p_pair_id text,
    p_pair_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_cursor bigint;
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);

    select coalesce(max(id), 0)
      into v_cursor
    from public.window_knocks
    where pair_id = p_pair_id;

    return jsonb_build_object('cursor', v_cursor);
end;
$$;

create or replace function public.window_get_knocks(
    p_pair_id text,
    p_pair_secret text,
    p_side text,
    p_after_id bigint default 0,
    p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_side text := upper(p_side);
    v_limit integer := greatest(1, least(coalesce(p_limit, 25), 50));
    v_events jsonb;
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);

    if v_side not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'id', k.id,
                'sender_side', k.sender_side,
                'intervals_ms', to_jsonb(k.intervals_ms),
                'created_at', k.created_at
            )
            order by k.id
        ),
        '[]'::jsonb
    )
    into v_events
    from (
        select id, sender_side, intervals_ms, created_at
        from public.window_knocks
        where pair_id = p_pair_id
          and sender_side <> v_side
          and id > coalesce(p_after_id, 0)
        order by id
        limit v_limit
    ) as k;

    return jsonb_build_object('events', v_events);
end;
$$;

-- Remove PUBLIC execute and grant only the low-privilege API roles.
revoke all on function public.window_create_pair() from public;
revoke all on function public.window_set_timezone(text, text, text, text) from public;
revoke all on function public.window_get_partner(text, text, text) from public;
revoke all on function public.window_send_knock(text, text, text, integer[]) from public;
revoke all on function public.window_get_knock_cursor(text, text) from public;
revoke all on function public.window_get_knocks(text, text, text, bigint, integer) from public;

grant execute on function public.window_create_pair() to anon, authenticated;
grant execute on function public.window_set_timezone(text, text, text, text) to anon, authenticated;
grant execute on function public.window_get_partner(text, text, text) to anon, authenticated;
grant execute on function public.window_send_knock(text, text, text, integer[]) to anon, authenticated;
grant execute on function public.window_get_knock_cursor(text, text) to anon, authenticated;
grant execute on function public.window_get_knocks(text, text, text, bigint, integer) to anon, authenticated;
