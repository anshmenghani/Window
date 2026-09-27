-- Run in a TEST Supabase project's SQL Editor after all four migrations.
-- No linked app users are used; all changes are rolled back.
begin;
do $$
declare
    pair jsonb;
    first_result jsonb;
    retry_result jsonb;
    count_events integer;
begin
    pair := public.window_create_pair();
    first_result := public.window_pico_send_knock(
        pair->>'pair_id', pair->>'pair_secret', 'A', repeat('a', 32), array[0,400,600]);
    retry_result := public.window_pico_send_knock(
        pair->>'pair_id', pair->>'pair_secret', 'A', repeat('a', 32), array[0,400,600]);
    if first_result->>'id' is null or first_result <> retry_result then
        raise exception 'Retry did not return the original result';
    end if;
    select count(*) into count_events from public.window_knocks where pair_id = pair->>'pair_id';
    if count_events <> 1 then raise exception 'Retry duplicated a knock'; end if;
    begin
        perform public.window_pico_send_knock(
            pair->>'pair_id', 'wrong-secret', 'A', repeat('a', 32), array[0]);
        raise exception 'Wrong secret was accepted';
    exception when invalid_authorization_specification then
        null;
    end;
    -- A different side may independently use the same request ID.
    perform public.window_pico_send_knock(
        pair->>'pair_id', pair->>'pair_secret', 'B', repeat('a', 32), array[0]);
    select count(*) into count_events from public.window_knocks where pair_id = pair->>'pair_id';
    if count_events <> 2 then raise exception 'Sides did not have independent requests'; end if;
    raise notice 'Pico retry checks passed';
end;
$$;
rollback;
