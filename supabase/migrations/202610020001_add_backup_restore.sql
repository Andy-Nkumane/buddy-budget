create table public.backup_restore_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  backup_fingerprint text not null check (backup_fingerprint ~ '^[0-9a-f]{64}$'),
  schema_version integer not null,
  mode text not null check (mode in ('merge', 'replace')),
  status text not null check (status in ('processing', 'completed')),
  report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, backup_fingerprint, mode)
);

create table public.backup_restore_source_ids (
  restore_id uuid not null references public.backup_restore_runs(id) on delete cascade,
  entity_type text not null,
  source_id text not null,
  target_id uuid not null,
  matched_existing boolean not null default false,
  primary key (restore_id, entity_type, source_id),
  unique (restore_id, entity_type, target_id)
);

create table public.backup_recovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restore_id uuid not null unique references public.backup_restore_runs(id) on delete restrict,
  schema_version integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table public.backup_restore_execution (
  transaction_id bigint primary key,
  user_id uuid not null
);

alter table public.backup_restore_runs enable row level security;
alter table public.backup_recovery_snapshots enable row level security;
alter table public.backup_restore_source_ids enable row level security;
alter table public.backup_restore_execution enable row level security;

create policy backup_restore_runs_select_own on public.backup_restore_runs
for select to authenticated using (user_id = auth.uid());
create policy backup_recovery_snapshots_select_own on public.backup_recovery_snapshots
for select to authenticated using (user_id = auth.uid());

revoke all on public.backup_restore_runs, public.backup_restore_source_ids,
  public.backup_recovery_snapshots, public.backup_restore_execution from anon, authenticated;
grant select on public.backup_restore_runs, public.backup_recovery_snapshots to authenticated;

create or replace function public.restore_mapped_id(requested_restore_id uuid, requested_entity text, requested_source_id text)
returns uuid language sql stable security definer set search_path = '' as $$
  select mapping.target_id from public.backup_restore_source_ids mapping
  join public.backup_restore_runs run on run.id = mapping.restore_id
  where mapping.restore_id = requested_restore_id and mapping.entity_type = requested_entity
    and mapping.source_id = requested_source_id and run.user_id = auth.uid()
$$;
revoke all on function public.restore_mapped_id(uuid,text,text) from public, anon, authenticated;

create or replace function public.register_restore_id(
  requested_restore_id uuid, requested_entity text, requested_source_id text,
  requested_target_id uuid, requested_matched boolean
) returns void language sql security definer set search_path = '' as $$
  insert into public.backup_restore_source_ids(restore_id,entity_type,source_id,target_id,matched_existing)
  select requested_restore_id,requested_entity,requested_source_id,requested_target_id,requested_matched
  from public.backup_restore_runs run where run.id=requested_restore_id and run.user_id=auth.uid()
  on conflict (restore_id,entity_type,source_id) do nothing
$$;
revoke all on function public.register_restore_id(uuid,text,text,uuid,boolean) from public, anon, authenticated;

create or replace function public.create_backup_recovery_payload(requested_user_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
select jsonb_build_object(
  'schema_version',10,'created_at',now(),
  'profile',(select to_jsonb(row)-'user_id' from public.profiles row where user_id=requested_user_id),
  'preferences',(select to_jsonb(row)-'user_id' from public.user_preferences row where user_id=requested_user_id),
  'weekly_checkin_preferences',(select to_jsonb(row)-'user_id' from public.weekly_checkin_preferences row where user_id=requested_user_id),
  'categories',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.categories row where user_id=requested_user_id),'[]'::jsonb),
  'financial_accounts',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.financial_accounts row where user_id=requested_user_id),'[]'::jsonb),
  'templates',coalesce((select jsonb_agg((to_jsonb(template)-'user_id') || jsonb_build_object('template_items',
    coalesce((select jsonb_agg(to_jsonb(item)-'user_id') from public.template_items item where item.template_id=template.id and item.user_id=requested_user_id),'[]'::jsonb)))
    from public.budget_templates template where user_id=requested_user_id),'[]'::jsonb),
  'budget_months',coalesce((select jsonb_agg((to_jsonb(month)-'user_id') || jsonb_build_object(
    'budget_month_items',coalesce((select jsonb_agg(to_jsonb(item)-'user_id') from public.budget_month_items item where item.budget_month_id=month.id and item.user_id=requested_user_id),'[]'::jsonb),
    'budget_transactions',coalesce((select jsonb_agg(to_jsonb(entry)-'user_id') from public.budget_transactions entry where entry.budget_month_id=month.id and entry.user_id=requested_user_id),'[]'::jsonb)))
    from public.budget_months month where user_id=requested_user_id),'[]'::jsonb),
  'transaction_import_batches',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.transaction_import_batches row where user_id=requested_user_id),'[]'::jsonb),
  'transaction_categorisation_rules',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.transaction_categorisation_rules row where user_id=requested_user_id),'[]'::jsonb),
  'categorisation_suggestion_dismissals',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.categorisation_suggestion_dismissals row where user_id=requested_user_id),'[]'::jsonb),
  'payment_schedules',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.payment_schedules row where user_id=requested_user_id),'[]'::jsonb),
  'payment_schedule_occurrences',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.payment_schedule_occurrences row where user_id=requested_user_id),'[]'::jsonb),
  'financial_goals',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.financial_goals row where user_id=requested_user_id),'[]'::jsonb),
  'goal_contributions',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.goal_contributions row where user_id=requested_user_id),'[]'::jsonb),
  'goal_month_recommendations',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.goal_month_recommendations row where user_id=requested_user_id),'[]'::jsonb),
  'budget_month_lifecycle',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.budget_month_lifecycle row where user_id=requested_user_id),'[]'::jsonb),
  'month_close_summaries',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.month_close_summaries row where user_id=requested_user_id),'[]'::jsonb),
  'month_adjustments',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.month_adjustments row where user_id=requested_user_id),'[]'::jsonb),
  'month_lifecycle_events',coalesce((select jsonb_agg(to_jsonb(row)-'user_id') from public.month_lifecycle_events row where user_id=requested_user_id),'[]'::jsonb)
)
$$;
revoke all on function public.create_backup_recovery_payload(uuid) from public, anon, authenticated;

create or replace function public.prevent_append_only_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.backup_restore_execution execution
    where execution.transaction_id=txid_current() and execution.user_id=old.user_id) then return old; end if;
  if not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
  raise exception 'Month history is append-only' using errcode = '55000';
end;
$$;

create or replace function public.assert_budget_month_editable(requested_month_start date, requested_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare selected_timezone text; editable_from date; selected_state text;
begin
  if exists(select 1 from public.backup_restore_execution execution
    where execution.transaction_id=txid_current() and execution.user_id=requested_user_id) then return; end if;
  if auth.uid() is null then return; end if;
  if not exists (select 1 from auth.users where id = requested_user_id) then return; end if;
  perform month.id from public.budget_months month where month.user_id=requested_user_id
    and month.month_start=requested_month_start for share;
  select coalesce(nullif(profile.timezone,''),'UTC') into selected_timezone
    from public.profiles profile where profile.user_id=requested_user_id;
  selected_timezone:=coalesce(selected_timezone,'UTC');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=selected_timezone) then selected_timezone:='UTC'; end if;
  editable_from:=(date_trunc('month',now() at time zone selected_timezone)-interval '1 month')::date;
  if requested_month_start<editable_from then raise exception 'Months that are two or more calendar months old are read-only' using errcode='55000'; end if;
  select lifecycle.state into selected_state from public.budget_month_lifecycle lifecycle
  join public.budget_months month on month.id=lifecycle.budget_month_id and month.user_id=lifecycle.user_id
  where month.user_id=requested_user_id and month.month_start=requested_month_start;
  if selected_state='closed' then raise exception 'Closed months are read-only until reopened' using errcode='55000'; end if;
end;
$$;

create or replace function public.restore_backup(
  requested_payload jsonb, requested_mode text, requested_fingerprint text, requested_confirmation text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid:=auth.uid(); restore_run public.backup_restore_runs%rowtype;
  recovery_id uuid; record jsonb; parent jsonb; target uuid; existing uuid; inserted_count integer:=0;
  inserted jsonb:='{}'::jsonb; matched jsonb:='{}'::jsonb; skipped jsonb:='{}'::jsonb;
  entity text; source text; parent_matched boolean; completed_report jsonb; recent_iat bigint; total_count integer:=0;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if requested_mode not in ('merge','replace') then raise exception 'Invalid restore mode'; end if;
  if requested_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid backup fingerprint'; end if;
  if jsonb_typeof(requested_payload)<>'object' or (requested_payload->>'schema_version')::integer<>10 then raise exception 'Unsupported backup schema'; end if;
  if pg_column_size(requested_payload)>10485760 then raise exception 'Backup exceeds the 10 MB limit'; end if;
  if requested_payload ?| array['notification_deliveries','auth','users','secrets']
    or jsonb_path_exists(requested_payload,'$.**.user_id')
    or jsonb_path_exists(requested_payload,'$.**.password')
    or jsonb_path_exists(requested_payload,'$.**.access_token')
    or jsonb_path_exists(requested_payload,'$.**.refresh_token')
    or jsonb_path_exists(requested_payload,'$.**.service_role_key') then
    raise exception 'Backup contains forbidden ownership, authentication, secret, or operational fields';
  end if;
  foreach entity in array array['categories','financial_accounts','transaction_import_batches',
    'transaction_categorisation_rules','categorisation_suggestion_dismissals','payment_schedules',
    'payment_schedule_occurrences','financial_goals','goal_contributions','goal_month_recommendations',
    'budget_month_lifecycle','month_close_summaries','month_adjustments','month_lifecycle_events','templates','budget_months'] loop
    if jsonb_typeof(requested_payload->entity)<>'array' then raise exception 'Backup collection % must be an array',entity; end if;
    total_count:=total_count+jsonb_array_length(requested_payload->entity);
  end loop;
  select total_count+coalesce(sum(jsonb_array_length(value->'template_items')),0)::integer into total_count
    from jsonb_array_elements(requested_payload->'templates');
  select total_count+coalesce(sum(jsonb_array_length(value->'budget_month_items')+jsonb_array_length(value->'budget_transactions')),0)::integer into total_count
    from jsonb_array_elements(requested_payload->'budget_months');
  if total_count>10000 then raise exception 'Backup exceeds the 10,000-record restore limit'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    current_user_id::text||':'||requested_fingerprint||':'||requested_mode,0));
  select * into restore_run from public.backup_restore_runs
    where user_id=current_user_id and backup_fingerprint=requested_fingerprint and mode=requested_mode;
  if found then
    if restore_run.status='completed' then return restore_run.report; end if;
    raise exception 'This restore is already processing' using errcode='55000';
  end if;
  if requested_mode='replace' then
    if requested_confirmation<>'REPLACE MY DATA' then raise exception 'Typed confirmation is required' using errcode='42501'; end if;
    select coalesce(max((method->>'timestamp')::bigint),0) into recent_iat
      from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method
      where method->>'method'='password';
    if recent_iat<extract(epoch from now()-interval '10 minutes')::bigint then
      raise exception 'Re-enter your password before replacing all data' using errcode='42501';
    end if;
  end if;
  insert into public.backup_restore_runs(user_id,backup_fingerprint,schema_version,mode,status)
    values(current_user_id,requested_fingerprint,10,requested_mode,'processing') returning * into restore_run;
  insert into public.backup_restore_execution values(txid_current(),current_user_id);
  if requested_mode='replace' then
    insert into public.backup_recovery_snapshots(user_id,restore_id,schema_version,payload)
      values(current_user_id,restore_run.id,10,public.create_backup_recovery_payload(current_user_id)) returning id into recovery_id;
    delete from public.month_lifecycle_events where user_id=current_user_id;
    delete from public.month_close_summaries where user_id=current_user_id;
    delete from public.month_adjustments where user_id=current_user_id;
    delete from public.goal_contributions where user_id=current_user_id;
    delete from public.goal_month_recommendations where user_id=current_user_id;
    delete from public.payment_schedule_occurrences where user_id=current_user_id;
    delete from public.budget_transactions where user_id=current_user_id;
    delete from public.transaction_import_batches where user_id=current_user_id;
    delete from public.budget_month_lifecycle where user_id=current_user_id;
    delete from public.budget_month_items where user_id=current_user_id;
    delete from public.budget_months where user_id=current_user_id;
    delete from public.payment_schedules where user_id=current_user_id;
    delete from public.financial_goals where user_id=current_user_id;
    delete from public.transaction_categorisation_rules where user_id=current_user_id;
    delete from public.categorisation_suggestion_dismissals where user_id=current_user_id;
    delete from public.template_items where user_id=current_user_id;
    delete from public.budget_templates where user_id=current_user_id;
    delete from public.financial_accounts where user_id=current_user_id;
    delete from public.categories where user_id=current_user_id;
    delete from public.weekly_checkin_preferences where user_id=current_user_id;
  end if;

  update public.profiles set display_name=nullif(requested_payload#>>'{profile,display_name}',''),
    currency_code=coalesce(requested_payload#>>'{profile,currency_code}',currency_code),
    locale=coalesce(requested_payload#>>'{profile,locale}',locale),
    timezone=coalesce(requested_payload#>>'{profile,timezone}',timezone) where user_id=current_user_id;
  update public.user_preferences set theme=coalesce(requested_payload#>>'{preferences,theme}',theme),
    onboarding_completed_at=coalesce((requested_payload#>>'{preferences,onboarding_completed_at}')::timestamptz,onboarding_completed_at)
    where user_id=current_user_id;

  for record in select value from jsonb_array_elements(requested_payload->'categories') loop
    source:=record->>'id'; existing:=null;
    if requested_mode='merge' then select id into existing from public.categories where user_id=current_user_id
      and item_type=record->>'item_type' and lower(name)=lower(record->>'name') limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'categories',source,target,existing is not null);
    if existing is null then
      insert into public.categories select (jsonb_populate_record(null::public.categories,record||jsonb_build_object('id',target,'user_id',current_user_id))).*;
      inserted:=jsonb_set(inserted,array['categories'],to_jsonb(coalesce((inserted->>'categories')::int,0)+1));
    else matched:=jsonb_set(matched,array['categories'],to_jsonb(coalesce((matched->>'categories')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'financial_accounts') loop
    source:=record->>'id'; existing:=null;
    if requested_mode='merge' then select id into existing from public.financial_accounts where user_id=current_user_id
      and lower(name)=lower(record->>'name') and currency_code=record->>'currency_code' limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'accounts',source,target,existing is not null);
    if existing is null then insert into public.financial_accounts select (jsonb_populate_record(null::public.financial_accounts,record||jsonb_build_object('id',target,'user_id',current_user_id))).*;
      inserted:=jsonb_set(inserted,array['financial_accounts'],to_jsonb(coalesce((inserted->>'financial_accounts')::int,0)+1));
    else matched:=jsonb_set(matched,array['financial_accounts'],to_jsonb(coalesce((matched->>'financial_accounts')::int,0)+1)); end if;
  end loop;

  for parent in select value from jsonb_array_elements(requested_payload->'templates') loop
    source:=parent->>'id'; existing:=null;
    if requested_mode='merge' then select id into existing from public.budget_templates where user_id=current_user_id and lower(name)=lower(parent->>'name') limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'templates',source,target,existing is not null);
    if existing is null then insert into public.budget_templates select (jsonb_populate_record(null::public.budget_templates,(parent-'template_items')||jsonb_build_object('id',target,'user_id',current_user_id))).*;
      inserted:=jsonb_set(inserted,array['templates'],to_jsonb(coalesce((inserted->>'templates')::int,0)+1));
    else matched:=jsonb_set(matched,array['templates'],to_jsonb(coalesce((matched->>'templates')::int,0)+1)); end if;
    for record in select value from jsonb_array_elements(parent->'template_items') loop
      target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'template_items',record->>'id',target,existing is not null);
      if existing is null then insert into public.template_items select (jsonb_populate_record(null::public.template_items,record||jsonb_build_object(
        'id',target,'user_id',current_user_id,'template_id',public.restore_mapped_id(restore_run.id,'templates',source),
        'category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'category_id')))).*;
        inserted:=jsonb_set(inserted,array['template_items'],to_jsonb(coalesce((inserted->>'template_items')::int,0)+1));
      else skipped:=jsonb_set(skipped,array['template_items'],to_jsonb(coalesce((skipped->>'template_items')::int,0)+1)); end if;
    end loop;
  end loop;

  for parent in select value from jsonb_array_elements(requested_payload->'budget_months') loop
    source:=parent->>'id'; existing:=null;
    if requested_mode='merge' then select id into existing from public.budget_months where user_id=current_user_id and month_start=(parent->>'month_start')::date limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'months',source,target,existing is not null);
    if existing is null then insert into public.budget_months select (jsonb_populate_record(null::public.budget_months,(parent-'budget_month_items'-'budget_transactions'-'planned_versus_actual')||jsonb_build_object(
      'id',target,'user_id',current_user_id,'source_template_id',public.restore_mapped_id(restore_run.id,'templates',parent->>'source_template_id')))).*;
      inserted:=jsonb_set(inserted,array['budget_months'],to_jsonb(coalesce((inserted->>'budget_months')::int,0)+1));
    else matched:=jsonb_set(matched,array['budget_months'],to_jsonb(coalesce((matched->>'budget_months')::int,0)+1)); end if;
    for record in select value from jsonb_array_elements(parent->'budget_month_items') loop
      target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'month_items',record->>'id',target,existing is not null);
      if existing is null then insert into public.budget_month_items select (jsonb_populate_record(null::public.budget_month_items,record||jsonb_build_object(
        'id',target,'user_id',current_user_id,'budget_month_id',public.restore_mapped_id(restore_run.id,'months',source),
        'source_template_item_id',public.restore_mapped_id(restore_run.id,'template_items',record->>'source_template_item_id'),
        'category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'category_id')))).*;
        inserted:=jsonb_set(inserted,array['budget_month_items'],to_jsonb(coalesce((inserted->>'budget_month_items')::int,0)+1));
      else skipped:=jsonb_set(skipped,array['budget_month_items'],to_jsonb(coalesce((skipped->>'budget_month_items')::int,0)+1)); end if;
    end loop;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'transaction_import_batches') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'budget_month_id'),true);
    target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'import_batches',record->>'id',target,parent_matched);
    if not parent_matched then insert into public.transaction_import_batches select (jsonb_populate_record(null::public.transaction_import_batches,record||jsonb_build_object(
      'id',target,'user_id',current_user_id,'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id'),
      'account_id',public.restore_mapped_id(restore_run.id,'accounts',record->>'account_id')))).*;
      inserted:=jsonb_set(inserted,array['transaction_import_batches'],to_jsonb(coalesce((inserted->>'transaction_import_batches')::int,0)+1));
    else skipped:=jsonb_set(skipped,array['transaction_import_batches'],to_jsonb(coalesce((skipped->>'transaction_import_batches')::int,0)+1)); end if;
  end loop;

  for parent in select value from jsonb_array_elements(requested_payload->'budget_months') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=parent->>'id'),true);
    for record in select value from jsonb_array_elements(parent->'budget_transactions') loop
      target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'transactions',record->>'id',target,parent_matched);
      if not parent_matched then insert into public.budget_transactions select (jsonb_populate_record(null::public.budget_transactions,record||jsonb_build_object(
        'id',target,'user_id',current_user_id,'budget_month_id',public.restore_mapped_id(restore_run.id,'months',parent->>'id'),
        'budget_month_item_id',public.restore_mapped_id(restore_run.id,'month_items',record->>'budget_month_item_id'),
        'category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'category_id'),
        'account_id',public.restore_mapped_id(restore_run.id,'accounts',record->>'account_id'),
        'import_batch_id',public.restore_mapped_id(restore_run.id,'import_batches',record->>'import_batch_id')))).*;
        inserted:=jsonb_set(inserted,array['budget_transactions'],to_jsonb(coalesce((inserted->>'budget_transactions')::int,0)+1));
      else skipped:=jsonb_set(skipped,array['budget_transactions'],to_jsonb(coalesce((skipped->>'budget_transactions')::int,0)+1)); end if;
    end loop;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'transaction_categorisation_rules') loop
    existing:=null; if requested_mode='merge' then select id into existing from public.transaction_categorisation_rules where user_id=current_user_id and sort_order=(record->>'sort_order')::integer limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'rules',record->>'id',target,existing is not null);
    if existing is null then insert into public.transaction_categorisation_rules select (jsonb_populate_record(null::public.transaction_categorisation_rules,record||jsonb_build_object('id',target,'user_id',current_user_id,'action_category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'action_category_id')))).*;
      inserted:=jsonb_set(inserted,array['transaction_categorisation_rules'],to_jsonb(coalesce((inserted->>'transaction_categorisation_rules')::int,0)+1));
    else matched:=jsonb_set(matched,array['transaction_categorisation_rules'],to_jsonb(coalesce((matched->>'transaction_categorisation_rules')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'categorisation_suggestion_dismissals') loop
    insert into public.categorisation_suggestion_dismissals
      (user_id,normalized_description,transaction_type,category_id,budget_item_name,dismissed_at)
    values(current_user_id,record->>'normalized_description',record->>'transaction_type',
      public.restore_mapped_id(restore_run.id,'categories',record->>'category_id'),record->>'budget_item_name',
      coalesce((record->>'dismissed_at')::timestamptz,now()))
    on conflict (user_id,normalized_description,transaction_type) do nothing;
    get diagnostics inserted_count=row_count;
    if inserted_count=1 then inserted:=jsonb_set(inserted,array['categorisation_suggestion_dismissals'],to_jsonb(coalesce((inserted->>'categorisation_suggestion_dismissals')::int,0)+1));
    else matched:=jsonb_set(matched,array['categorisation_suggestion_dismissals'],to_jsonb(coalesce((matched->>'categorisation_suggestion_dismissals')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'payment_schedules') loop
    existing:=null; if requested_mode='merge' then select id into existing from public.payment_schedules where user_id=current_user_id and lower(name)=lower(record->>'name') and start_date=(record->>'start_date')::date limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'schedules',record->>'id',target,existing is not null);
    if existing is null then insert into public.payment_schedules select (jsonb_populate_record(null::public.payment_schedules,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'template_id',public.restore_mapped_id(restore_run.id,'templates',record->>'template_id'),'template_item_id',public.restore_mapped_id(restore_run.id,'template_items',record->>'template_item_id'),
      'category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'category_id')))).*;
      inserted:=jsonb_set(inserted,array['payment_schedules'],to_jsonb(coalesce((inserted->>'payment_schedules')::int,0)+1));
    else matched:=jsonb_set(matched,array['payment_schedules'],to_jsonb(coalesce((matched->>'payment_schedules')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'payment_schedule_occurrences') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='schedules' and source_id=record->>'schedule_id'),true);
    target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'occurrences',record->>'id',target,parent_matched);
    if not parent_matched then insert into public.payment_schedule_occurrences select (jsonb_populate_record(null::public.payment_schedule_occurrences,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'schedule_id',public.restore_mapped_id(restore_run.id,'schedules',record->>'schedule_id'),'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id'),
      'budget_month_item_id',public.restore_mapped_id(restore_run.id,'month_items',record->>'budget_month_item_id'),'category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'category_id'),
      'matched_transaction_id',public.restore_mapped_id(restore_run.id,'transactions',record->>'matched_transaction_id')))).*;
      inserted:=jsonb_set(inserted,array['payment_schedule_occurrences'],to_jsonb(coalesce((inserted->>'payment_schedule_occurrences')::int,0)+1));
    else skipped:=jsonb_set(skipped,array['payment_schedule_occurrences'],to_jsonb(coalesce((skipped->>'payment_schedule_occurrences')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'financial_goals') loop
    existing:=null; if requested_mode='merge' then select id into existing from public.financial_goals where user_id=current_user_id and lower(name)=lower(record->>'name') and goal_type=record->>'goal_type' limit 1; end if;
    target:=coalesce(existing,gen_random_uuid()); perform public.register_restore_id(restore_run.id,'goals',record->>'id',target,existing is not null);
    if existing is null then insert into public.financial_goals select (jsonb_populate_record(null::public.financial_goals,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'category_id',public.restore_mapped_id(restore_run.id,'categories',record->>'category_id'),'account_id',public.restore_mapped_id(restore_run.id,'accounts',record->>'account_id')))).*;
      inserted:=jsonb_set(inserted,array['financial_goals'],to_jsonb(coalesce((inserted->>'financial_goals')::int,0)+1));
    else matched:=jsonb_set(matched,array['financial_goals'],to_jsonb(coalesce((matched->>'financial_goals')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'goal_contributions') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='goals' and source_id=record->>'goal_id'),true)
      or coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'budget_month_id'),true);
    if not parent_matched then target:=gen_random_uuid(); insert into public.goal_contributions select (jsonb_populate_record(null::public.goal_contributions,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'goal_id',public.restore_mapped_id(restore_run.id,'goals',record->>'goal_id'),'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id'),'transaction_id',public.restore_mapped_id(restore_run.id,'transactions',record->>'transaction_id')))).*;
      inserted:=jsonb_set(inserted,array['goal_contributions'],to_jsonb(coalesce((inserted->>'goal_contributions')::int,0)+1));
    else skipped:=jsonb_set(skipped,array['goal_contributions'],to_jsonb(coalesce((skipped->>'goal_contributions')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'goal_month_recommendations') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'budget_month_id'),true);
    if not parent_matched then target:=gen_random_uuid(); insert into public.goal_month_recommendations select (jsonb_populate_record(null::public.goal_month_recommendations,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'goal_id',public.restore_mapped_id(restore_run.id,'goals',record->>'goal_id'),'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id')))).*;
      inserted:=jsonb_set(inserted,array['goal_month_recommendations'],to_jsonb(coalesce((inserted->>'goal_month_recommendations')::int,0)+1));
    else skipped:=jsonb_set(skipped,array['goal_month_recommendations'],to_jsonb(coalesce((skipped->>'goal_month_recommendations')::int,0)+1)); end if;
  end loop;

  for record in select value from jsonb_array_elements(requested_payload->'budget_month_lifecycle') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'budget_month_id'),true);
    if not parent_matched then insert into public.budget_month_lifecycle select (jsonb_populate_record(null::public.budget_month_lifecycle,record||jsonb_build_object('user_id',current_user_id,'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id')))).*;
      inserted:=jsonb_set(inserted,array['budget_month_lifecycle'],to_jsonb(coalesce((inserted->>'budget_month_lifecycle')::int,0)+1)); end if;
  end loop;
  for record in select value from jsonb_array_elements(requested_payload->'month_close_summaries') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'budget_month_id'),true);
    target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'close_summaries',record->>'id',target,parent_matched);
    if not parent_matched then insert into public.month_close_summaries select (jsonb_populate_record(null::public.month_close_summaries,record||jsonb_build_object('id',target,'user_id',current_user_id,'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id')))).*;
      inserted:=jsonb_set(inserted,array['month_close_summaries'],to_jsonb(coalesce((inserted->>'month_close_summaries')::int,0)+1)); end if;
  end loop;
  for record in select value from jsonb_array_elements(requested_payload->'month_adjustments') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'original_budget_month_id'),true);
    target:=gen_random_uuid(); perform public.register_restore_id(restore_run.id,'adjustments',record->>'id',target,parent_matched);
    if not parent_matched then insert into public.month_adjustments select (jsonb_populate_record(null::public.month_adjustments,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'original_budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'original_budget_month_id'),'applied_budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'applied_budget_month_id')))).*;
      inserted:=jsonb_set(inserted,array['month_adjustments'],to_jsonb(coalesce((inserted->>'month_adjustments')::int,0)+1)); end if;
  end loop;
  for record in select value from jsonb_array_elements(requested_payload->'month_lifecycle_events') loop
    parent_matched:=coalesce((select matched_existing from public.backup_restore_source_ids where restore_id=restore_run.id and entity_type='months' and source_id=record->>'budget_month_id'),true);
    if not parent_matched then target:=gen_random_uuid(); insert into public.month_lifecycle_events select (jsonb_populate_record(null::public.month_lifecycle_events,record||jsonb_build_object('id',target,'user_id',current_user_id,
      'budget_month_id',public.restore_mapped_id(restore_run.id,'months',record->>'budget_month_id'),'adjustment_id',public.restore_mapped_id(restore_run.id,'adjustments',record->>'adjustment_id')))).*;
      inserted:=jsonb_set(inserted,array['month_lifecycle_events'],to_jsonb(coalesce((inserted->>'month_lifecycle_events')::int,0)+1)); end if;
  end loop;

  if requested_payload->'weekly_checkin_preferences' is not null and requested_payload->'weekly_checkin_preferences'<>'null'::jsonb then
    insert into public.weekly_checkin_preferences select (jsonb_populate_record(null::public.weekly_checkin_preferences,(requested_payload->'weekly_checkin_preferences')||jsonb_build_object('user_id',current_user_id))).*
    on conflict (user_id) do update set opted_in=excluded.opted_in,weekday=excluded.weekday,delivery_time=excluded.delivery_time,
      timezone=excluded.timezone,in_app_enabled=excluded.in_app_enabled,email_enabled=excluded.email_enabled,
      email_detail_enabled=excluded.email_detail_enabled,paused=excluded.paused,email_delivery_state=excluded.email_delivery_state;
  end if;
  update public.user_preferences set
    last_budget_month_id=public.restore_mapped_id(restore_run.id,'months',requested_payload#>>'{preferences,last_budget_month_id}'),
    last_route=case when requested_payload#>>'{preferences,last_route}' ~ '^/app/[a-z0-9/_?=&-]*$' then requested_payload#>>'{preferences,last_route}' else null end
  where user_id=current_user_id;
  delete from public.backup_restore_execution where transaction_id=txid_current();
  completed_report:=jsonb_build_object('restore_id',restore_run.id,'mode',requested_mode,'status','completed','recovery_snapshot_id',recovery_id,
    'inserted',inserted,'matched',matched,'skipped',skipped,'failed','{}'::jsonb,
    'warnings',case when requested_mode='merge' then jsonb_build_array('Matched months were left unchanged, including all locked history.') else '[]'::jsonb end,
    'completed_at',now());
  update public.backup_restore_runs set status='completed',report=completed_report,completed_at=now() where id=restore_run.id;
  return completed_report;
end;
$$;

revoke all on function public.restore_backup(jsonb,text,text,text) from public, anon;
grant execute on function public.restore_backup(jsonb,text,text,text) to authenticated;

create or replace function public.rollback_backup_restore(requested_snapshot_id uuid, requested_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected_payload jsonb; selected_fingerprint text;
begin
  select snapshot.payload into selected_payload from public.backup_recovery_snapshots snapshot
    where snapshot.id=requested_snapshot_id and snapshot.user_id=auth.uid();
  if selected_payload is null then raise exception 'Recovery snapshot not found' using errcode='42501'; end if;
  selected_fingerprint:=encode(extensions.digest(convert_to(selected_payload::text||':'||requested_snapshot_id::text,'UTF8'),'sha256'),'hex');
  return public.restore_backup(selected_payload,'replace',selected_fingerprint,requested_confirmation);
end;
$$;
revoke all on function public.rollback_backup_restore(uuid,text) from public, anon;
grant execute on function public.rollback_backup_restore(uuid,text) to authenticated;
