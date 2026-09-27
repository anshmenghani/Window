-- Run after hardware/supabase/schema.sql and supabase/window_bridge.sql.
-- PostgreSQL handles IANA time zones and DST; the Pico uses the returned server
-- epoch plus the partner's latitude/longitude to render the real solar light for
-- that place and date (seasonal sunrise/sunset included).
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
    v_partner_user uuid;
    v_lat double precision;
    v_lng double precision;
    v_now timestamptz := pg_catalog.clock_timestamp();
begin
    if p_side is null or upper(p_side) not in ('A', 'B') then
        raise exception 'Side must be A or B';
    end if;

    -- Existing RPC validates the pair secret and updates this device heartbeat.
    v_partner := public.window_get_partner(p_pair_id, p_pair_secret, p_side);
    v_timezone := coalesce(nullif(v_partner->>'timezone', ''), 'UTC');
    v_local := v_now at time zone v_timezone;

    -- The bridge links each hardware side to an app profile. The partner's
    -- latitude/longitude lets the Pico calculate the sun's actual elevation,
    -- instead of pretending sunrise/sunset happen at fixed clock hours.
    select ws.user_id
      into v_partner_user
    from public.window_sides ws
    where ws.pair_id = p_pair_id
      and ws.side <> upper(p_side);

    if v_partner_user is not null then
        select p.lat, p.lng
          into v_lat, v_lng
        from public.profiles p
        where p.id = v_partner_user;
    end if;

    if v_lat is not null and (v_lat < -90 or v_lat > 90) then
        v_lat := null;
    end if;
    if v_lng is not null and (v_lng < -180 or v_lng > 180) then
        v_lng := null;
    end if;

    return v_partner || jsonb_build_object(
        'timezone', v_timezone,
        'local_hour', extract(hour from v_local)
            + extract(minute from v_local) / 60.0
            + extract(second from v_local) / 3600.0,
        'server_epoch', extract(epoch from v_now),
        'latitude', v_lat,
        'longitude', v_lng
    );
end;
$$;
revoke all on function public.window_pico_get_partner(text, text, text) from public;
grant execute on function public.window_pico_get_partner(text, text, text) to anon, authenticated;
