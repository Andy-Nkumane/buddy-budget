alter table public.payment_schedules drop constraint payment_schedules_recurrence_check;
alter table public.payment_schedules add constraint payment_schedules_recurrence_check
  check (recurrence in ('once', 'weekly', 'fortnightly', 'monthly', 'selected_days'));

alter table public.payment_schedule_occurrences drop constraint payment_schedule_occurrences_status_check;
alter table public.payment_schedule_occurrences add constraint payment_schedule_occurrences_status_check
  check (status in ('expected', 'paid', 'received', 'skipped', 'disabled'));
alter table public.payment_schedule_occurrences drop constraint payment_occurrences_status_type;
alter table public.payment_schedule_occurrences add constraint payment_occurrences_status_type check (
  status in ('expected', 'skipped', 'disabled')
  or (status = 'paid' and item_type = 'expense')
  or (status = 'received' and item_type = 'income')
);

create or replace function public.schedule_date_matches(
  requested_date date,
  requested_start date,
  requested_recurrence text,
  requested_selected_days smallint[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case requested_recurrence
    when 'once' then requested_date = requested_start
    when 'weekly' then (requested_date - requested_start) % 7 = 0
    when 'fortnightly' then (requested_date - requested_start) % 14 = 0
    when 'selected_days' then extract(isodow from requested_date)::smallint = any(requested_selected_days)
    when 'monthly' then extract(day from requested_date)::int = least(
      extract(day from requested_start)::int,
      extract(day from (date_trunc('month', requested_date) + interval '1 month - 1 day'))::int
    )
    else false
  end;
$$;

create or replace function public.update_payment_schedule(requested_schedule_id uuid, requested_schedule jsonb)
returns setof public.payment_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_timezone text;
  selected_schedule public.payment_schedules%rowtype;
  requested_enabled boolean;
  schedule_changed boolean;
  local_today date;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  selected_timezone := coalesce(nullif(requested_schedule->>'timezone', ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = selected_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  select * into selected_schedule from public.payment_schedules
    where id = requested_schedule_id and user_id = current_user_id for update;
  if not found then raise exception 'Schedule not found' using errcode = '42501'; end if;
  requested_enabled := coalesce((requested_schedule->>'enabled')::boolean, true);
  local_today := (now() at time zone selected_timezone)::date;
  schedule_changed :=
    selected_schedule.name is distinct from btrim(requested_schedule->>'name')
    or selected_schedule.item_type is distinct from requested_schedule->>'item_type'
    or selected_schedule.amount_minor is distinct from (requested_schedule->>'amount_minor')::bigint
    or selected_schedule.amount_is_approximate is distinct from coalesce((requested_schedule->>'amount_is_approximate')::boolean, false)
    or selected_schedule.start_date is distinct from (requested_schedule->>'start_date')::date
    or selected_schedule.end_date is distinct from nullif(requested_schedule->>'end_date', '')::date
    or selected_schedule.recurrence is distinct from requested_schedule->>'recurrence'
    or selected_schedule.selected_days is distinct from coalesce(array(select distinct day_value::smallint from jsonb_array_elements_text(requested_schedule->'selected_days') as selected(day_value) order by day_value::smallint), '{}')
    or selected_schedule.timezone is distinct from selected_timezone
    or selected_schedule.template_id is distinct from nullif(requested_schedule->>'template_id', '')::uuid
    or selected_schedule.template_item_id is distinct from nullif(requested_schedule->>'template_item_id', '')::uuid
    or selected_schedule.category_id is distinct from nullif(requested_schedule->>'category_id', '')::uuid;

  if schedule_changed then
    delete from public.payment_schedule_occurrences occurrence
      where occurrence.schedule_id = requested_schedule_id
        and occurrence.user_id = current_user_id
        and occurrence.status in ('expected', 'disabled')
        and occurrence.due_date >= local_today;
  end if;

  update public.payment_schedules set
    name = btrim(requested_schedule->>'name'), item_type = requested_schedule->>'item_type',
    amount_minor = (requested_schedule->>'amount_minor')::bigint,
    amount_is_approximate = coalesce((requested_schedule->>'amount_is_approximate')::boolean, false),
    start_date = (requested_schedule->>'start_date')::date,
    end_date = nullif(requested_schedule->>'end_date', '')::date,
    recurrence = requested_schedule->>'recurrence',
    selected_days = coalesce(array(select distinct day_value::smallint from jsonb_array_elements_text(requested_schedule->'selected_days') as selected(day_value) order by day_value::smallint), '{}'),
    timezone = selected_timezone, enabled = requested_enabled,
    template_id = nullif(requested_schedule->>'template_id', '')::uuid,
    template_item_id = nullif(requested_schedule->>'template_item_id', '')::uuid,
    category_id = nullif(requested_schedule->>'category_id', '')::uuid,
    notes = nullif(btrim(requested_schedule->>'notes'), '')
  where id = requested_schedule_id and user_id = current_user_id;

  if not schedule_changed then
    update public.payment_schedule_occurrences set
      status = case when requested_enabled then 'expected' else 'disabled' end,
      confirmed_at = null
    where schedule_id = requested_schedule_id and user_id = current_user_id
      and due_date >= local_today
      and status = case when requested_enabled then 'disabled' else 'expected' end;
  end if;

  perform public.refresh_payment_schedule_occurrences(requested_schedule_id, local_today + 366);
  return query select * from public.payment_schedules where id = requested_schedule_id;
end;
$$;
