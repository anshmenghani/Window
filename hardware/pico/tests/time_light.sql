-- Run in a test Supabase project after pico_time_light.sql. Leaves no test data.
begin;
do $$
declare
    v_pair jsonb := public.window_create_pair();
    v_reply jsonb;
    v_local timestamp;
    v_expected numeric;
    v_difference numeric;
begin
    update public.window_sides set timezone = 'America/New_York'
    where pair_id = v_pair->>'pair_id' and side = 'A';
    update public.window_sides set timezone = 'Asia/Kolkata'
    where pair_id = v_pair->>'pair_id' and side = 'B';
    v_reply := public.window_pico_get_partner(v_pair->>'pair_id', v_pair->>'pair_secret', 'A');
    if v_reply->>'timezone' <> 'Asia/Kolkata' then
        raise exception 'Returned own timezone instead of partner timezone';
    end if;
    v_local := clock_timestamp() at time zone 'Asia/Kolkata';
    v_expected := extract(hour from v_local) + extract(minute from v_local)/60.0
                  + extract(second from v_local)/3600.0;
    v_difference := abs((v_reply->>'local_hour')::numeric - v_expected);
    if least(v_difference, 24 - v_difference) > 0.01 then
        raise exception 'Partner local hour is wrong';
    end if;
    if not exists (select 1 from public.window_sides
                   where pair_id = v_pair->>'pair_id' and side = 'A' and last_seen_at is not null) then
        raise exception 'Heartbeat was not recorded';
    end if;
    begin
        perform public.window_pico_get_partner(v_pair->>'pair_id', 'wrong', 'A');
        raise exception 'Invalid secret accepted';
    exception when invalid_authorization_specification then null;
    end;
    update public.window_sides set timezone = null where pair_id = v_pair->>'pair_id' and side = 'B';
    v_reply := public.window_pico_get_partner(v_pair->>'pair_id', v_pair->>'pair_secret', 'A');
    if v_reply->>'timezone' <> 'UTC' then raise exception 'Missing UTC fallback'; end if;
    raise notice 'Partner time and heartbeat checks passed';
end;
$$;
rollback;
