-- Run after hardware/supabase/schema.sql and supabase/window_bridge.sql.
-- PostgreSQL handles IANA time zones and DST; the Pico needs no zoneinfo or RTC setup.
create or replace function public.window_pico_get_partner(
    p_pair_id text, p_pair_secret text, p_side text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_partner jsonb;
    v_timezone text;
    v_local timestamp without time zone;
begin
    if p_side is null or upper(p_side) not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;
    -- Existing RPC validates the pair secret and updates the device heartbeat.
    v_partner := public.window_get_partner(p_pair_id, p_pair_secret, p_side);
    v_timezone := coalesce(nullif(v_partner->>'timezone', ''), 'UTC');
    v_local := pg_catalog.clock_timestamp() at time zone v_timezone;
    return v_partner || jsonb_build_object(
        'timezone', v_timezone,
        'local_hour', extract(hour from v_local)
            + extract(minute from v_local) / 60.0
            + extract(second from v_local) / 3600.0
    );
end;
$$;
revoke all on function public.window_pico_get_partner(text, text, text) from public;
grant execute on function public.window_pico_get_partner(text, text, text) to anon, authenticated;
