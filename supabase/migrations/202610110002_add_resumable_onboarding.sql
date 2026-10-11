create table public.onboarding_activations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  setup_key uuid not null,
  path text not null check (path in ('starter','csv','transfer','blank')),
  budget_month_id uuid not null references public.budget_months(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (household_id),
  unique (created_by,setup_key)
);

alter table public.onboarding_activations enable row level security;
create policy onboarding_activations_select on public.onboarding_activations
for select to authenticated using (
  household_id=public.current_household_id()
  and public.has_household_role(household_id,array['owner','editor','viewer'])
);
revoke all on public.onboarding_activations from public,anon,authenticated;
grant select on public.onboarding_activations to authenticated;

create or replace function public.complete_first_budget_onboarding(
  requested_setup_key uuid,
  requested_path text,
  requested_display_name text,
  requested_currency_code text,
  requested_locale text,
  requested_timezone text,
  requested_template_name text,
  requested_template_items jsonb,
  requested_starter_id text default null,
  requested_starter_version integer default null,
  requested_starter_copy_key uuid default null,
  requested_import jsonb default null
)
returns setof public.budget_months
language plpgsql security definer set search_path='' as $$
declare
  current_user_id uuid:=auth.uid();
  household uuid:=public.current_household_id();
  owner_id uuid;
  existing_activation public.onboarding_activations%rowtype;
  selected_month public.budget_months%rowtype;
  imported record;
begin
  if current_user_id is null or household is null
    or not public.has_household_role(household,array['owner','editor']) then
    raise exception 'This household role cannot complete onboarding' using errcode='42501';
  end if;
  if requested_setup_key is null or requested_path not in ('starter','csv','transfer','blank')
    or jsonb_typeof(requested_template_items)<>'array'
    or jsonb_array_length(requested_template_items) not between 1 and 50 then
    raise exception 'Invalid onboarding request' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(household::text||':onboarding',0));
  select * into existing_activation from public.onboarding_activations
  where onboarding_activations.household_id=household;
  if found then
    return query select * from public.budget_months
      where id=existing_activation.budget_month_id and household_id=household;
    return;
  end if;
  select data_owner_user_id into owner_id from public.households where id=household;

  insert into public.categories(user_id,household_id,item_type,name,sort_order)
  select owner_id,household,item.item_type,btrim(item.category_name),
    coalesce((select max(category.sort_order)+1 from public.categories category
      where category.household_id=household and category.item_type=item.item_type),0)
      +row_number() over(partition by item.item_type order by item.ordinality)-1
  from jsonb_to_recordset(requested_template_items) with ordinality
    as item(name text,item_type text,category_name text,default_amount numeric,starter_item_key text,ordinality bigint)
  where item.item_type in ('income','expense') and char_length(btrim(item.category_name)) between 1 and 80
    and not exists(select 1 from public.categories category where category.household_id=household
      and category.item_type=item.item_type and lower(category.name)=lower(btrim(item.category_name))
      and category.archived_at is null)
  on conflict do nothing;

  if requested_starter_id is not null then
    select * into selected_month from public.setup_first_budget_from_starter(
      requested_display_name,requested_currency_code,requested_locale,requested_timezone,'system',
      requested_template_name,requested_template_items,requested_starter_id,
      requested_starter_version,requested_starter_copy_key
    );
  else
    select * into selected_month from public.setup_first_budget(
      requested_display_name,requested_currency_code,requested_locale,requested_timezone,'system',
      requested_template_name,requested_template_items
    );
  end if;
  if selected_month.id is null then
    raise exception 'The first budget month could not be created' using errcode='P0001';
  end if;

  if requested_import is not null then
    if requested_path<>'csv' or jsonb_typeof(requested_import)<>'object' then
      raise exception 'Invalid onboarding import' using errcode='22023';
    end if;
    select * into imported from public.import_budget_transactions(
      selected_month.id,null,requested_import->>'file_name',requested_import->>'batch_key',
      requested_import->'mapping_metadata',requested_import->'rows',
      coalesce((requested_import->>'invalid_count')::integer,0),
      coalesce((requested_import->>'excluded_count')::integer,0)
    );
    update public.budget_transactions transaction set
      category_id=category.id,
      budget_month_item_id=month_item.id
    from jsonb_to_recordset(requested_import->'rows') as input(
      external_fingerprint text,category_name text,transaction_type text
    )
    join public.categories category on category.household_id=household
      and category.item_type=input.transaction_type
      and lower(category.name)=lower(input.category_name) and category.archived_at is null
    left join public.budget_month_items month_item on month_item.budget_month_id=selected_month.id
      and month_item.household_id=household and month_item.category_id=category.id
      and month_item.item_type=input.transaction_type and month_item.archived_at is null
    where transaction.import_batch_id=imported.batch_id
      and transaction.external_fingerprint=input.external_fingerprint;
  end if;

  insert into public.onboarding_activations(household_id,created_by,setup_key,path,budget_month_id)
  values(household,current_user_id,requested_setup_key,requested_path,selected_month.id);
  return next selected_month;
end $$;

revoke all on function public.complete_first_budget_onboarding(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid,jsonb) from public,anon;
grant execute on function public.complete_first_budget_onboarding(uuid,text,text,text,text,text,text,jsonb,text,integer,uuid,jsonb) to authenticated;
