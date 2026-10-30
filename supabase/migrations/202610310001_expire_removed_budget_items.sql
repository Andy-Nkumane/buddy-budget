create or replace function public.enforce_budget_item_restore_window()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    new.archived_at := now();
  elsif old.archived_at is not null and new.archived_at is not null then
    new.archived_at := old.archived_at;
  end if;
  if old.archived_at is not null and new.archived_at is null and
    old.archived_at <= now() - interval '24 hours' then
    raise exception 'This budget item can no longer be restored'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_budget_item_restore_window on public.budget_month_items;
create trigger enforce_budget_item_restore_window
before update of archived_at on public.budget_month_items
for each row execute function public.enforce_budget_item_restore_window();

revoke all on function public.enforce_budget_item_restore_window() from public, anon, authenticated;

create or replace function public.delete_expired_budget_month_items()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := public.current_household_id();
  deleted_count bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.has_household_role(household, array['owner', 'editor']) then
    return 0;
  end if;

  delete from public.budget_month_items item
  where item.household_id = household
    and item.archived_at is not null
    and item.archived_at <= now() - interval '24 hours';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.delete_expired_budget_month_items() from public;
grant execute on function public.delete_expired_budget_month_items() to authenticated;
