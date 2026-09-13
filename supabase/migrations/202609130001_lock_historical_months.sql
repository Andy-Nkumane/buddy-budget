create or replace function public.assert_budget_month_editable(
  requested_month_start date,
  requested_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_timezone text;
  editable_from date;
begin
  if auth.uid() is null then
    return;
  end if;

  select coalesce(nullif(profile.timezone, ''), 'UTC')
    into selected_timezone
    from public.profiles profile
    where profile.user_id = requested_user_id;

  selected_timezone := coalesce(selected_timezone, 'UTC');
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = selected_timezone
  ) then
    selected_timezone := 'UTC';
  end if;
  editable_from := (
    date_trunc('month', now() at time zone selected_timezone) - interval '1 month'
  )::date;

  if requested_month_start < editable_from then
    raise exception 'Months that are two or more calendar months old are read-only'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.enforce_budget_month_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_budget_month_editable(new.month_start, new.user_id);
    return new;
  end if;

  perform public.assert_budget_month_editable(old.month_start, old.user_id);
  if tg_op = 'UPDATE' then
    perform public.assert_budget_month_editable(new.month_start, new.user_id);
    return new;
  end if;

  return old;
end;
$$;

create or replace function public.enforce_budget_month_item_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_month_start date;
  selected_user_id uuid;
  item_user_id uuid;
begin
  item_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  select month.month_start, month.user_id
    into selected_month_start, selected_user_id
    from public.budget_months month
    where month.id = case when tg_op = 'DELETE' then old.budget_month_id else new.budget_month_id end;

  if selected_user_id = item_user_id then
    perform public.assert_budget_month_editable(selected_month_start, selected_user_id);
  end if;

  if tg_op = 'UPDATE' and new.budget_month_id <> old.budget_month_id then
    select month.month_start, month.user_id
      into selected_month_start, selected_user_id
      from public.budget_months month
      where month.id = old.budget_month_id;
    perform public.assert_budget_month_editable(selected_month_start, selected_user_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists budget_months_enforce_editable on public.budget_months;
create trigger budget_months_enforce_editable
  before insert or update or delete on public.budget_months
  for each row execute function public.enforce_budget_month_editable();

drop trigger if exists budget_month_items_enforce_editable on public.budget_month_items;
create trigger budget_month_items_enforce_editable
  before insert or update or delete on public.budget_month_items
  for each row execute function public.enforce_budget_month_item_editable();

revoke all on function public.assert_budget_month_editable(date, uuid) from public, anon, authenticated;
revoke all on function public.enforce_budget_month_editable() from public, anon, authenticated;
revoke all on function public.enforce_budget_month_item_editable() from public, anon, authenticated;
