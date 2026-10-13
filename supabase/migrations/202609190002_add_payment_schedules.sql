alter table public.budget_transactions
  add constraint budget_transactions_id_user_key unique (id, user_id);

create table public.payment_schedules (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  item_type text not null check (item_type in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor between 0 and 99999999999999),
  amount_is_approximate boolean not null default false,
  start_date date not null,
  end_date date,
  recurrence text not null check (recurrence in ('weekly', 'fortnightly', 'monthly', 'selected_days')),
  selected_days smallint[] not null default '{}',
  timezone text not null,
  next_occurrence date,
  enabled boolean not null default true,
  template_id uuid,
  template_item_id uuid,
  category_id uuid,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint payment_schedules_date_range check (end_date is null or end_date >= start_date),
  constraint payment_schedules_selected_days check (
    (recurrence = 'selected_days' and cardinality(selected_days) between 1 and 7 and selected_days <@ array[1,2,3,4,5,6,7]::smallint[])
    or (recurrence <> 'selected_days' and cardinality(selected_days) = 0)
  ),
  constraint payment_schedules_owned_template_fk foreign key (template_id, user_id)
    references public.budget_templates(id, user_id) on delete set null (template_id),
  constraint payment_schedules_owned_template_item_fk foreign key (template_item_id, user_id)
    references public.template_items(id, user_id) on delete set null (template_item_id),
  constraint payment_schedules_owned_category_fk foreign key (category_id, user_id)
    references public.categories(id, user_id) on delete set null (category_id)
);

create table public.payment_schedule_occurrences (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  schedule_id uuid not null,
  budget_month_id uuid not null,
  budget_month_item_id uuid,
  category_id uuid,
  due_date date not null,
  name_snapshot text not null check (char_length(btrim(name_snapshot)) between 1 and 100),
  item_type text not null check (item_type in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor between 0 and 99999999999999),
  amount_is_approximate boolean not null default false,
  status text not null default 'expected' check (status in ('expected', 'paid', 'received', 'skipped')),
  matched_transaction_id uuid,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, due_date),
  unique (matched_transaction_id),
  constraint payment_occurrences_status_type check (
    status in ('expected', 'skipped')
    or (status = 'paid' and item_type = 'expense')
    or (status = 'received' and item_type = 'income')
  ),
  constraint payment_occurrences_owned_schedule_fk foreign key (schedule_id, user_id)
    references public.payment_schedules(id, user_id) on delete restrict,
  constraint payment_occurrences_owned_month_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete restrict,
  constraint payment_occurrences_owned_item_fk foreign key (budget_month_item_id, budget_month_id, user_id)
    references public.budget_month_items(id, budget_month_id, user_id) on delete set null (budget_month_item_id),
  constraint payment_occurrences_owned_category_fk foreign key (category_id, user_id)
    references public.categories(id, user_id) on delete set null (category_id),
  constraint payment_occurrences_owned_transaction_fk foreign key (matched_transaction_id, user_id)
    references public.budget_transactions(id, user_id) on delete set null (matched_transaction_id)
);

create index payment_schedules_user_enabled_idx on public.payment_schedules(user_id, enabled, next_occurrence, id);
create index payment_occurrences_user_due_idx on public.payment_schedule_occurrences(user_id, due_date, status, id);
create index payment_occurrences_month_idx on public.payment_schedule_occurrences(budget_month_id, due_date, id);

create trigger payment_schedules_set_updated_at before update on public.payment_schedules
  for each row execute function public.set_updated_at();
create trigger payment_occurrences_set_updated_at before update on public.payment_schedule_occurrences
  for each row execute function public.set_updated_at();

create or replace function public.validate_payment_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.categories category where category.id = new.category_id
      and category.user_id = new.user_id and category.item_type = new.item_type
      and category.archived_at is null
  ) then raise exception 'Schedule category must be active, owned, and match its type' using errcode = '23514'; end if;
  if new.template_item_id is not null and not exists (
    select 1 from public.template_items item where item.id = new.template_item_id
      and item.user_id = new.user_id and item.item_type = new.item_type
      and item.archived_at is null
      and (new.template_id is null or item.template_id = new.template_id)
  ) then raise exception 'Schedule budget item must be active, owned, and match its type and template' using errcode = '23514'; end if;
  return new;
end;
$$;

create trigger payment_schedules_validate before insert or update on public.payment_schedules
  for each row execute function public.validate_payment_schedule();

alter table public.payment_schedules enable row level security;
alter table public.payment_schedule_occurrences enable row level security;

create policy payment_schedules_select_own on public.payment_schedules for select to authenticated
  using ((select auth.uid()) = user_id);
create policy payment_occurrences_select_own on public.payment_schedule_occurrences for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.payment_schedules from anon, authenticated;
revoke all on public.payment_schedule_occurrences from anon, authenticated;
grant select on public.payment_schedules to authenticated;
grant select on public.payment_schedule_occurrences to authenticated;

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

create or replace function public.snapshot_payment_schedules_for_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_schedule public.payment_schedules%rowtype;
  cursor_date date;
  month_end date := (new.month_start + interval '1 month - 1 day')::date;
  selected_month_item_id uuid;
begin
  for selected_schedule in
    select * from public.payment_schedules schedule
    where schedule.user_id = new.user_id and schedule.enabled
      and schedule.start_date <= month_end
      and (schedule.end_date is null or schedule.end_date >= new.month_start)
  loop
    cursor_date := greatest(selected_schedule.start_date, new.month_start);
    while cursor_date <= least(month_end, coalesce(selected_schedule.end_date, month_end)) loop
      if public.schedule_date_matches(cursor_date, selected_schedule.start_date, selected_schedule.recurrence, selected_schedule.selected_days) then
        selected_month_item_id := null;
        if selected_schedule.template_item_id is not null then
          select id into selected_month_item_id from public.budget_month_items
          where user_id = new.user_id and budget_month_id = new.id
            and source_template_item_id = selected_schedule.template_item_id and archived_at is null
          limit 1;
        end if;
        insert into public.payment_schedule_occurrences (
          user_id, schedule_id, budget_month_id, budget_month_item_id, category_id,
          due_date, name_snapshot, item_type, amount_minor, amount_is_approximate
        ) values (
          new.user_id, selected_schedule.id, new.id, selected_month_item_id,
          selected_schedule.category_id, cursor_date, selected_schedule.name,
          selected_schedule.item_type, selected_schedule.amount_minor,
          selected_schedule.amount_is_approximate
        ) on conflict (schedule_id, due_date) do nothing;
      end if;
      cursor_date := cursor_date + 1;
    end loop;
    update public.payment_schedules schedule set next_occurrence = (
      select min(occurrence.due_date) from public.payment_schedule_occurrences occurrence
      where occurrence.schedule_id = selected_schedule.id and occurrence.status = 'expected'
        and occurrence.due_date >= (now() at time zone selected_schedule.timezone)::date
    ) where schedule.id = selected_schedule.id;
  end loop;
  return new;
end;
$$;

create trigger budget_months_snapshot_payment_schedules
  after insert on public.budget_months
  for each row execute function public.snapshot_payment_schedules_for_month();

create or replace function public.link_payment_occurrence_budget_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_template_item_id is not null then
    update public.payment_schedule_occurrences occurrence
    set budget_month_item_id = new.id
    from public.payment_schedules schedule
    where occurrence.schedule_id = schedule.id
      and occurrence.user_id = new.user_id
      and occurrence.budget_month_id = new.budget_month_id
      and occurrence.budget_month_item_id is null
      and schedule.template_item_id = new.source_template_item_id;
  end if;
  return new;
end;
$$;

create trigger budget_month_items_link_payment_occurrences
  after insert on public.budget_month_items
  for each row execute function public.link_payment_occurrence_budget_item();

create or replace function public.refresh_payment_schedule_occurrences(
  requested_schedule_id uuid,
  requested_through date default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_schedule public.payment_schedules%rowtype;
  cursor_date date;
  horizon date;
  selected_month_id uuid;
  selected_month_item_id uuid;
  inserted_count integer := 0;
  local_today date;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into selected_schedule from public.payment_schedules
    where id = requested_schedule_id and user_id = current_user_id for update;
  if not found then raise exception 'Schedule not found' using errcode = '42501'; end if;

  local_today := (now() at time zone selected_schedule.timezone)::date;

  horizon := least(coalesce(requested_through, local_today + 366), local_today + 366);
  if selected_schedule.end_date is not null then horizon := least(horizon, selected_schedule.end_date); end if;
  cursor_date := greatest(selected_schedule.start_date, date_trunc('month', local_today)::date);

  while selected_schedule.enabled and cursor_date <= horizon loop
    if public.schedule_date_matches(cursor_date, selected_schedule.start_date, selected_schedule.recurrence, selected_schedule.selected_days) then
      select id into selected_month_id from public.budget_months
        where user_id = current_user_id and month_start = date_trunc('month', cursor_date)::date;
      if selected_month_id is not null then
        selected_month_item_id := null;
        if selected_schedule.template_item_id is not null then
          select id into selected_month_item_id from public.budget_month_items
            where user_id = current_user_id and budget_month_id = selected_month_id
              and source_template_item_id = selected_schedule.template_item_id and archived_at is null
            limit 1;
        end if;
        insert into public.payment_schedule_occurrences (
          user_id, schedule_id, budget_month_id, budget_month_item_id, category_id,
          due_date, name_snapshot, item_type, amount_minor, amount_is_approximate
        ) values (
          current_user_id, selected_schedule.id, selected_month_id, selected_month_item_id,
          selected_schedule.category_id, cursor_date, selected_schedule.name,
          selected_schedule.item_type, selected_schedule.amount_minor,
          selected_schedule.amount_is_approximate
        ) on conflict (schedule_id, due_date) do nothing;
        if found then inserted_count := inserted_count + 1; end if;
      end if;
    end if;
    cursor_date := cursor_date + 1;
  end loop;

  update public.payment_schedules schedule set next_occurrence = (
    select min(occurrence.due_date) from public.payment_schedule_occurrences occurrence
    where occurrence.schedule_id = schedule.id and occurrence.status = 'expected'
      and occurrence.due_date >= local_today
  ) where schedule.id = selected_schedule.id;
  return inserted_count;
end;
$$;

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

create or replace function public.update_payment_schedule(requested_schedule_id uuid, requested_schedule jsonb)
returns setof public.payment_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_timezone text;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  selected_timezone := coalesce(nullif(requested_schedule->>'timezone', ''), 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = selected_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  delete from public.payment_schedule_occurrences occurrence
    where occurrence.schedule_id = requested_schedule_id
      and occurrence.user_id = current_user_id
      and occurrence.status = 'expected'
      and occurrence.due_date >= (now() at time zone selected_timezone)::date;
  update public.payment_schedules set
    name = btrim(requested_schedule->>'name'), item_type = requested_schedule->>'item_type',
    amount_minor = (requested_schedule->>'amount_minor')::bigint,
    amount_is_approximate = coalesce((requested_schedule->>'amount_is_approximate')::boolean, false),
    start_date = (requested_schedule->>'start_date')::date,
    end_date = nullif(requested_schedule->>'end_date', '')::date,
    recurrence = requested_schedule->>'recurrence',
    selected_days = coalesce(array(select distinct day_value::smallint from jsonb_array_elements_text(requested_schedule->'selected_days') as selected(day_value) order by day_value::smallint), '{}'),
    timezone = selected_timezone, enabled = coalesce((requested_schedule->>'enabled')::boolean, true),
    template_id = nullif(requested_schedule->>'template_id', '')::uuid,
    template_item_id = nullif(requested_schedule->>'template_item_id', '')::uuid,
    category_id = nullif(requested_schedule->>'category_id', '')::uuid,
    notes = nullif(btrim(requested_schedule->>'notes'), '')
  where id = requested_schedule_id and user_id = current_user_id;
  if not found then raise exception 'Schedule not found' using errcode = '42501'; end if;
  perform public.refresh_payment_schedule_occurrences(requested_schedule_id, (now() at time zone selected_timezone)::date + 366);
  return query select * from public.payment_schedules where id = requested_schedule_id;
end;
$$;

create or replace function public.confirm_payment_occurrence(
  requested_occurrence_id uuid,
  requested_status text,
  requested_transaction_id uuid default null
)
returns setof public.payment_schedule_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_occurrence public.payment_schedule_occurrences%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into selected_occurrence from public.payment_schedule_occurrences
    where id = requested_occurrence_id and user_id = current_user_id for update;
  if not found then raise exception 'Occurrence not found' using errcode = '42501'; end if;
  perform public.assert_budget_month_editable(
    date_trunc('month', selected_occurrence.due_date)::date, current_user_id
  );
  if requested_status not in ('expected', 'paid', 'received', 'skipped') then
    raise exception 'Invalid occurrence status' using errcode = '22023';
  end if;
  if requested_transaction_id is not null and requested_status in ('expected', 'skipped') then
    raise exception 'A matched transaction requires a paid or received state' using errcode = '23514';
  end if;
  if requested_transaction_id is not null and not exists (
    select 1 from public.budget_transactions entry
    where entry.id = requested_transaction_id and entry.user_id = current_user_id
      and entry.budget_month_id = selected_occurrence.budget_month_id
      and entry.transaction_type = selected_occurrence.item_type and entry.status = 'posted'
  ) then raise exception 'Posted matching transaction not found' using errcode = '23514'; end if;
  update public.payment_schedule_occurrences set
    status = requested_status,
    matched_transaction_id = requested_transaction_id,
    confirmed_at = case when requested_status = 'expected' then null else now() end
  where id = requested_occurrence_id;
  perform public.refresh_payment_schedule_occurrences(selected_occurrence.schedule_id, selected_occurrence.due_date + 366);
  return query select * from public.payment_schedule_occurrences where id = requested_occurrence_id;
end;
$$;

revoke all on function public.create_payment_schedule(jsonb) from public;
revoke all on function public.update_payment_schedule(uuid, jsonb) from public;
revoke all on function public.refresh_payment_schedule_occurrences(uuid, date) from public;
revoke all on function public.confirm_payment_occurrence(uuid, text, uuid) from public;
grant execute on function public.create_payment_schedule(jsonb) to authenticated;
grant execute on function public.update_payment_schedule(uuid, jsonb) to authenticated;
grant execute on function public.refresh_payment_schedule_occurrences(uuid, date) to authenticated;
grant execute on function public.confirm_payment_occurrence(uuid, text, uuid) to authenticated;

create trigger payment_occurrences_enforce_editable
  before update or delete on public.payment_schedule_occurrences
  for each row execute function public.enforce_budget_transaction_editable();
