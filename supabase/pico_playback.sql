-- Apply after the hardware schema, window_bridge.sql and pico.sql.
alter table public.window_knocks add column if not exists impacts_g double precision[];

create or replace function public.window_pico_send_knock_with_strength(
    p_pair_id text, p_pair_secret text, p_side text, p_request_id text,
    p_intervals_ms integer[], p_impacts_g double precision[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_result jsonb;
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);
    if p_intervals_ms is null or array_ndims(p_intervals_ms) is distinct from 1
       or array_lower(p_intervals_ms, 1) is distinct from 1
       or cardinality(p_intervals_ms) not between 1 and 20
       or exists (select 1 from unnest(p_intervals_ms) as t(v) where v is null)
       or p_impacts_g is null or array_ndims(p_impacts_g) is distinct from 1
       or array_lower(p_impacts_g, 1) is distinct from 1
       or cardinality(p_impacts_g) <> cardinality(p_intervals_ms)
       or exists (select 1 from unnest(p_impacts_g) as t(v) where v is null or v < 0 or v > 8) then
        raise exception 'Provide one finite impact value (0..8g) per knock';
    end if;
    -- This wrapper retains the existing lock, request ID and bridge triggers.
    v_result := public.window_pico_send_knock(
        p_pair_id, p_pair_secret, p_side, p_request_id, p_intervals_ms);
    update public.window_knocks set impacts_g = p_impacts_g
    where id = (v_result->>'id')::bigint and pair_id = p_pair_id
      and sender_side = upper(p_side) and impacts_g is null;
    return v_result;
end;
$$;
revoke all on function public.window_pico_send_knock_with_strength(text,text,text,text,integer[],double precision[]) from public;
grant execute on function public.window_pico_send_knock_with_strength(text,text,text,text,integer[],double precision[]) to anon, authenticated;

create or replace function public.window_pico_get_knocks(
    p_pair_id text, p_pair_secret text, p_side text, p_after_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_side text := upper(p_side);
    v_mine uuid;
    v_theirs uuid;
    v_latest bigint;
    v_event public.window_knocks%rowtype;
begin
    perform public.window_assert_pair(p_pair_id, p_pair_secret);
    if v_side is null or v_side not in ('A','B') then raise exception 'Side must be A or B'; end if;
    if p_after_id < 0 then raise exception 'Cursor must not be negative'; end if;
    select coalesce(max(id), 0) into v_latest from public.window_knocks where pair_id = p_pair_id;
    -- On boot, start at the current head rather than replaying old knocks.
    if p_after_id is null then
        return jsonb_build_object('cursor', v_latest, 'events', '[]'::jsonb);
    end if;
    select user_id into v_mine from public.window_sides where pair_id = p_pair_id and side = v_side;
    select user_id into v_theirs from public.window_sides where pair_id = p_pair_id and side <> v_side;
    if v_mine is not null and v_theirs is not null and not public.window_bridge_active(v_mine, v_theirs) then
        return jsonb_build_object('cursor', greatest(v_latest, p_after_id), 'events', '[]'::jsonb);
    end if;
    select * into v_event from public.window_knocks
    where pair_id = p_pair_id and sender_side <> v_side and id > p_after_id
      and created_at > clock_timestamp() - interval '60 seconds'
    order by id limit 1;
    if not found then
        return jsonb_build_object('cursor', greatest(v_latest, p_after_id), 'events', '[]'::jsonb);
    end if;
    return jsonb_build_object('cursor', v_event.id, 'events', jsonb_build_array(jsonb_build_object(
        'id', v_event.id, 'intervals_ms', v_event.intervals_ms,
        'impacts_g', v_event.impacts_g, 'created_at', v_event.created_at
    )));
end;
$$;
revoke all on function public.window_pico_get_knocks(text,text,text,bigint) from public;
grant execute on function public.window_pico_get_knocks(text,text,text,bigint) to anon, authenticated;
