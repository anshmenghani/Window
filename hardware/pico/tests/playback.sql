-- Run after pico_playback.sql in a TEST Supabase project. All data rolls back.
begin;
do $$
declare
    v_pair jsonb := public.window_create_pair();
    v_first jsonb;
    v_retry jsonb;
    v_received jsonb;
    v_cursor bigint;
begin
    v_received := public.window_pico_get_knocks(v_pair->>'pair_id', v_pair->>'pair_secret', 'B', null);
    v_cursor := (v_received->>'cursor')::bigint;
    v_first := public.window_pico_send_knock_with_strength(
        v_pair->>'pair_id', v_pair->>'pair_secret', 'A', repeat('a',32), array[0,300,700], array[0.3,0.8,1.5]::double precision[]);
    v_retry := public.window_pico_send_knock_with_strength(
        v_pair->>'pair_id', v_pair->>'pair_secret', 'A', repeat('a',32), array[0,300,700], array[1.0,1.0,1.0]::double precision[]);
    if v_first <> v_retry then raise exception 'Retry changed event ID'; end if;
    if (select count(*) from public.window_knocks where pair_id=v_pair->>'pair_id') <> 1 then
        raise exception 'Duplicate event inserted';
    end if;
    v_received := public.window_pico_get_knocks(v_pair->>'pair_id', v_pair->>'pair_secret', 'B', v_cursor);
    if v_received #> '{events,0,intervals_ms}' <> '[0,300,700]'::jsonb
       or v_received #> '{events,0,impacts_g}' <> '[0.3,0.8,1.5]'::jsonb then
        raise exception 'Rhythm or original strength was not preserved';
    end if;
    v_received := public.window_pico_get_knocks(v_pair->>'pair_id', v_pair->>'pair_secret', 'A', v_cursor);
    if jsonb_array_length(v_received->'events') <> 0 then raise exception 'Sender received its own knock'; end if;
    v_received := public.window_pico_get_knocks(v_pair->>'pair_id', v_pair->>'pair_secret', 'B', (v_first->>'id')::bigint);
    if jsonb_array_length(v_received->'events') <> 0 then raise exception 'Acknowledged event replayed'; end if;
    update public.window_knocks set created_at=clock_timestamp()-interval '61 seconds' where pair_id=v_pair->>'pair_id';
    v_received := public.window_pico_get_knocks(v_pair->>'pair_id', v_pair->>'pair_secret', 'B', v_cursor);
    if jsonb_array_length(v_received->'events') <> 0 then raise exception 'Expired event replayed'; end if;
    begin
        perform public.window_pico_get_knocks(v_pair->>'pair_id', 'wrong', 'B', 0);
        raise exception 'Invalid secret accepted';
    exception when invalid_authorization_specification then null;
    end;
    raise notice 'Strength, retry and receive checks passed';
end;
$$;
rollback;
