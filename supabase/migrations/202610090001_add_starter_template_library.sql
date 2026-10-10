create table public.starter_budget_templates (
  id text not null check (id ~ '^[a-z0-9-]{2,40}$'),
  version integer not null check (version > 0),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  audience text not null check (char_length(btrim(audience)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 300),
  template_name text not null check (char_length(btrim(template_name)) between 1 and 80),
  sort_order integer not null check (sort_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (id, version)
);

create table public.starter_budget_template_items (
  starter_template_id text not null,
  starter_template_version integer not null,
  item_key text not null check (item_key ~ '^[a-z0-9-]{2,50}$'),
  item_type text not null check (item_type in ('income','expense')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category_name text not null check (char_length(btrim(category_name)) between 1 and 60),
  default_amount numeric(14,2) not null default 0 check (default_amount between 0 and 999999999999.99),
  sort_order integer not null check (sort_order >= 0),
  primary key (starter_template_id,starter_template_version,item_key),
  foreign key (starter_template_id,starter_template_version)
    references public.starter_budget_templates(id,version) on delete restrict,
  unique (starter_template_id,starter_template_version,item_type,sort_order)
);

alter table public.starter_budget_templates enable row level security;
alter table public.starter_budget_template_items enable row level security;
create policy starter_templates_read on public.starter_budget_templates for select to authenticated
using (is_active);
create policy starter_template_items_read on public.starter_budget_template_items for select to authenticated
using (exists(select 1 from public.starter_budget_templates template
  where template.id=starter_template_id and template.version=starter_template_version and template.is_active));
revoke all on public.starter_budget_templates,public.starter_budget_template_items from anon;
grant select on public.starter_budget_templates,public.starter_budget_template_items to authenticated;

insert into public.starter_budget_templates(id,version,name,audience,description,template_name,sort_order) values
('student',1,'Student','For study periods and early independence','A simple structure for regular support or work income and common study-related costs.','Student budget',0),
('first-salary',1,'First salary','For a first regular pay cycle','A clear starting point for income and essential monthly commitments without prescribing how much to spend.','First salary budget',1),
('household',1,'Household or couple','For people planning shared monthly costs','A shared view of household income and recurring essentials that can be adapted together.','Household budget',2),
('freelancer',1,'Freelancer','For variable client income','Separates client income from recurring operating and personal essentials without estimating future earnings.','Freelancer budget',3),
('minimal-essentials',1,'Minimal essentials','For a small, focused starting plan','Only the core income and expense headings for people who want to add detail later.','Essential budget',4);

insert into public.starter_budget_template_items(starter_template_id,starter_template_version,item_key,item_type,name,category_name,sort_order) values
('student',1,'income','income','Income or support','Earnings',0),
('student',1,'housing','expense','Housing','Housing',0),
('student',1,'food','expense','Food and groceries','Groceries',1),
('student',1,'transport','expense','Transport','Transport',2),
('student',1,'education','expense','Study costs','Education',3),
('student',1,'connectivity','expense','Phone and internet','Connectivity',4),
('first-salary',1,'salary','income','Salary','Earnings',0),
('first-salary',1,'housing','expense','Housing','Housing',0),
('first-salary',1,'utilities','expense','Utilities','Utilities',1),
('first-salary',1,'groceries','expense','Groceries','Groceries',2),
('first-salary',1,'transport','expense','Transport','Transport',3),
('first-salary',1,'healthcare','expense','Healthcare','Healthcare',4),
('household',1,'income-one','income','Primary household income','Earnings',0),
('household',1,'income-two','income','Additional household income','Earnings',1),
('household',1,'housing','expense','Housing','Housing',0),
('household',1,'utilities','expense','Utilities','Utilities',1),
('household',1,'groceries','expense','Groceries','Groceries',2),
('household',1,'transport','expense','Transport','Transport',3),
('household',1,'care','expense','Care and support','Care',4),
('freelancer',1,'client-income','income','Client income','Client income',0),
('freelancer',1,'other-income','income','Other income','Earnings',1),
('freelancer',1,'tax','expense','Tax provision','Taxes',0),
('freelancer',1,'software','expense','Software and services','Business tools',1),
('freelancer',1,'connectivity','expense','Phone and internet','Connectivity',2),
('freelancer',1,'workspace','expense','Workspace','Workspace',3),
('freelancer',1,'transport','expense','Transport','Transport',4),
('minimal-essentials',1,'income','income','Income','Earnings',0),
('minimal-essentials',1,'housing','expense','Housing','Housing',0),
('minimal-essentials',1,'utilities','expense','Utilities','Utilities',1),
('minimal-essentials',1,'food','expense','Food','Groceries',2),
('minimal-essentials',1,'transport','expense','Transport','Transport',3),
('minimal-essentials',1,'healthcare','expense','Healthcare','Healthcare',4);

alter table public.budget_templates
  add column starter_template_id text,
  add column starter_template_version integer,
  add column starter_copy_key uuid,
  add constraint budget_templates_starter_source_complete check (
    (starter_template_id is null and starter_template_version is null and starter_copy_key is null)
    or (starter_template_id is not null and starter_template_version is not null and starter_copy_key is not null)
  ),
  add constraint budget_templates_starter_source_fk foreign key (starter_template_id,starter_template_version)
    references public.starter_budget_templates(id,version) on delete restrict;
create unique index budget_templates_starter_copy_idempotency
on public.budget_templates(household_id,starter_copy_key) where starter_copy_key is not null;

create or replace function public.copy_starter_budget_template(
  requested_starter_id text,
  requested_starter_version integer,
  requested_template_name text,
  requested_items jsonb,
  requested_copy_key uuid,
  requested_make_default boolean default false
)
returns setof public.budget_templates
language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); owner_id uuid; selected_template public.budget_templates%rowtype;
  requested_count integer; valid_count integer;
begin
  if auth.uid() is null or household is null or not public.has_household_role(household,array['owner','editor']) then
    raise exception 'This household role cannot copy starter templates' using errcode='42501';
  end if;
  if requested_copy_key is null or char_length(btrim(requested_template_name)) not between 1 and 80
    or jsonb_typeof(requested_items)<>'array' or jsonb_array_length(requested_items) not between 1 and 50 then
    raise exception 'Invalid starter template request' using errcode='22023';
  end if;
  if not exists(select 1 from public.starter_budget_templates template
    where template.id=requested_starter_id and template.version=requested_starter_version and template.is_active) then
    raise exception 'Starter template version is unavailable' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(household::text||':starter-template-copy',0));
  requested_make_default:=coalesce(requested_make_default,false);
  select * into selected_template from public.budget_templates
    where household_id=household and starter_copy_key=requested_copy_key;
  if found then return next selected_template; return; end if;

  requested_count:=jsonb_array_length(requested_items);
  select count(*) into valid_count
  from jsonb_array_elements(requested_items) input
  join public.starter_budget_template_items item
    on item.starter_template_id=requested_starter_id and item.starter_template_version=requested_starter_version
    and item.item_key=input->>'item_key'
  where jsonb_typeof(input->'amount') in ('string','number')
    and (input->>'amount') ~ '^\d{1,12}(\.\d{1,2})?$'
    and (input->>'amount')::numeric between 0 and 999999999999.99;
  if valid_count<>requested_count or valid_count<>(select count(distinct input->>'item_key') from jsonb_array_elements(requested_items) input) then
    raise exception 'Every included item must be valid and unique' using errcode='22023';
  end if;

  select data_owner_user_id into owner_id from public.households where id=household;
  insert into public.categories(user_id,household_id,item_type,name,sort_order)
  select owner_id,household,missing.item_type,missing.category_name,
    coalesce((select max(category.sort_order)+1 from public.categories category
      where category.household_id=household and category.item_type=missing.item_type),0)
      +row_number() over(partition by missing.item_type order by missing.first_order,missing.category_name)-1
  from (
    select item.item_type,item.category_name,min(item.sort_order) first_order
    from jsonb_array_elements(requested_items) input
    join public.starter_budget_template_items item on item.starter_template_id=requested_starter_id
      and item.starter_template_version=requested_starter_version and item.item_key=input->>'item_key'
    group by item.item_type,item.category_name
  ) missing
  where not exists(select 1 from public.categories category where category.household_id=household
    and category.item_type=missing.item_type and lower(category.name)=lower(missing.category_name) and category.archived_at is null);

  if requested_make_default or not exists(select 1 from public.budget_templates where household_id=household and archived_at is null) then
    update public.budget_templates set is_default=false where household_id=household and is_default and archived_at is null;
    requested_make_default:=true;
  end if;
  insert into public.budget_templates(user_id,household_id,name,is_default,starter_template_id,starter_template_version,starter_copy_key)
  values(owner_id,household,btrim(requested_template_name),requested_make_default,requested_starter_id,requested_starter_version,requested_copy_key)
  returning * into selected_template;

  insert into public.template_items(template_id,user_id,household_id,category_id,item_type,name,default_amount,sort_order)
  select selected_template.id,owner_id,household,category.id,item.item_type,item.name,(input->>'amount')::numeric,item.sort_order
  from jsonb_array_elements(requested_items) input
  join public.starter_budget_template_items item on item.starter_template_id=requested_starter_id
    and item.starter_template_version=requested_starter_version and item.item_key=input->>'item_key'
  join public.categories category on category.household_id=household and category.item_type=item.item_type
    and lower(category.name)=lower(item.category_name) and category.archived_at is null;
  if not found then raise exception 'Starter items could not be copied' using errcode='23514'; end if;
  return next selected_template;
end $$;

revoke all on function public.copy_starter_budget_template(text,integer,text,jsonb,uuid,boolean) from public,anon;
grant execute on function public.copy_starter_budget_template(text,integer,text,jsonb,uuid,boolean) to authenticated;

create or replace function public.setup_first_budget_from_starter(
  requested_display_name text,
  requested_currency_code text,
  requested_locale text,
  requested_timezone text,
  requested_theme text,
  requested_template_name text,
  requested_template_items jsonb,
  requested_starter_id text,
  requested_starter_version integer,
  requested_copy_key uuid
)
returns setof public.budget_months
language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); owner_id uuid; selected_month public.budget_months%rowtype;
  requested_count integer; valid_count integer;
begin
  if auth.uid() is null or household is null or not public.has_household_role(household,array['owner','editor']) then
    raise exception 'This household role cannot complete onboarding' using errcode='42501';
  end if;
  if requested_copy_key is null or jsonb_typeof(requested_template_items)<>'array'
    or jsonb_array_length(requested_template_items) not between 1 and 50 then
    raise exception 'Invalid starter onboarding request' using errcode='22023';
  end if;
  if not exists(select 1 from public.starter_budget_templates template where template.id=requested_starter_id
    and template.version=requested_starter_version and template.is_active) then
    raise exception 'Starter template version is unavailable' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(household::text||':starter-template-copy',0));
  requested_count:=jsonb_array_length(requested_template_items);
  select count(*) into valid_count
  from jsonb_array_elements(requested_template_items) input
  join public.starter_budget_template_items item on item.starter_template_id=requested_starter_id
    and item.starter_template_version=requested_starter_version and item.item_key=input->>'starter_item_key'
    and item.item_type=input->>'item_type' and item.name=btrim(input->>'name')
    and item.category_name=btrim(input->>'category_name');
  if valid_count<>requested_count
    or valid_count<>(select count(distinct input->>'starter_item_key') from jsonb_array_elements(requested_template_items) input) then
    raise exception 'Starter items do not match the selected version' using errcode='22023';
  end if;
  select data_owner_user_id into owner_id from public.households where id=household;
  insert into public.categories(user_id,household_id,item_type,name,sort_order)
  select owner_id,household,missing.item_type,missing.category_name,
    coalesce((select max(category.sort_order)+1 from public.categories category
      where category.household_id=household and category.item_type=missing.item_type),0)
      +row_number() over(partition by missing.item_type order by missing.first_order,missing.category_name)-1
  from (
    select item.item_type,item.category_name,min(item.sort_order) first_order
    from jsonb_array_elements(requested_template_items) input
    join public.starter_budget_template_items item on item.starter_template_id=requested_starter_id
      and item.starter_template_version=requested_starter_version and item.item_key=input->>'starter_item_key'
    group by item.item_type,item.category_name
  ) missing
  where not exists(select 1 from public.categories category where category.household_id=household
    and category.item_type=missing.item_type and lower(category.name)=lower(missing.category_name) and category.archived_at is null);

  select * into selected_month from public.setup_first_budget(requested_display_name,requested_currency_code,
    requested_locale,requested_timezone,requested_theme,requested_template_name,requested_template_items);
  update public.budget_templates set starter_template_id=requested_starter_id,
    starter_template_version=requested_starter_version,starter_copy_key=requested_copy_key
  where id=selected_month.source_template_id and household_id=household
    and starter_template_id is null and starter_template_version is null and starter_copy_key is null;
  if not found and not exists(select 1 from public.budget_templates where id=selected_month.source_template_id
    and household_id=household and starter_template_id=requested_starter_id
    and starter_template_version=requested_starter_version and starter_copy_key=requested_copy_key) then
    raise exception 'An existing template cannot be overwritten by a starter' using errcode='23505';
  end if;
  return next selected_month;
end $$;

revoke all on function public.setup_first_budget_from_starter(text,text,text,text,text,text,jsonb,text,integer,uuid) from public,anon;
grant execute on function public.setup_first_budget_from_starter(text,text,text,text,text,text,jsonb,text,integer,uuid) to authenticated;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_backup_recovery_payload_household_internal(uuid)'::regprocedure) into definition;
  if position('''schema_version'',10' in definition)=0 then
    raise exception 'Backup payload schema marker was not found';
  end if;
  execute replace(definition,'''schema_version'',10','''schema_version'',11');

  select pg_get_functiondef('public.restore_backup_household_internal(jsonb,text,text,text)'::regprocedure) into definition;
  if position('<>10' in definition)=0 then
    raise exception 'Restore schema validator was not found';
  end if;
  definition:=replace(definition,'<>10','<>11');
  definition:=replace(definition,'values(current_user_id,requested_fingerprint,10,','values(current_user_id,requested_fingerprint,11,');
  definition:=replace(definition,'values(current_user_id,restore_run.id,10,','values(current_user_id,restore_run.id,11,');
  execute definition;
end $$;
