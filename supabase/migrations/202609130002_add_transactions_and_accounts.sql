alter table public.categories
  add constraint categories_id_user_key unique (id, user_id);

alter table public.budget_month_items
  add constraint budget_month_items_id_month_user_key unique (id, budget_month_id, user_id);

create table public.financial_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  account_type text not null check (account_type in ('cash', 'checking', 'savings', 'credit')),
  currency_code varchar(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  opening_balance_minor bigint not null default 0
    check (opening_balance_minor between -99999999999999 and 99999999999999),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.budget_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_month_id uuid not null,
  budget_month_item_id uuid,
  category_id uuid,
  account_id uuid,
  transaction_date date not null,
  description text not null check (char_length(btrim(description)) between 1 and 160),
  amount_minor bigint not null check (amount_minor between 0 and 99999999999999),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  is_refund boolean not null default false,
  notes text check (notes is null or char_length(notes) <= 1000),
  source text not null default 'manual' check (source in ('manual')),
  status text not null default 'posted' check (status in ('pending', 'posted', 'void')),
  external_fingerprint text check (
    external_fingerprint is null or char_length(external_fingerprint) between 1 and 255
  ),
  category_snapshot text check (
    category_snapshot is null or char_length(category_snapshot) <= 60
  ),
  budget_item_snapshot text check (
    budget_item_snapshot is null or char_length(budget_item_snapshot) <= 100
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_transactions_owned_month_fk
    foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete cascade,
  constraint budget_transactions_owned_item_fk
    foreign key (budget_month_item_id, budget_month_id, user_id)
    references public.budget_month_items(id, budget_month_id, user_id)
    on delete set null (budget_month_item_id),
  constraint budget_transactions_owned_category_fk
    foreign key (category_id, user_id)
    references public.categories(id, user_id) on delete set null (category_id),
  constraint budget_transactions_owned_account_fk
    foreign key (account_id, user_id)
    references public.financial_accounts(id, user_id) on delete set null (account_id)
);

create index financial_accounts_user_active_idx
  on public.financial_accounts(user_id, archived_at, created_at, id);
create index budget_transactions_user_date_idx
  on public.budget_transactions(user_id, transaction_date desc, created_at desc, id);
create index budget_transactions_month_date_idx
  on public.budget_transactions(budget_month_id, transaction_date desc, created_at desc, id);
create index budget_transactions_item_idx
  on public.budget_transactions(budget_month_item_id)
  where budget_month_item_id is not null;
create index budget_transactions_category_idx
  on public.budget_transactions(category_id)
  where category_id is not null;
create index budget_transactions_account_idx
  on public.budget_transactions(account_id, status)
  where account_id is not null;
create unique index budget_transactions_external_fingerprint_key
  on public.budget_transactions(user_id, source, external_fingerprint)
  where external_fingerprint is not null;

create trigger financial_accounts_set_updated_at
  before update on public.financial_accounts
  for each row execute function public.set_updated_at();
create trigger budget_transactions_set_updated_at
  before update on public.budget_transactions
  for each row execute function public.set_updated_at();

create or replace function public.validate_budget_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_month_start date;
  selected_currency text;
  selected_type text;
  selected_name text;
  selected_archived_at timestamptz;
begin
  select month.month_start, month.currency_code
    into selected_month_start, selected_currency
    from public.budget_months month
    where month.id = new.budget_month_id and month.user_id = new.user_id;
  if selected_month_start is null then
    raise exception 'Budget month not found' using errcode = '23514';
  end if;
  if date_trunc('month', new.transaction_date)::date <> selected_month_start then
    raise exception 'Transaction date must be inside its budget month' using errcode = '23514';
  end if;

  new.category_snapshot := null;
  if new.category_id is not null then
    select category.item_type, category.name, category.archived_at
      into selected_type, selected_name, selected_archived_at
      from public.categories category
      where category.id = new.category_id and category.user_id = new.user_id;
    if selected_type is null or selected_type <> new.transaction_type then
      raise exception 'Category must belong to the same user and transaction type'
        using errcode = '23514';
    end if;
    if selected_archived_at is not null and (
      tg_op <> 'UPDATE' or new.category_id is distinct from old.category_id
    ) then
      raise exception 'New transaction assignments require an active category'
        using errcode = '23514';
    end if;
    new.category_snapshot := selected_name;
  end if;

  new.budget_item_snapshot := null;
  if new.budget_month_item_id is not null then
    select item.item_type, item.name_snapshot, item.archived_at
      into selected_type, selected_name, selected_archived_at
      from public.budget_month_items item
      where item.id = new.budget_month_item_id
        and item.budget_month_id = new.budget_month_id
        and item.user_id = new.user_id;
    if selected_type is null or selected_type <> new.transaction_type then
      raise exception 'Budget item must belong to the same month, user, and transaction type'
        using errcode = '23514';
    end if;
    if selected_archived_at is not null and (
      tg_op <> 'UPDATE' or new.budget_month_item_id is distinct from old.budget_month_item_id
    ) then
      raise exception 'New transaction assignments require an active budget item'
        using errcode = '23514';
    end if;
    new.budget_item_snapshot := selected_name;
  end if;

  if new.account_id is not null and not exists (
    select 1
      from public.financial_accounts account
      where account.id = new.account_id
        and account.user_id = new.user_id
        and account.currency_code = selected_currency
        and (
          account.archived_at is null or (
            tg_op = 'UPDATE' and new.account_id is not distinct from old.account_id
          )
        )
  ) then
    raise exception 'Account must be active, belong to the same user, and use the month currency'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_budget_transaction_editable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_month_start date;
  selected_user_id uuid;
begin
  select month.month_start, month.user_id
    into selected_month_start, selected_user_id
    from public.budget_months month
    where month.id = case when tg_op = 'DELETE' then old.budget_month_id else new.budget_month_id end;
  perform public.assert_budget_month_editable(selected_month_start, selected_user_id);

  if tg_op = 'UPDATE' and new.budget_month_id <> old.budget_month_id then
    select month.month_start, month.user_id
      into selected_month_start, selected_user_id
      from public.budget_months month
      where month.id = old.budget_month_id;
    perform public.assert_budget_month_editable(selected_month_start, selected_user_id);
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

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
  if auth.uid() is null or not exists (
    select 1 from auth.users where id = auth.uid()
  ) then
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

create trigger budget_transactions_enforce_editable
  before insert or update or delete on public.budget_transactions
  for each row execute function public.enforce_budget_transaction_editable();
create trigger budget_transactions_validate
  before insert or update on public.budget_transactions
  for each row execute function public.validate_budget_transaction();

alter table public.financial_accounts enable row level security;
alter table public.budget_transactions enable row level security;

create policy financial_accounts_select_own on public.financial_accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy financial_accounts_insert_own on public.financial_accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy financial_accounts_update_own on public.financial_accounts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy financial_accounts_delete_own on public.financial_accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy budget_transactions_select_own on public.budget_transactions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy budget_transactions_insert_own on public.budget_transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy budget_transactions_update_own on public.budget_transactions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budget_transactions_delete_own on public.budget_transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.financial_accounts from anon, authenticated;
revoke all on public.budget_transactions from anon, authenticated;
grant select on public.financial_accounts to authenticated;
grant select on public.budget_transactions to authenticated;

create or replace function public.create_financial_account(
  requested_name text,
  requested_account_type text,
  requested_currency_code text,
  requested_opening_balance_minor bigint
)
returns setof public.financial_accounts
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
  return query insert into public.financial_accounts (
    user_id, name, account_type, currency_code, opening_balance_minor
  ) values (
    current_user_id, btrim(requested_name), requested_account_type,
    upper(requested_currency_code), requested_opening_balance_minor
  ) returning *;
end;
$$;

create or replace function public.retrieve_financial_accounts(
  requested_include_archived boolean default false
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  account_type text,
  currency_code varchar(3),
  opening_balance_minor bigint,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  balance_minor bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    account.id,
    account.user_id,
    account.name,
    account.account_type,
    account.currency_code,
    account.opening_balance_minor,
    account.archived_at,
    account.created_at,
    account.updated_at,
    account.opening_balance_minor + coalesce(sum(
      case
        when entry.status <> 'posted' then 0
        when entry.transaction_type = 'income' then
          case when entry.is_refund then -entry.amount_minor else entry.amount_minor end
        else
          case when entry.is_refund then entry.amount_minor else -entry.amount_minor end
      end
    ), 0)::bigint as balance_minor
  from public.financial_accounts account
  left join public.budget_transactions entry
    on entry.account_id = account.id and entry.user_id = account.user_id
  where account.user_id = auth.uid()
    and (requested_include_archived or account.archived_at is null)
  group by account.id
  order by account.archived_at nulls first, account.created_at, account.id;
$$;

create or replace function public.retrieve_budget_month_summaries()
returns table (
  id uuid,
  user_id uuid,
  source_template_id uuid,
  month_start date,
  currency_code varchar(3),
  status text,
  notes text,
  last_opened_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  income numeric,
  expenses numeric,
  remaining numeric,
  actual_income numeric,
  actual_expenses numeric,
  actual_remaining numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    month.id,
    month.user_id,
    month.source_template_id,
    month.month_start,
    month.currency_code,
    month.status,
    month.notes,
    month.last_opened_at,
    month.created_at,
    month.updated_at,
    coalesce(plan.income, 0),
    coalesce(plan.expenses, 0),
    coalesce(plan.income, 0) - coalesce(plan.expenses, 0),
    coalesce(actual.income_minor, 0)::numeric / 100,
    coalesce(actual.expense_minor, 0)::numeric / 100,
    (coalesce(actual.income_minor, 0) - coalesce(actual.expense_minor, 0))::numeric / 100
  from public.budget_months month
  left join lateral (
    select
      coalesce(sum(item.amount) filter (where item.item_type = 'income'), 0) as income,
      coalesce(sum(item.amount) filter (where item.item_type = 'expense'), 0) as expenses
    from public.budget_month_items item
    where item.budget_month_id = month.id
      and item.user_id = month.user_id
      and item.archived_at is null
      and not item.is_disabled
  ) plan on true
  left join lateral (
    select
      coalesce(sum(
        case when entry.is_refund then -entry.amount_minor else entry.amount_minor end
      ) filter (where entry.transaction_type = 'income' and entry.status = 'posted'), 0) as income_minor,
      coalesce(sum(
        case when entry.is_refund then -entry.amount_minor else entry.amount_minor end
      ) filter (where entry.transaction_type = 'expense' and entry.status = 'posted'), 0) as expense_minor
    from public.budget_transactions entry
    where entry.budget_month_id = month.id and entry.user_id = month.user_id
  ) actual on true
  where month.user_id = auth.uid()
  order by month.month_start desc;
$$;

create or replace function public.update_financial_account(
  requested_account_id uuid,
  requested_name text,
  requested_account_type text,
  requested_currency_code text,
  requested_opening_balance_minor bigint,
  requested_archived boolean
)
returns setof public.financial_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_currency text;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select account.currency_code into selected_currency
    from public.financial_accounts account
    where account.id = requested_account_id and account.user_id = current_user_id
    for update;
  if selected_currency is null then
    raise exception 'Account not found' using errcode = '42501';
  end if;
  if selected_currency <> upper(requested_currency_code) and exists (
    select 1 from public.budget_transactions entry
    where entry.account_id = requested_account_id
      and entry.user_id = current_user_id
  ) then
    raise exception 'An account with transactions cannot change currency' using errcode = '55000';
  end if;
  return query update public.financial_accounts set
    name = btrim(requested_name),
    account_type = requested_account_type,
    currency_code = upper(requested_currency_code),
    opening_balance_minor = requested_opening_balance_minor,
    archived_at = case
      when requested_archived then coalesce(archived_at, now())
      else null
    end
  where id = requested_account_id and user_id = current_user_id
  returning *;
end;
$$;

create or replace function public.create_budget_transaction(
  requested_budget_month_id uuid,
  requested_transaction_date date,
  requested_description text,
  requested_amount_minor bigint,
  requested_transaction_type text,
  requested_is_refund boolean,
  requested_account_id uuid,
  requested_budget_month_item_id uuid,
  requested_category_id uuid,
  requested_notes text,
  requested_status text
)
returns setof public.budget_transactions
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
  if not exists (
    select 1 from public.budget_months month
    where month.id = requested_budget_month_id and month.user_id = current_user_id
  ) then
    raise exception 'Budget month not found' using errcode = '42501';
  end if;
  return query insert into public.budget_transactions (
    user_id, budget_month_id, transaction_date, description, amount_minor,
    transaction_type, is_refund, account_id, budget_month_item_id, category_id,
    notes, source, status
  ) values (
    current_user_id, requested_budget_month_id, requested_transaction_date,
    btrim(requested_description), requested_amount_minor, requested_transaction_type,
    requested_is_refund, requested_account_id, requested_budget_month_item_id,
    requested_category_id, nullif(btrim(requested_notes), ''), 'manual', requested_status
  ) returning *;
end;
$$;

create or replace function public.update_budget_transaction(
  requested_transaction_id uuid,
  requested_budget_month_id uuid,
  requested_transaction_date date,
  requested_description text,
  requested_amount_minor bigint,
  requested_transaction_type text,
  requested_is_refund boolean,
  requested_account_id uuid,
  requested_budget_month_item_id uuid,
  requested_category_id uuid,
  requested_notes text,
  requested_status text
)
returns setof public.budget_transactions
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
  if not exists (
    select 1 from public.budget_transactions entry
    where entry.id = requested_transaction_id and entry.user_id = current_user_id
  ) then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.budget_months month
    where month.id = requested_budget_month_id and month.user_id = current_user_id
  ) then
    raise exception 'Budget month not found' using errcode = '42501';
  end if;
  return query update public.budget_transactions set
    budget_month_id = requested_budget_month_id,
    transaction_date = requested_transaction_date,
    description = btrim(requested_description),
    amount_minor = requested_amount_minor,
    transaction_type = requested_transaction_type,
    is_refund = requested_is_refund,
    account_id = requested_account_id,
    budget_month_item_id = requested_budget_month_item_id,
    category_id = requested_category_id,
    notes = nullif(btrim(requested_notes), ''),
    status = requested_status
  where id = requested_transaction_id and user_id = current_user_id
  returning *;
end;
$$;

create or replace function public.delete_budget_transaction(requested_transaction_id uuid)
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
  delete from public.budget_transactions
    where id = requested_transaction_id and user_id = current_user_id;
  if not found then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.create_financial_account(text, text, text, bigint) from public, anon;
revoke all on function public.retrieve_financial_accounts(boolean) from public, anon;
revoke all on function public.retrieve_budget_month_summaries() from public, anon;
revoke all on function public.update_financial_account(uuid, text, text, text, bigint, boolean) from public, anon;
revoke all on function public.create_budget_transaction(uuid, date, text, bigint, text, boolean, uuid, uuid, uuid, text, text) from public, anon;
revoke all on function public.update_budget_transaction(uuid, uuid, date, text, bigint, text, boolean, uuid, uuid, uuid, text, text) from public, anon;
revoke all on function public.delete_budget_transaction(uuid) from public, anon;
grant execute on function public.create_financial_account(text, text, text, bigint) to authenticated;
grant execute on function public.retrieve_financial_accounts(boolean) to authenticated;
grant execute on function public.retrieve_budget_month_summaries() to authenticated;
grant execute on function public.update_financial_account(uuid, text, text, text, bigint, boolean) to authenticated;
grant execute on function public.create_budget_transaction(uuid, date, text, bigint, text, boolean, uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.update_budget_transaction(uuid, uuid, date, text, bigint, text, boolean, uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.delete_budget_transaction(uuid) to authenticated;

revoke all on function public.validate_budget_transaction() from public, anon, authenticated;
revoke all on function public.enforce_budget_transaction_editable() from public, anon, authenticated;
