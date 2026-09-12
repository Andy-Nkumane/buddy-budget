create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  currency_code varchar(3) not null default 'ZAR' check (currency_code ~ '^[A-Z]{3}$'),
  locale text not null default 'en-ZA' check (char_length(locale) between 2 and 35),
  timezone text not null default 'Africa/Johannesburg' check (char_length(timezone) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_budget_month_id uuid,
  last_route text check (last_route is null or (last_route like '/app/%' and last_route not like '//%')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('income', 'expense')),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.budget_templates (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.template_items (
  id uuid primary key default extensions.gen_random_uuid(),
  template_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete restrict,
  item_type text not null check (item_type in ('income', 'expense')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  default_amount numeric(14,2) not null default 0 check (default_amount between 0 and 999999999999.99),
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_items_owned_parent_fk foreign key (template_id, user_id)
    references public.budget_templates(id, user_id) on delete cascade,
  unique (id, user_id)
);

create table public.budget_months (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_template_id uuid references public.budget_templates(id) on delete set null,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  currency_code varchar(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'archived')),
  notes text check (notes is null or char_length(notes) <= 2000),
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start),
  unique (id, user_id)
);

alter table public.user_preferences
  add constraint preferences_last_month_fk
  foreign key (last_budget_month_id, user_id)
  references public.budget_months(id, user_id)
  on delete set null (last_budget_month_id);

create table public.budget_month_items (
  id uuid primary key default extensions.gen_random_uuid(),
  budget_month_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_template_item_id uuid,
  category_id uuid references public.categories(id) on delete restrict,
  item_type text not null check (item_type in ('income', 'expense')),
  name_snapshot text not null check (char_length(btrim(name_snapshot)) between 1 and 100),
  category_snapshot text check (category_snapshot is null or char_length(category_snapshot) <= 60),
  default_amount_snapshot numeric(14,2) not null default 0 check (default_amount_snapshot between 0 and 999999999999.99),
  amount numeric(14,2) not null default 0 check (amount between 0 and 999999999999.99),
  is_disabled boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint month_items_owned_parent_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete cascade,
  constraint month_items_owned_source_fk foreign key (source_template_item_id, user_id)
    references public.template_items(id, user_id) on delete set null (source_template_item_id)
);

create unique index budget_templates_one_active_default
  on public.budget_templates(user_id)
  where is_default and archived_at is null;
create unique index categories_unique_active_name
  on public.categories(user_id, item_type, lower(name))
  where archived_at is null;
create index budget_months_user_updated_idx on public.budget_months(user_id, updated_at desc);
create index budget_month_items_month_sort_idx on public.budget_month_items(budget_month_id, sort_order);
create index budget_month_items_user_idx on public.budget_month_items(user_id);
create index budget_templates_user_idx on public.budget_templates(user_id);
create index template_items_template_sort_idx on public.template_items(template_id, sort_order);
create index template_items_user_idx on public.template_items(user_id);
create index categories_user_type_idx on public.categories(user_id, item_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger templates_set_updated_at before update on public.budget_templates
  for each row execute function public.set_updated_at();
create trigger template_items_set_updated_at before update on public.template_items
  for each row execute function public.set_updated_at();
create trigger months_set_updated_at before update on public.budget_months
  for each row execute function public.set_updated_at();
create trigger month_items_set_updated_at before update on public.budget_month_items
  for each row execute function public.set_updated_at();

create or replace function public.validate_category_ownership_and_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_owner uuid;
  category_type text;
begin
  if new.category_id is null then
    return new;
  end if;
  select user_id, item_type into category_owner, category_type
    from public.categories where id = new.category_id;
  if category_owner is null or category_owner <> new.user_id or category_type <> new.item_type then
    raise exception 'Category must belong to the same user and item type' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger template_items_validate_category
  before insert or update of category_id, user_id, item_type on public.template_items
  for each row execute function public.validate_category_ownership_and_type();
create trigger month_items_validate_category
  before insert or update of category_id, user_id, item_type on public.budget_month_items
  for each row execute function public.validate_category_ownership_and_type();

create or replace function public.validate_month_source_template()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_template_id is not null and not exists (
    select 1 from public.budget_templates
    where id = new.source_template_id and user_id = new.user_id
  ) then
    raise exception 'Source template must belong to the same user' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger months_validate_source_template
  before insert or update of source_template_id, user_id on public.budget_months
  for each row execute function public.validate_month_source_template();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;
alter table public.budget_templates enable row level security;
alter table public.template_items enable row level security;
alter table public.budget_months enable row level security;
alter table public.budget_month_items enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy preferences_select_own on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy preferences_insert_own on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy preferences_update_own on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy preferences_delete_own on public.user_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy categories_select_own on public.categories for select to authenticated
  using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_delete_own on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy templates_select_own on public.budget_templates for select to authenticated
  using ((select auth.uid()) = user_id);
create policy templates_insert_own on public.budget_templates for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy templates_update_own on public.budget_templates for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy templates_delete_own on public.budget_templates for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy template_items_select_own on public.template_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy template_items_insert_own on public.template_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy template_items_update_own on public.template_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy template_items_delete_own on public.template_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy months_select_own on public.budget_months for select to authenticated
  using ((select auth.uid()) = user_id);
create policy months_insert_own on public.budget_months for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy months_update_own on public.budget_months for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy months_delete_own on public.budget_months for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy month_items_select_own on public.budget_month_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy month_items_insert_own on public.budget_month_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy month_items_update_own on public.budget_month_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy month_items_delete_own on public.budget_month_items for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.budget_templates to authenticated;
grant select, insert, update, delete on public.template_items to authenticated;
grant select, insert, update, delete on public.budget_months to authenticated;
grant select, insert, update, delete on public.budget_month_items to authenticated;

create or replace function public.create_month_from_template(
  requested_month_start date,
  requested_template_id uuid
)
returns setof public.budget_months
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_month date := date_trunc('month', requested_month_start)::date;
  selected_template public.budget_templates%rowtype;
  selected_profile public.profiles%rowtype;
  created_month public.budget_months%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_month_start is null or requested_month_start <> normalized_month then
    raise exception 'month_start must be the first day of a month' using errcode = '22007';
  end if;

  select * into selected_template from public.budget_templates
    where id = requested_template_id
      and user_id = current_user_id
      and archived_at is null;
  if selected_template.id is null then
    raise exception 'Template not found' using errcode = '42501';
  end if;

  select * into selected_profile from public.profiles where user_id = current_user_id;

  insert into public.budget_months (user_id, source_template_id, month_start, currency_code)
    values (current_user_id, selected_template.id, normalized_month, coalesce(selected_profile.currency_code, 'ZAR'))
    on conflict (user_id, month_start) do nothing
    returning * into created_month;

  if created_month.id is null then
    select * into created_month from public.budget_months
      where user_id = current_user_id and month_start = normalized_month;
    return next created_month;
    return;
  end if;

  insert into public.budget_month_items (
    budget_month_id,
    user_id,
    source_template_item_id,
    category_id,
    item_type,
    name_snapshot,
    category_snapshot,
    default_amount_snapshot,
    amount,
    sort_order
  )
  select
    created_month.id,
    current_user_id,
    item.id,
    item.category_id,
    item.item_type,
    item.name,
    category.name,
    item.default_amount,
    item.default_amount,
    item.sort_order
  from public.template_items item
  left join public.categories category on category.id = item.category_id
  where item.template_id = selected_template.id
    and item.user_id = current_user_id
    and item.archived_at is null
  order by item.item_type desc, item.sort_order, item.created_at;

  return next created_month;
end;
$$;

create or replace function public.set_default_template(requested_template_id uuid)
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
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  if not exists (
    select 1 from public.budget_templates
    where id = requested_template_id and user_id = current_user_id and archived_at is null
  ) then
    raise exception 'Template not found' using errcode = '42501';
  end if;
  update public.budget_templates set is_default = false
    where user_id = current_user_id and is_default;
  update public.budget_templates set is_default = true
    where id = requested_template_id and user_id = current_user_id;
end;
$$;

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

create or replace function public.delete_own_account()
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
  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.create_month_from_template(date, uuid) from public, anon;
revoke all on function public.set_default_template(uuid) from public, anon;
revoke all on function public.setup_first_budget(text, text, text, text, text, text, jsonb) from public, anon;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.create_month_from_template(date, uuid) to authenticated;
grant execute on function public.set_default_template(uuid) to authenticated;
grant execute on function public.setup_first_budget(text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.validate_category_ownership_and_type() from public, anon, authenticated;
revoke all on function public.validate_month_source_template() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
