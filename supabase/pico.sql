-- Run AFTER schema.sql, hardware/supabase/schema.sql and window_bridge.sql.
-- Retry-safe wrapper: a cellular timeout must not create a second knock.
-- Existing Pi clients and bridge triggers are unchanged.
create table if not exists public.window_pico_requests (
    pair_id text not null references public.window_pairs(pair_id) on delete cascade,
    side text not null check (side in ('A', 'B')),
    request_id text not null,
    result jsonb not null,
    created_at timestamptz not null default now(),
    primary key (pair_id, side, request_id)
);
alter table public.window_pico_requests enable row level security;
revoke all on public.window_pico_requests from anon, authenticated;

create or replace function public.window_pico_send_knock(
    p_pair_id text, p_pair_secret text, p_side text,
    p_request_id text, p_intervals_ms integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
    v_side text := upper(p_side);
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);
    if v_side is null or v_side not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;
    if p_request_id is null or p_request_id !~ '^[0-9a-f]{32}$' then
        raise exception 'Request ID must be 32 lowercase hex characters';
    end if;
    -- Serialize requests for this pair, including concurrent retries after a timeout.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_pair_id, 0));
    select result into v_result from public.window_pico_requests
    where pair_id = p_pair_id and side = v_side and request_id = p_request_id;
    if found then
        return v_result;
    end if;
    v_result := public.window_send_knock(p_pair_id, p_pair_secret, v_side, p_intervals_ms);
    insert into public.window_pico_requests(pair_id, side, request_id, result)
    values (p_pair_id, v_side, p_request_id, v_result);
    return v_result;
end;
$$;
revoke all on function public.window_pico_send_knock(text, text, text, text, integer[]) from public;
grant execute on function public.window_pico_send_knock(text, text, text, text, integer[]) to anon, authenticated;
