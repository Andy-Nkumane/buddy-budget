create or replace function public.update_profile_and_preferences(
  requested_display_name text,
  requested_currency_code text,
  requested_locale text,
  requested_timezone text,
  requested_theme text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_currency_code !~ '^[A-Z]{3}$'
     or char_length(requested_locale) not between 2 and 35
     or char_length(requested_timezone) not between 1 and 80
     or requested_theme not in ('system', 'light', 'dark')
     or char_length(requested_display_name) > 80 then
    raise exception 'Invalid settings input' using errcode = '22023';
  end if;

  insert into public.profiles (user_id, display_name, currency_code, locale, timezone)
    values (
      current_user_id,
      nullif(btrim(requested_display_name), ''),
      requested_currency_code,
      requested_locale,
      requested_timezone
    )
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      currency_code = excluded.currency_code,
      locale = excluded.locale,
      timezone = excluded.timezone;

  insert into public.user_preferences (user_id, theme)
    values (current_user_id, requested_theme)
    on conflict (user_id) do update set theme = excluded.theme;
end;
$$;

create or replace function public.move_category(requested_category_id uuid, requested_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_type text;
  selected_order integer;
  neighbour_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1' using errcode = '22023';
  end if;
  select item_type into selected_type from public.categories
    where id = requested_category_id and user_id = current_user_id and archived_at is null;
  if selected_type is null then
    raise exception 'Category not found' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':category:' || selected_type, 0));

  with ordered as (
    select id, row_number() over (order by sort_order, created_at, id)::integer - 1 as position
    from public.categories
    where user_id = current_user_id and item_type = selected_type and archived_at is null
  )
  update public.categories category set sort_order = ordered.position
    from ordered where category.id = ordered.id;

  select sort_order into selected_order from public.categories where id = requested_category_id;
  select id into neighbour_id from public.categories
    where user_id = current_user_id and item_type = selected_type and archived_at is null
      and sort_order = selected_order + requested_direction;
  if neighbour_id is null then return; end if;

  update public.categories set sort_order = case
    when id = requested_category_id then selected_order + requested_direction
    else selected_order
  end where id in (requested_category_id, neighbour_id);
end;
$$;

create or replace function public.move_template_item(requested_item_id uuid, requested_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_template_id uuid;
  selected_type text;
  selected_order integer;
  neighbour_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_direction not in (-1, 1) then
    raise exception 'Direction must be -1 or 1' using errcode = '22023';
  end if;
  select template_id, item_type into selected_template_id, selected_type
    from public.template_items
    where id = requested_item_id and user_id = current_user_id and archived_at is null;
  if selected_template_id is null then
    raise exception 'Template item not found' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(selected_template_id::text || ':' || selected_type, 0));

  with ordered as (
    select id, row_number() over (order by sort_order, created_at, id)::integer - 1 as position
    from public.template_items
    where user_id = current_user_id and template_id = selected_template_id
      and item_type = selected_type and archived_at is null
  )
  update public.template_items item set sort_order = ordered.position
    from ordered where item.id = ordered.id;

  select sort_order into selected_order from public.template_items where id = requested_item_id;
  select id into neighbour_id from public.template_items
    where user_id = current_user_id and template_id = selected_template_id
      and item_type = selected_type and archived_at is null
      and sort_order = selected_order + requested_direction;
  if neighbour_id is null then return; end if;

  update public.template_items set sort_order = case
    when id = requested_item_id then selected_order + requested_direction
    else selected_order
  end where id in (requested_item_id, neighbour_id);
end;
$$;

create or replace function public.create_category(requested_name text, requested_item_type text)
returns setof public.categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_item_type not in ('income', 'expense') then
    raise exception 'Invalid item type' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':category:' || requested_item_type, 0));
  return query insert into public.categories (user_id, name, item_type, sort_order)
    values (
      current_user_id,
      btrim(requested_name),
      requested_item_type,
      coalesce((select max(sort_order) + 1 from public.categories
        where user_id = current_user_id and item_type = requested_item_type), 0)
    ) returning *;
end;
$$;

create or replace function public.create_template_item(
  requested_template_id uuid,
  requested_name text,
  requested_item_type text,
  requested_amount numeric,
  requested_category_id uuid
)
returns setof public.template_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.budget_templates
    where id = requested_template_id and user_id = current_user_id and archived_at is null) then
    raise exception 'Template not found' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_template_id::text || ':' || requested_item_type, 0));
  return query insert into public.template_items (
    template_id, user_id, category_id, item_type, name, default_amount, sort_order
  ) values (
    requested_template_id,
    current_user_id,
    requested_category_id,
    requested_item_type,
    btrim(requested_name),
    requested_amount,
    coalesce((select max(sort_order) + 1 from public.template_items
      where template_id = requested_template_id and item_type = requested_item_type), 0)
  ) returning *;
end;
$$;

create or replace function public.create_month_item(
  requested_month_id uuid,
  requested_name text,
  requested_item_type text,
  requested_amount numeric,
  requested_category_id uuid
)
returns setof public.budget_month_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_category_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.budget_months
    where id = requested_month_id and user_id = current_user_id) then
    raise exception 'Budget month not found' using errcode = '42501';
  end if;
  if requested_category_id is not null then
    select name into selected_category_name from public.categories
      where id = requested_category_id and user_id = current_user_id
        and item_type = requested_item_type and archived_at is null;
    if selected_category_name is null then
      raise exception 'Category not found' using errcode = '23514';
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_month_id::text || ':' || requested_item_type, 0));
  return query insert into public.budget_month_items (
    budget_month_id, user_id, category_id, item_type, name_snapshot, category_snapshot,
    default_amount_snapshot, amount, sort_order
  ) values (
    requested_month_id,
    current_user_id,
    requested_category_id,
    requested_item_type,
    btrim(requested_name),
    selected_category_name,
    requested_amount,
    requested_amount,
    coalesce((select max(sort_order) + 1 from public.budget_month_items
      where budget_month_id = requested_month_id and item_type = requested_item_type), 0)
  ) returning *;
end;
$$;

revoke all on function public.update_profile_and_preferences(text, text, text, text, text) from public, anon;
revoke all on function public.move_category(uuid, integer) from public, anon;
revoke all on function public.move_template_item(uuid, integer) from public, anon;
revoke all on function public.create_category(text, text) from public, anon;
revoke all on function public.create_template_item(uuid, text, text, numeric, uuid) from public, anon;
revoke all on function public.create_month_item(uuid, text, text, numeric, uuid) from public, anon;
grant execute on function public.update_profile_and_preferences(text, text, text, text, text) to authenticated;
grant execute on function public.move_category(uuid, integer) to authenticated;
grant execute on function public.move_template_item(uuid, integer) to authenticated;
grant execute on function public.create_category(text, text) to authenticated;
grant execute on function public.create_template_item(uuid, text, text, numeric, uuid) to authenticated;
grant execute on function public.create_month_item(uuid, text, text, numeric, uuid) to authenticated;
