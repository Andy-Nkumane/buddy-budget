create table public.transaction_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_month_id uuid not null,
  account_id uuid,
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  batch_key varchar(64) not null check (batch_key ~ '^[0-9a-f]{64}$'),
  mapping_metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(mapping_metadata) = 'object'
    and octet_length(mapping_metadata::text) <= 4096
  ),
  total_count integer not null check (total_count between 0 and 2000),
  accepted_count integer not null check (accepted_count between 0 and 2000),
  duplicate_count integer not null check (duplicate_count between 0 and 2000),
  invalid_count integer not null check (invalid_count between 0 and 2000),
  excluded_count integer not null check (excluded_count between 0 and 2000),
  status text not null default 'completed' check (status in ('completed', 'undone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  undone_at timestamptz,
  constraint transaction_import_batches_counts_check check (
    total_count = accepted_count + duplicate_count + invalid_count + excluded_count
  ),
  constraint transaction_import_batches_status_timestamp_check check (
    (status = 'completed' and undone_at is null)
    or (status = 'undone' and undone_at is not null)
  ),
  constraint transaction_import_batches_owned_month_fk
    foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete cascade,
  constraint transaction_import_batches_owned_account_fk
    foreign key (account_id, user_id)
    references public.financial_accounts(id, user_id) on delete set null (account_id),
  unique (id, user_id)
);

create unique index transaction_import_batches_active_key
  on public.transaction_import_batches(user_id, batch_key)
  where status = 'completed';
create index transaction_import_batches_user_created_idx
  on public.transaction_import_batches(user_id, created_at desc, id);
create index transaction_import_batches_month_idx
  on public.transaction_import_batches(budget_month_id, created_at desc);

create trigger transaction_import_batches_set_updated_at
  before update on public.transaction_import_batches
  for each row execute function public.set_updated_at();

alter table public.budget_transactions
  drop constraint budget_transactions_source_check,
  add column external_reference text check (
    external_reference is null or char_length(external_reference) <= 255
  ),
  add column import_batch_id uuid,
  add constraint budget_transactions_source_check check (source in ('manual', 'csv_import')),
  add constraint budget_transactions_import_shape_check check (
    (source = 'manual' and import_batch_id is null)
    or (
      source = 'csv_import'
      and import_batch_id is not null
      and external_fingerprint ~ '^[0-9a-f]{64}$'
    )
  ),
  add constraint budget_transactions_owned_import_batch_fk
    foreign key (import_batch_id, user_id)
    references public.transaction_import_batches(id, user_id)
    on delete cascade;

create index budget_transactions_import_batch_idx
  on public.budget_transactions(import_batch_id)
  where import_batch_id is not null;

alter table public.transaction_import_batches enable row level security;

create policy transaction_import_batches_select_own
  on public.transaction_import_batches for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.transaction_import_batches from anon, authenticated;
grant select on public.transaction_import_batches to authenticated;

create or replace function public.import_budget_transactions(
  requested_budget_month_id uuid,
  requested_account_id uuid,
  requested_file_name text,
  requested_batch_key text,
  requested_mapping_metadata jsonb,
  requested_rows jsonb,
  requested_invalid_count integer,
  requested_excluded_count integer
)
returns table (
  batch_id uuid,
  accepted_count integer,
  duplicate_count integer,
  invalid_count integer,
  excluded_count integer,
  was_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_month_start date;
  selected_currency text;
  selected_batch public.transaction_import_batches%rowtype;
  supplied_row_count integer;
  inserted_row_count integer;
  selected_mapping_metadata jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_batch_key is null or requested_batch_key !~ '^[0-9a-f]{64}$' then
    raise exception 'The import batch key is invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || requested_batch_key, 0)
  );

  select batch.* into selected_batch
    from public.transaction_import_batches batch
    where batch.user_id = current_user_id
      and batch.batch_key = requested_batch_key
      and batch.status = 'completed';
  if found then
    return query select
      selected_batch.id,
      selected_batch.accepted_count,
      selected_batch.duplicate_count,
      selected_batch.invalid_count,
      selected_batch.excluded_count,
      true;
    return;
  end if;

  select month.month_start, month.currency_code
    into selected_month_start, selected_currency
    from public.budget_months month
    where month.id = requested_budget_month_id and month.user_id = current_user_id
    for update;
  if selected_month_start is null then
    raise exception 'Budget month not found' using errcode = '42501';
  end if;
  perform public.assert_budget_month_editable(selected_month_start, current_user_id);

  if requested_account_id is not null and not exists (
    select 1 from public.financial_accounts account
    where account.id = requested_account_id
      and account.user_id = current_user_id
      and account.currency_code = selected_currency
      and account.archived_at is null
  ) then
    raise exception 'Import account must be active, owned by the user, and use the month currency'
      using errcode = '23514';
  end if;
  if char_length(btrim(coalesce(requested_file_name, ''))) not between 1 and 255 then
    raise exception 'The CSV file name is invalid' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(requested_mapping_metadata), '') <> 'object'
    or coalesce(requested_mapping_metadata->>'delimiter', '') not in ('comma', 'semicolon', 'tab', 'pipe')
    or coalesce(requested_mapping_metadata->>'date_format', '') not in ('ymd', 'dmy', 'mdy')
    or coalesce(requested_mapping_metadata->>'decimal_format', '') not in ('auto', 'dot', 'comma')
    or coalesce(requested_mapping_metadata->>'amount_mode', '') not in ('signed', 'debit_credit') then
    raise exception 'The mapping metadata is invalid' using errcode = '22023';
  end if;
  selected_mapping_metadata := jsonb_strip_nulls(jsonb_build_object(
    'delimiter', requested_mapping_metadata->>'delimiter',
    'date_format', requested_mapping_metadata->>'date_format',
    'decimal_format', requested_mapping_metadata->>'decimal_format',
    'amount_mode', requested_mapping_metadata->>'amount_mode',
    'date_column', requested_mapping_metadata->'date_column',
    'description_column', requested_mapping_metadata->'description_column',
    'reference_column', requested_mapping_metadata->'reference_column',
    'amount_column', requested_mapping_metadata->'amount_column',
    'debit_column', requested_mapping_metadata->'debit_column',
    'credit_column', requested_mapping_metadata->'credit_column'
  ));
  if coalesce(jsonb_typeof(requested_rows), '') <> 'array' then
    raise exception 'Import rows must be an array' using errcode = '22023';
  end if;

  supplied_row_count := jsonb_array_length(requested_rows);
  if supplied_row_count < 1
    or supplied_row_count > 2000
    or coalesce(requested_invalid_count, -1) not between 0 and 2000
    or coalesce(requested_excluded_count, -1) not between 0 and 2000
    or supplied_row_count + requested_invalid_count + requested_excluded_count > 2000 then
    raise exception 'An import batch must contain between 1 and 2000 total rows'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(requested_rows) as row_value(
      transaction_date date,
      description text,
      amount_minor bigint,
      transaction_type text,
      external_reference text,
      external_fingerprint text
    )
    where row_value.transaction_date is null
      or date_trunc('month', row_value.transaction_date)::date <> selected_month_start
      or char_length(btrim(coalesce(row_value.description, ''))) not between 1 and 160
      or coalesce(row_value.amount_minor, 0) not between 1 and 99999999999999
      or coalesce(row_value.transaction_type, '') not in ('income', 'expense')
      or coalesce(row_value.external_fingerprint, '') !~ '^[0-9a-f]{64}$'
      or char_length(coalesce(row_value.external_reference, '')) > 255
  ) then
    raise exception 'One or more normalized import rows are invalid for the destination month'
      using errcode = '22023';
  end if;

  insert into public.transaction_import_batches (
    user_id,
    budget_month_id,
    account_id,
    file_name,
    batch_key,
    mapping_metadata,
    total_count,
    accepted_count,
    duplicate_count,
    invalid_count,
    excluded_count
  ) values (
    current_user_id,
    requested_budget_month_id,
    requested_account_id,
    btrim(requested_file_name),
    requested_batch_key,
    selected_mapping_metadata,
    supplied_row_count + requested_invalid_count + requested_excluded_count,
    0,
    supplied_row_count,
    requested_invalid_count,
    requested_excluded_count
  ) returning * into selected_batch;

  insert into public.budget_transactions (
    user_id,
    budget_month_id,
    account_id,
    transaction_date,
    description,
    amount_minor,
    transaction_type,
    external_reference,
    external_fingerprint,
    import_batch_id,
    source,
    status
  )
  select
    current_user_id,
    requested_budget_month_id,
    requested_account_id,
    row_value.transaction_date,
    btrim(row_value.description),
    row_value.amount_minor,
    row_value.transaction_type,
    nullif(btrim(row_value.external_reference), ''),
    row_value.external_fingerprint,
    selected_batch.id,
    'csv_import',
    'posted'
  from jsonb_to_recordset(requested_rows) as row_value(
    transaction_date date,
    description text,
    amount_minor bigint,
    transaction_type text,
    external_reference text,
    external_fingerprint text
  )
  on conflict (user_id, source, external_fingerprint)
    where external_fingerprint is not null
    do nothing;

  get diagnostics inserted_row_count = row_count;
  update public.transaction_import_batches set
    accepted_count = inserted_row_count,
    duplicate_count = supplied_row_count - inserted_row_count
  where id = selected_batch.id
  returning * into selected_batch;

  return query select
    selected_batch.id,
    selected_batch.accepted_count,
    selected_batch.duplicate_count,
    selected_batch.invalid_count,
    selected_batch.excluded_count,
    false;
end;
$$;

create or replace function public.undo_transaction_import_batch(requested_batch_id uuid)
returns setof public.transaction_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_batch public.transaction_import_batches%rowtype;
  affected_month record;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select batch.* into selected_batch
    from public.transaction_import_batches batch
    where batch.id = requested_batch_id and batch.user_id = current_user_id
    for update;
  if not found then
    raise exception 'Import batch not found' using errcode = '42501';
  end if;
  if selected_batch.status = 'undone' then
    return next selected_batch;
    return;
  end if;

  for affected_month in
    select distinct month.month_start, month.user_id
    from public.budget_months month
    where month.id = selected_batch.budget_month_id
      and month.user_id = current_user_id
    union
    select distinct month.month_start, month.user_id
    from public.budget_transactions entry
    join public.budget_months month
      on month.id = entry.budget_month_id and month.user_id = entry.user_id
    where entry.import_batch_id = selected_batch.id
      and entry.user_id = current_user_id
  loop
    perform public.assert_budget_month_editable(
      affected_month.month_start,
      affected_month.user_id
    );
  end loop;

  delete from public.budget_transactions entry
    where entry.import_batch_id = selected_batch.id
      and entry.user_id = current_user_id;
  update public.transaction_import_batches set
    status = 'undone',
    undone_at = now()
  where id = selected_batch.id
  returning * into selected_batch;
  return next selected_batch;
end;
$$;

revoke all on function public.import_budget_transactions(
  uuid, uuid, text, text, jsonb, jsonb, integer, integer
) from public, anon;
revoke all on function public.undo_transaction_import_batch(uuid) from public, anon;
grant execute on function public.import_budget_transactions(
  uuid, uuid, text, text, jsonb, jsonb, integer, integer
) to authenticated;
grant execute on function public.undo_transaction_import_batch(uuid) to authenticated;
