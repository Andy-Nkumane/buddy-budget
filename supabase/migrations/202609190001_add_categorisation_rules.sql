alter table public.budget_transactions
  add column is_recurring_candidate boolean not null default false;

create table public.transaction_categorisation_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null check (sort_order between 0 and 9999),
  enabled boolean not null default true,
  description_match text check (description_match in ('contains', 'exact')),
  description_value text check (
    description_value is null or char_length(btrim(description_value)) between 1 and 160
  ),
  amount_min_minor bigint check (amount_min_minor between 0 and 99999999999999),
  amount_max_minor bigint check (amount_max_minor between 0 and 99999999999999),
  transaction_type text check (transaction_type in ('income', 'expense')),
  date_from date,
  date_to date,
  days_of_week smallint[] not null default '{}',
  action_category_id uuid,
  action_budget_item_name text check (
    action_budget_item_name is null or char_length(btrim(action_budget_item_name)) between 1 and 120
  ),
  action_description text check (
    action_description is null or char_length(btrim(action_description)) between 1 and 160
  ),
  action_notes text check (action_notes is null or char_length(action_notes) <= 1000),
  action_recurring_candidate boolean,
  match_count bigint not null default 0 check (match_count >= 0),
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint transaction_categorisation_rules_user_order_unique
    unique (user_id, sort_order) deferrable initially deferred,
  foreign key (action_category_id, user_id)
    references public.categories(id, user_id) on delete cascade,
  constraint categorisation_rule_description_shape check (
    (description_match is null and description_value is null)
    or (description_match is not null and description_value is not null)
  ),
  constraint categorisation_rule_amount_range check (
    amount_min_minor is null or amount_max_minor is null or amount_min_minor <= amount_max_minor
  ),
  constraint categorisation_rule_date_range check (
    date_from is null or date_to is null or date_from <= date_to
  ),
  constraint categorisation_rule_days check (
    days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
    and cardinality(days_of_week) <= 7
  ),
  constraint categorisation_rule_has_condition check (
    description_match is not null or amount_min_minor is not null or amount_max_minor is not null
    or transaction_type is not null or date_from is not null or date_to is not null
    or cardinality(days_of_week) > 0
  ),
  constraint categorisation_rule_has_action check (
    action_category_id is not null or action_budget_item_name is not null
    or action_description is not null or action_notes is not null
    or action_recurring_candidate is not null
  )
);

create index transaction_categorisation_rules_enabled_idx
  on public.transaction_categorisation_rules(user_id, enabled, sort_order, id);

create table public.categorisation_suggestion_dismissals (
  user_id uuid not null references auth.users(id) on delete cascade,
  normalized_description text not null check (char_length(normalized_description) between 1 and 160),
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category_id uuid,
  budget_item_name text,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, normalized_description, transaction_type),
  foreign key (category_id, user_id) references public.categories(id, user_id) on delete cascade
);

create trigger transaction_categorisation_rules_set_updated_at
  before update on public.transaction_categorisation_rules
  for each row execute function public.set_updated_at();

alter table public.transaction_categorisation_rules enable row level security;
alter table public.categorisation_suggestion_dismissals enable row level security;
create policy categorisation_rules_select_own on public.transaction_categorisation_rules
  for select to authenticated using ((select auth.uid()) = user_id);
create policy suggestion_dismissals_select_own on public.categorisation_suggestion_dismissals
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.transaction_categorisation_rules from anon, authenticated;
revoke all on public.categorisation_suggestion_dismissals from anon, authenticated;
grant select on public.transaction_categorisation_rules to authenticated;
grant select on public.categorisation_suggestion_dismissals to authenticated;

create or replace function public.upsert_categorisation_rule(requested_rule jsonb)
returns setof public.transaction_categorisation_rules
language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_id uuid := nullif(requested_rule->>'id', '')::uuid;
  selected_order integer;
  saved public.transaction_categorisation_rules%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':categorisation-rules', 0)
  );
  if coalesce(jsonb_typeof(requested_rule), '') <> 'object' then
    raise exception 'Rule must be an object' using errcode='22023';
  end if;
  if requested_rule ? 'user_id' or requested_rule ? 'match_count' then
    raise exception 'Server-managed rule fields are not accepted' using errcode='22023';
  end if;
  if nullif(requested_rule->>'action_category_id','') is not null and (
    nullif(requested_rule->>'transaction_type','') is null or not exists(
      select 1 from public.categories category
      where category.id=(requested_rule->>'action_category_id')::uuid
        and category.user_id=current_user_id
        and category.item_type=requested_rule->>'transaction_type'
        and category.archived_at is null
    )
  ) then
    raise exception 'A category action requires a matching transaction type and active owned category'
      using errcode='23514';
  end if;
  if selected_id is null then
    select coalesce(max(sort_order) + 1, 0) into selected_order
      from public.transaction_categorisation_rules where user_id = current_user_id;
    insert into public.transaction_categorisation_rules (
      user_id, name, sort_order, enabled, description_match, description_value,
      amount_min_minor, amount_max_minor, transaction_type, date_from, date_to, days_of_week,
      action_category_id, action_budget_item_name, action_description, action_notes,
      action_recurring_candidate
    ) values (
      current_user_id, requested_rule->>'name', selected_order,
      coalesce((requested_rule->>'enabled')::boolean, true),
      nullif(requested_rule->>'description_match',''), nullif(btrim(requested_rule->>'description_value'),''),
      nullif(requested_rule->>'amount_min_minor','')::bigint,
      nullif(requested_rule->>'amount_max_minor','')::bigint,
      nullif(requested_rule->>'transaction_type',''),
      nullif(requested_rule->>'date_from','')::date, nullif(requested_rule->>'date_to','')::date,
      coalesce(array(select jsonb_array_elements_text(coalesce(requested_rule->'days_of_week','[]'))::smallint), '{}'),
      nullif(requested_rule->>'action_category_id','')::uuid,
      nullif(btrim(requested_rule->>'action_budget_item_name'),''),
      nullif(btrim(requested_rule->>'action_description'),''),
      nullif(requested_rule->>'action_notes',''),
      case when requested_rule ? 'action_recurring_candidate'
        then (requested_rule->>'action_recurring_candidate')::boolean else null end
    ) returning * into saved;
  else
    update public.transaction_categorisation_rules set
      name = requested_rule->>'name', enabled = coalesce((requested_rule->>'enabled')::boolean, true),
      description_match = nullif(requested_rule->>'description_match',''),
      description_value = nullif(btrim(requested_rule->>'description_value'),''),
      amount_min_minor = nullif(requested_rule->>'amount_min_minor','')::bigint,
      amount_max_minor = nullif(requested_rule->>'amount_max_minor','')::bigint,
      transaction_type = nullif(requested_rule->>'transaction_type',''),
      date_from = nullif(requested_rule->>'date_from','')::date,
      date_to = nullif(requested_rule->>'date_to','')::date,
      days_of_week = coalesce(array(select jsonb_array_elements_text(coalesce(requested_rule->'days_of_week','[]'))::smallint), '{}'),
      action_category_id = nullif(requested_rule->>'action_category_id','')::uuid,
      action_budget_item_name = nullif(btrim(requested_rule->>'action_budget_item_name'),''),
      action_description = nullif(btrim(requested_rule->>'action_description'),''),
      action_notes = nullif(requested_rule->>'action_notes',''),
      action_recurring_candidate = case when requested_rule ? 'action_recurring_candidate'
        then (requested_rule->>'action_recurring_candidate')::boolean else null end
    where id = selected_id and user_id = current_user_id returning * into saved;
    if not found then raise exception 'Rule not found' using errcode='42501'; end if;
  end if;
  return next saved;
end; $$;

create or replace function public.move_categorisation_rule(requested_rule_id uuid, requested_direction integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); selected_order integer; other_id uuid; other_order integer;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text || ':categorisation-rules', 0)
  );
  if requested_direction not in (-1,1) then raise exception 'Direction must be -1 or 1' using errcode='22023'; end if;
  select sort_order into selected_order from public.transaction_categorisation_rules
    where id=requested_rule_id and user_id=current_user_id for update;
  if not found then raise exception 'Rule not found' using errcode='42501'; end if;
  select id, sort_order into other_id, other_order from public.transaction_categorisation_rules
    where user_id=current_user_id and
      ((requested_direction=-1 and sort_order < selected_order) or (requested_direction=1 and sort_order > selected_order))
    order by case when requested_direction=-1 then -sort_order else sort_order end limit 1 for update;
  if other_id is null then return; end if;
  update public.transaction_categorisation_rules set sort_order=case
    when id=requested_rule_id then other_order when id=other_id then selected_order else sort_order end
  where id in (requested_rule_id,other_id) and user_id=current_user_id;
end; $$;

create or replace function public.delete_categorisation_rule(requested_rule_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  delete from public.transaction_categorisation_rules where id=requested_rule_id and user_id=current_user_id;
  if not found then raise exception 'Rule not found' using errcode='42501'; end if;
end; $$;

create or replace function public.process_categorisation_rules(
  requested_transaction_ids uuid[], requested_dry_run boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid(); tx public.budget_transactions%rowtype; selected_rule record;
  ids uuid[]; changes jsonb := '[]'; tx_changes jsonb; winners text[]; applied_count integer := 0;
  chosen_category uuid; chosen_item uuid; chosen_description text; chosen_notes text; chosen_recurring boolean;
  has_category boolean; has_item boolean; has_description boolean; has_notes boolean; has_recurring boolean;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  ids := array(select distinct unnest(requested_transaction_ids));
  if coalesce(cardinality(ids),0) not between 1 and 200 then
    raise exception 'Choose between 1 and 200 transactions' using errcode='22023';
  end if;
  if exists(select 1 from unnest(ids) id where not exists(
    select 1 from public.budget_transactions t where t.id=id and t.user_id=current_user_id
  )) then raise exception 'Transaction not found' using errcode='42501'; end if;
  for tx in select * from public.budget_transactions where user_id=current_user_id and id=any(ids) order by id for update loop
    tx_changes := '[]'; winners := '{}'; has_category:=false; has_item:=false; has_description:=false; has_notes:=false; has_recurring:=false;
    chosen_category:=null; chosen_item:=null; chosen_description:=null; chosen_notes:=null; chosen_recurring:=null;
    for selected_rule in select r.* from public.transaction_categorisation_rules r
      where r.user_id=current_user_id and r.enabled
        and (r.description_match is null or (r.description_match='exact' and lower(regexp_replace(btrim(tx.description),'\s+',' ','g'))=lower(regexp_replace(btrim(r.description_value),'\s+',' ','g'))) or (r.description_match='contains' and lower(regexp_replace(btrim(tx.description),'\s+',' ','g')) like '%'||lower(regexp_replace(btrim(r.description_value),'\s+',' ','g'))||'%'))
        and (r.amount_min_minor is null or tx.amount_minor>=r.amount_min_minor)
        and (r.amount_max_minor is null or tx.amount_minor<=r.amount_max_minor)
        and (r.transaction_type is null or tx.transaction_type=r.transaction_type)
        and (r.date_from is null or tx.transaction_date>=r.date_from)
        and (r.date_to is null or tx.transaction_date<=r.date_to)
        and (cardinality(r.days_of_week)=0 or extract(dow from tx.transaction_date)::smallint=any(r.days_of_week))
      order by r.sort_order, r.id loop
      if not has_category and selected_rule.action_category_id is not null then chosen_category:=selected_rule.action_category_id; has_category:=true; winners:=winners||('category:'||selected_rule.id||':'||selected_rule.name); end if;
      if not has_item and selected_rule.action_budget_item_name is not null then
        select i.id into chosen_item from public.budget_month_items i where i.user_id=current_user_id and i.budget_month_id=tx.budget_month_id and i.item_type=tx.transaction_type and lower(i.name_snapshot)=lower(selected_rule.action_budget_item_name) and i.archived_at is null order by i.sort_order,i.id limit 1;
        if chosen_item is not null then has_item:=true; winners:=winners||('budget_item:'||selected_rule.id||':'||selected_rule.name); end if;
      end if;
      if not has_description and selected_rule.action_description is not null then chosen_description:=selected_rule.action_description; has_description:=true; winners:=winners||('description:'||selected_rule.id||':'||selected_rule.name); end if;
      if not has_notes and selected_rule.action_notes is not null then chosen_notes:=selected_rule.action_notes; has_notes:=true; winners:=winners||('notes:'||selected_rule.id||':'||selected_rule.name); end if;
      if not has_recurring and selected_rule.action_recurring_candidate is not null then chosen_recurring:=selected_rule.action_recurring_candidate; has_recurring:=true; winners:=winners||('recurring:'||selected_rule.id||':'||selected_rule.name); end if;
    end loop;
    if has_category and not has_item then
      select i.id into chosen_item from public.budget_month_items i
      where i.user_id=current_user_id and i.budget_month_id=tx.budget_month_id
        and i.item_type=tx.transaction_type and i.category_id=chosen_category
        and i.archived_at is null
      order by i.is_disabled, i.sort_order, i.id limit 1;
      has_item:=chosen_item is not null;
    end if;
    tx_changes := jsonb_strip_nulls(jsonb_build_object(
      'transaction_id',tx.id,'winning_rules',to_jsonb(winners),
      'category_id',case when has_category and tx.category_id is distinct from chosen_category then jsonb_build_object('before',tx.category_id,'after',chosen_category) end,
      'budget_month_item_id',case when has_item and tx.budget_month_item_id is distinct from chosen_item then jsonb_build_object('before',tx.budget_month_item_id,'after',chosen_item) end,
      'description',case when has_description and tx.description is distinct from chosen_description then jsonb_build_object('before',tx.description,'after',chosen_description) end,
      'notes',case when has_notes and tx.notes is distinct from chosen_notes then jsonb_build_object('before',tx.notes,'after',chosen_notes) end,
      'is_recurring_candidate',case when has_recurring and tx.is_recurring_candidate is distinct from chosen_recurring then jsonb_build_object('before',tx.is_recurring_candidate,'after',chosen_recurring) end
    ));
    if tx_changes - 'transaction_id' - 'winning_rules' <> '{}'::jsonb then
      changes:=changes||jsonb_build_array(tx_changes); applied_count:=applied_count+1;
      if not requested_dry_run then
        perform public.assert_budget_month_editable(m.month_start,current_user_id) from public.budget_months m where m.id=tx.budget_month_id and m.user_id=current_user_id;
        update public.budget_transactions set category_id=case when has_category then chosen_category else category_id end,
          budget_month_item_id=case when has_item then chosen_item else budget_month_item_id end,
          description=case when has_description then chosen_description else description end,
          notes=case when has_notes then chosen_notes else notes end,
          is_recurring_candidate=case when has_recurring then chosen_recurring else is_recurring_candidate end
          where id=tx.id and user_id=current_user_id;
      end if;
    end if;
  end loop;
  if not requested_dry_run then
    update public.transaction_categorisation_rules r set match_count=match_count+matched.match_total, last_matched_at=now()
    from (
      select split_part(winner.value,':',2)::uuid id,count(distinct change.value->>'transaction_id') match_total
      from jsonb_array_elements(changes) change(value)
      cross join lateral jsonb_array_elements_text(change.value->'winning_rules') winner(value)
      group by 1
    ) matched
    where r.id=matched.id and r.user_id=current_user_id;
  end if;
  return jsonb_build_object('dry_run',requested_dry_run,'selected_count',cardinality(ids),'changed_count',applied_count,'changes',changes);
end; $$;

create or replace function public.retrieve_categorisation_suggestions()
returns table(normalized_description text, transaction_type text, category_id uuid, budget_item_name text, occurrence_count bigint)
language sql security definer set search_path='' stable as $$
  with candidates as (
    select lower(regexp_replace(btrim(t.description),'\s+',' ','g')) normalized,
      t.transaction_type kind, (array_agg(t.category_id order by t.created_at desc))[1] category,
      min(t.budget_item_snapshot) item_name, count(*) occurrences
    from public.budget_transactions t
    where t.user_id=auth.uid() and t.category_id is not null
    group by 1,2
    having count(*) >= 3 and count(distinct t.category_id)=1
      and count(distinct coalesce(t.budget_item_snapshot,'__unassigned__'))=1
  )
  select c.normalized,c.kind,c.category,c.item_name,c.occurrences from candidates c
  where not exists(select 1 from public.categorisation_suggestion_dismissals d
    where d.user_id=auth.uid() and d.normalized_description=c.normalized and d.transaction_type=c.kind)
  order by c.occurrences desc,c.normalized limit 20;
$$;

create or replace function public.dismiss_categorisation_suggestion(requested_description text, requested_transaction_type text, requested_category_id uuid, requested_budget_item_name text)
returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid(); normalized text:=lower(regexp_replace(btrim(requested_description),'\s+',' ','g'));
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.categorisation_suggestion_dismissals(user_id,normalized_description,transaction_type,category_id,budget_item_name)
  values(current_user_id,normalized,requested_transaction_type,requested_category_id,nullif(btrim(requested_budget_item_name),''))
  on conflict(user_id,normalized_description,transaction_type) do update set dismissed_at=now();
end; $$;

revoke all on function public.upsert_categorisation_rule(jsonb) from public,anon;
revoke all on function public.move_categorisation_rule(uuid,integer) from public,anon;
revoke all on function public.delete_categorisation_rule(uuid) from public,anon;
revoke all on function public.process_categorisation_rules(uuid[],boolean) from public,anon;
revoke all on function public.retrieve_categorisation_suggestions() from public,anon;
revoke all on function public.dismiss_categorisation_suggestion(text,text,uuid,text) from public,anon;
grant execute on function public.upsert_categorisation_rule(jsonb) to authenticated;
grant execute on function public.move_categorisation_rule(uuid,integer) to authenticated;
grant execute on function public.delete_categorisation_rule(uuid) to authenticated;
grant execute on function public.process_categorisation_rules(uuid[],boolean) to authenticated;
grant execute on function public.retrieve_categorisation_suggestions() to authenticated;
grant execute on function public.dismiss_categorisation_suggestion(text,text,uuid,text) to authenticated;

create or replace function public.import_budget_transactions_with_rules(
  requested_budget_month_id uuid, requested_account_id uuid, requested_file_name text,
  requested_batch_key text, requested_mapping_metadata jsonb, requested_rows jsonb,
  requested_invalid_count integer, requested_excluded_count integer
) returns table(batch_id uuid, accepted_count integer, duplicate_count integer, invalid_count integer, excluded_count integer, was_existing boolean)
language plpgsql security definer set search_path='' as $$
declare imported record; selected_ids uuid[]; offset_index integer:=1;
begin
  select * into imported from public.import_budget_transactions(
    requested_budget_month_id,requested_account_id,requested_file_name,requested_batch_key,
    requested_mapping_metadata,requested_rows,requested_invalid_count,requested_excluded_count
  );
  if not imported.was_existing then
    select array_agg(t.id order by t.id) into selected_ids from public.budget_transactions t
      where t.import_batch_id=imported.batch_id and t.user_id=auth.uid();
    while offset_index <= coalesce(cardinality(selected_ids),0) loop
      perform public.process_categorisation_rules(selected_ids[offset_index:offset_index+199],false);
      offset_index:=offset_index+200;
    end loop;
  end if;
  return query select imported.batch_id,imported.accepted_count,imported.duplicate_count,
    imported.invalid_count,imported.excluded_count,imported.was_existing;
end; $$;
revoke all on function public.import_budget_transactions_with_rules(uuid,uuid,text,text,jsonb,jsonb,integer,integer) from public,anon;
grant execute on function public.import_budget_transactions_with_rules(uuid,uuid,text,text,jsonb,jsonb,integer,integer) to authenticated;
