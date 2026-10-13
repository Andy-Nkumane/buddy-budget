create or replace function public.create_payment_schedule(requested_schedule jsonb)
returns setof public.payment_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_schedule public.payment_schedules%rowtype;
  selected_timezone text;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  selected_timezone := coalesce(nullif(requested_schedule->>'timezone', ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = selected_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  if (requested_schedule->>'start_date')::date < (now() at time zone selected_timezone)::date then
    raise exception 'Schedule start date cannot be before today' using errcode = '22023';
  end if;
  insert into public.payment_schedules (
    user_id, name, item_type, amount_minor, amount_is_approximate, start_date,
    end_date, recurrence, selected_days, timezone, enabled, template_id,
    template_item_id, category_id, notes
  ) values (
    current_user_id, btrim(requested_schedule->>'name'), requested_schedule->>'item_type',
    (requested_schedule->>'amount_minor')::bigint,
    coalesce((requested_schedule->>'amount_is_approximate')::boolean, false),
    (requested_schedule->>'start_date')::date,
    nullif(requested_schedule->>'end_date', '')::date,
    requested_schedule->>'recurrence',
    coalesce(array(select distinct day_value::smallint from jsonb_array_elements_text(requested_schedule->'selected_days') as selected(day_value) order by day_value::smallint), '{}'),
    selected_timezone, coalesce((requested_schedule->>'enabled')::boolean, true),
    nullif(requested_schedule->>'template_id', '')::uuid,
    nullif(requested_schedule->>'template_item_id', '')::uuid,
    nullif(requested_schedule->>'category_id', '')::uuid,
    nullif(btrim(requested_schedule->>'notes'), '')
  ) returning * into created_schedule;
  perform public.refresh_payment_schedule_occurrences(created_schedule.id, (now() at time zone selected_timezone)::date + 366);
  return query select * from public.payment_schedules where id = created_schedule.id;
end;
$$;
