create or replace function public.setup_first_budget(
  requested_display_name text,
  requested_currency_code text,
  requested_locale text,
  requested_timezone text,
  requested_theme text,
  requested_template_name text,
  requested_template_items jsonb
)
returns setof public.budget_months
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_template_id uuid;
  item_count integer;
  inserted_item_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_currency_code !~ '^[A-Z]{3}$'
     or char_length(requested_locale) not between 2 and 35
     or char_length(requested_timezone) not between 1 and 80
     or requested_theme not in ('system', 'light', 'dark')
     or char_length(btrim(requested_template_name)) not between 1 and 80
     or requested_template_items is null
     or jsonb_typeof(requested_template_items) <> 'array' then
    raise exception 'Invalid onboarding input' using errcode = '22023';
  end if;
  if jsonb_array_length(requested_template_items) = 0 then
    raise exception 'At least one valid template item is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  insert into public.profiles (user_id, display_name, currency_code, locale, timezone)
    values (current_user_id, nullif(btrim(requested_display_name), ''), requested_currency_code, requested_locale, requested_timezone)
    on conflict (user_id) do update set
      display_name = excluded.display_name,
      currency_code = excluded.currency_code,
      locale = excluded.locale,
      timezone = excluded.timezone;

  insert into public.user_preferences (user_id, theme)
    values (current_user_id, requested_theme)
    on conflict (user_id) do update set theme = excluded.theme;

  insert into public.categories (user_id, item_type, name, sort_order)
    values
      (current_user_id, 'income', 'Earnings', 0),
      (current_user_id, 'expense', 'Housing', 0),
      (current_user_id, 'expense', 'Utilities', 1),
      (current_user_id, 'expense', 'Groceries', 2),
      (current_user_id, 'expense', 'Transport', 3),
      (current_user_id, 'expense', 'Entertainment', 4)
    on conflict do nothing;

  select id into selected_template_id from public.budget_templates
    where user_id = current_user_id and is_default and archived_at is null;
  if selected_template_id is null then
    insert into public.budget_templates (user_id, name, is_default)
      values (current_user_id, btrim(requested_template_name), true)
      returning id into selected_template_id;
  end if;

  select count(*) into item_count from public.template_items
    where template_id = selected_template_id;
  if item_count = 0 then
    insert into public.template_items (
      template_id, user_id, category_id, item_type, name, default_amount, sort_order
    )
    select
      selected_template_id,
      current_user_id,
      category.id,
      item.value ->> 'item_type',
      btrim(item.value ->> 'name'),
      (item.value ->> 'default_amount')::numeric,
      item.ordinality - 1
    from jsonb_array_elements(requested_template_items) with ordinality
      as item(value, ordinality)
    join public.categories category
      on category.user_id = current_user_id
      and category.item_type = item.value ->> 'item_type'
      and category.name = btrim(item.value ->> 'category_name')
      and category.archived_at is null;
    get diagnostics inserted_item_count = row_count;
    if inserted_item_count <> jsonb_array_length(requested_template_items) then
      raise exception 'Every template item must have a valid category' using errcode = '22023';
    end if;
  end if;

  update public.user_preferences
    set onboarding_completed_at = coalesce(onboarding_completed_at, now())
    where user_id = current_user_id;

  return query select * from public.create_month_from_template(
    date_trunc('month', current_date)::date,
    selected_template_id
  );
end;
$$;
