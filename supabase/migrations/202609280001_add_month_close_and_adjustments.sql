create table public.budget_month_lifecycle (
  budget_month_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'open' check (state in ('open', 'closed')),
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint month_lifecycle_owned_month_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete cascade,
  constraint month_lifecycle_closed_at_check check (
    (state = 'open' and closed_at is null) or (state = 'closed' and closed_at is not null)
  )
);

create table public.month_close_summaries (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_month_id uuid not null,
  close_sequence integer not null check (close_sequence > 0),
  completed_at timestamptz not null default now(),
  planned_income_minor bigint not null,
  planned_expenses_minor bigint not null,
  actual_income_minor bigint not null,
  actual_expenses_minor bigint not null,
  actual_balance_minor bigint not null,
  income_variance_minor bigint not null,
  expense_variance_minor bigint not null,
  uncategorised_count integer not null check (uncategorised_count >= 0),
  unmatched_schedule_count integer not null check (unmatched_schedule_count >= 0),
  incomplete_goal_count integer not null check (incomplete_goal_count >= 0),
  created_at timestamptz not null default now(),
  constraint month_close_summary_owned_month_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete cascade,
  unique (budget_month_id, close_sequence),
  unique (id, user_id)
);

create table public.month_adjustments (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_budget_month_id uuid not null,
  applied_budget_month_id uuid not null,
  item_type text not null check (item_type in ('income', 'expense')),
  direction text not null check (direction in ('increase', 'decrease')),
  amount_minor bigint not null check (amount_minor between 1 and 99999999999999),
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint month_adjustment_original_owned_fk foreign key (original_budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete restrict,
  constraint month_adjustment_applied_owned_fk foreign key (applied_budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete restrict,
  constraint month_adjustment_distinct_months check (original_budget_month_id <> applied_budget_month_id),
  unique (user_id, original_budget_month_id, idempotency_key),
  unique (id, user_id)
);

create table public.month_lifecycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_month_id uuid not null,
  event_type text not null check (event_type in ('closed', 'reopened', 'adjustment_created')),
  adjustment_id uuid,
  event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint month_event_owned_month_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete cascade,
  constraint month_event_owned_adjustment_fk foreign key (adjustment_id, user_id)
    references public.month_adjustments(id, user_id) on delete restrict,
  constraint month_event_adjustment_shape check (
    (event_type = 'adjustment_created' and adjustment_id is not null)
    or (event_type <> 'adjustment_created' and adjustment_id is null)
  )
);

create index month_close_summaries_month_idx on public.month_close_summaries(budget_month_id, close_sequence desc);
create index month_adjustments_original_idx on public.month_adjustments(original_budget_month_id, created_at, id);
create index month_adjustments_applied_idx on public.month_adjustments(applied_budget_month_id, created_at, id);
create index month_lifecycle_events_month_idx on public.month_lifecycle_events(budget_month_id, created_at, id);

alter table public.budget_month_lifecycle enable row level security;
alter table public.month_close_summaries enable row level security;
alter table public.month_adjustments enable row level security;
alter table public.month_lifecycle_events enable row level security;

create policy month_lifecycle_select_own on public.budget_month_lifecycle for select to authenticated using (user_id = auth.uid());
create policy month_close_summaries_select_own on public.month_close_summaries for select to authenticated using (user_id = auth.uid());
create policy month_adjustments_select_own on public.month_adjustments for select to authenticated using (user_id = auth.uid());
create policy month_lifecycle_events_select_own on public.month_lifecycle_events for select to authenticated using (user_id = auth.uid());

revoke all on public.budget_month_lifecycle, public.month_close_summaries, public.month_adjustments, public.month_lifecycle_events from anon, authenticated;
grant select on public.budget_month_lifecycle, public.month_close_summaries, public.month_adjustments, public.month_lifecycle_events to authenticated;

create or replace function public.prevent_append_only_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from auth.users where id = old.user_id) then return old; end if;
  raise exception 'Month history is append-only' using errcode = '55000';
end;
$$;

create trigger month_close_summaries_append_only before update or delete on public.month_close_summaries
for each row execute function public.prevent_append_only_mutation();
create trigger month_adjustments_append_only before update or delete on public.month_adjustments
for each row execute function public.prevent_append_only_mutation();
create trigger month_lifecycle_events_append_only before update or delete on public.month_lifecycle_events
for each row execute function public.prevent_append_only_mutation();

create or replace function public.assert_budget_month_editable(requested_month_start date, requested_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare selected_timezone text; editable_from date; selected_state text;
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from auth.users where id = requested_user_id) then return; end if;
  perform month.id from public.budget_months month
  where month.user_id = requested_user_id and month.month_start = requested_month_start
  for share;
  select coalesce(nullif(profile.timezone, ''), 'UTC') into selected_timezone
  from public.profiles profile where profile.user_id = requested_user_id;
  selected_timezone := coalesce(selected_timezone, 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = selected_timezone) then selected_timezone := 'UTC'; end if;
  editable_from := (date_trunc('month', now() at time zone selected_timezone) - interval '1 month')::date;
  if requested_month_start < editable_from then
    raise exception 'Months that are two or more calendar months old are read-only' using errcode = '55000';
  end if;
  select lifecycle.state into selected_state from public.budget_month_lifecycle lifecycle
  join public.budget_months month on month.id = lifecycle.budget_month_id and month.user_id = lifecycle.user_id
  where month.user_id = requested_user_id and month.month_start = requested_month_start;
  if selected_state = 'closed' then raise exception 'Closed months are read-only until reopened' using errcode = '55000'; end if;
end;
$$;

create or replace function public.close_budget_month(requested_month_id uuid, requested_acknowledged boolean)
returns setof public.month_close_summaries language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); selected_month public.budget_months%rowtype; selected_lifecycle public.budget_month_lifecycle%rowtype;
  selected_timezone text; local_month date; next_sequence integer; snapshot public.month_close_summaries%rowtype;
  planned_income bigint; planned_expenses bigint; actual_income bigint; actual_expenses bigint;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not requested_acknowledged then raise exception 'Review and acknowledge the close checklist' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_month_id::text, 0));
  select * into selected_month from public.budget_months where id = requested_month_id and user_id = current_user_id for update;
  if not found then raise exception 'Budget month not found' using errcode = '42501'; end if;
  select coalesce(nullif(timezone, ''), 'UTC') into selected_timezone from public.profiles where user_id = current_user_id;
  selected_timezone := coalesce(selected_timezone, 'UTC');
  local_month := date_trunc('month', now() at time zone selected_timezone)::date;
  if selected_month.month_start > local_month then raise exception 'Future months cannot be closed' using errcode = '22023'; end if;
  insert into public.budget_month_lifecycle(budget_month_id,user_id) values(requested_month_id,current_user_id) on conflict do nothing;
  select * into selected_lifecycle from public.budget_month_lifecycle where budget_month_id=requested_month_id for update;
  if selected_lifecycle.state = 'closed' then
    return query select * from public.month_close_summaries where budget_month_id=requested_month_id order by close_sequence desc limit 1;
    return;
  end if;
  perform public.assert_budget_month_editable(selected_month.month_start, current_user_id);
  select
    coalesce(sum(round(item.amount*100)::bigint) filter(where item.item_type='income' and item.archived_at is null and not item.is_disabled),0),
    coalesce(sum(round(item.amount*100)::bigint) filter(where item.item_type='expense' and item.archived_at is null and not item.is_disabled),0)
  into planned_income,planned_expenses from public.budget_month_items item where item.budget_month_id=requested_month_id and item.user_id=current_user_id;
  select
    coalesce(sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end) filter(where entry.transaction_type='income' and entry.status='posted'),0),
    coalesce(sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end) filter(where entry.transaction_type='expense' and entry.status='posted'),0)
  into actual_income,actual_expenses from public.budget_transactions entry where entry.budget_month_id=requested_month_id and entry.user_id=current_user_id;
  select coalesce(max(close_sequence),0)+1 into next_sequence from public.month_close_summaries where budget_month_id=requested_month_id;
  insert into public.month_close_summaries(
    user_id,budget_month_id,close_sequence,planned_income_minor,planned_expenses_minor,actual_income_minor,actual_expenses_minor,
    actual_balance_minor,income_variance_minor,expense_variance_minor,uncategorised_count,unmatched_schedule_count,incomplete_goal_count
  ) values (
    current_user_id,requested_month_id,next_sequence,planned_income,planned_expenses,actual_income,actual_expenses,
    actual_income-actual_expenses,actual_income-planned_income,actual_expenses-planned_expenses,
    (select count(*) from public.budget_transactions where budget_month_id=requested_month_id and user_id=current_user_id and status='posted' and category_id is null),
    (select count(*) from public.payment_schedule_occurrences where budget_month_id=requested_month_id and user_id=current_user_id and status='expected' and matched_transaction_id is null),
    (select count(*) from public.goal_month_recommendations recommendation where recommendation.budget_month_id=requested_month_id and recommendation.user_id=current_user_id and
      coalesce((select sum(contribution.amount_minor) from public.goal_contributions contribution where contribution.goal_id=recommendation.goal_id and contribution.budget_month_id=requested_month_id and contribution.user_id=current_user_id),0) < recommendation.recommended_amount_minor)
  ) returning * into snapshot;
  update public.budget_month_lifecycle set state='closed',closed_at=snapshot.completed_at,updated_at=now() where budget_month_id=requested_month_id;
  insert into public.month_lifecycle_events(user_id,budget_month_id,event_type,event_payload)
  values(current_user_id,requested_month_id,'closed',jsonb_build_object('close_summary_id',snapshot.id,'close_sequence',snapshot.close_sequence));
  return next snapshot;
end;
$$;

create or replace function public.reopen_budget_month(requested_month_id uuid)
returns setof public.budget_month_lifecycle language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid:=auth.uid(); selected_month public.budget_months%rowtype; selected_timezone text; editable_from date;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_month_id::text,0));
  select * into selected_month from public.budget_months where id=requested_month_id and user_id=current_user_id;
  if not found then raise exception 'Budget month not found' using errcode='42501'; end if;
  select coalesce(nullif(timezone,''),'UTC') into selected_timezone from public.profiles where user_id=current_user_id;
  selected_timezone:=coalesce(selected_timezone,'UTC');
  editable_from:=(date_trunc('month',now() at time zone selected_timezone)-interval '1 month')::date;
  if selected_month.month_start < editable_from then raise exception 'Age-locked months cannot be reopened' using errcode='55000'; end if;
  if not exists(select 1 from public.budget_month_lifecycle where budget_month_id=requested_month_id and user_id=current_user_id and state='closed') then
    raise exception 'Month is not closed' using errcode='55000';
  end if;
  update public.budget_month_lifecycle set state='open',closed_at=null,updated_at=now() where budget_month_id=requested_month_id and user_id=current_user_id;
  insert into public.month_lifecycle_events(user_id,budget_month_id,event_type) values(current_user_id,requested_month_id,'reopened');
  return query select * from public.budget_month_lifecycle where budget_month_id=requested_month_id;
end;
$$;

create or replace function public.create_month_adjustment(
  requested_original_month_id uuid, requested_applied_month_id uuid, requested_item_type text,
  requested_direction text, requested_amount_minor bigint, requested_reason text, requested_idempotency_key uuid
) returns setof public.month_adjustments language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid:=auth.uid(); original_month public.budget_months%rowtype; applied_month public.budget_months%rowtype;
  selected_timezone text; local_month date; editable_from date; created_adjustment public.month_adjustments%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requested_original_month_id::text||requested_idempotency_key::text,0));
  select * into original_month from public.budget_months where id=requested_original_month_id and user_id=current_user_id;
  select * into applied_month from public.budget_months where id=requested_applied_month_id and user_id=current_user_id;
  if original_month.id is null or applied_month.id is null then raise exception 'Budget month not found' using errcode='42501'; end if;
  select coalesce(nullif(timezone,''),'UTC') into selected_timezone from public.profiles where user_id=current_user_id;
  selected_timezone:=coalesce(selected_timezone,'UTC'); local_month:=date_trunc('month',now() at time zone selected_timezone)::date; editable_from:=(local_month-interval '1 month')::date;
  if original_month.month_start >= editable_from then raise exception 'Adjustments are only for age-locked months' using errcode='55000'; end if;
  if original_month.month_start >= applied_month.month_start then raise exception 'Original month must be earlier than the applied month' using errcode='22023'; end if;
  if applied_month.month_start <> local_month then raise exception 'Adjustments must be recorded in the current month' using errcode='22023'; end if;
  if original_month.currency_code <> applied_month.currency_code then raise exception 'Adjustment months must use the same currency' using errcode='22023'; end if;
  perform public.assert_budget_month_editable(applied_month.month_start,current_user_id);
  select * into created_adjustment from public.month_adjustments
  where user_id=current_user_id and original_budget_month_id=requested_original_month_id and idempotency_key=requested_idempotency_key;
  if found then
    if created_adjustment.applied_budget_month_id <> requested_applied_month_id
      or created_adjustment.item_type <> requested_item_type
      or created_adjustment.direction <> requested_direction
      or created_adjustment.amount_minor <> requested_amount_minor
      or created_adjustment.reason <> btrim(requested_reason) then
      raise exception 'Idempotency key was already used for a different adjustment' using errcode='22023';
    end if;
    return next created_adjustment; return;
  end if;
  insert into public.month_adjustments(user_id,original_budget_month_id,applied_budget_month_id,item_type,direction,amount_minor,reason,idempotency_key)
  values(current_user_id,requested_original_month_id,requested_applied_month_id,requested_item_type,requested_direction,requested_amount_minor,btrim(requested_reason),requested_idempotency_key)
  returning * into created_adjustment;
  if not exists(select 1 from public.month_lifecycle_events where adjustment_id=created_adjustment.id) then
    insert into public.month_lifecycle_events(user_id,budget_month_id,event_type,adjustment_id,event_payload)
    values(current_user_id,requested_original_month_id,'adjustment_created',created_adjustment.id,jsonb_build_object('applied_budget_month_id',requested_applied_month_id));
  end if;
  return next created_adjustment;
end;
$$;

drop function public.retrieve_budget_month_summaries();
create function public.retrieve_budget_month_summaries()
returns table(id uuid,user_id uuid,source_template_id uuid,month_start date,currency_code varchar(3),status text,notes text,last_opened_at timestamptz,created_at timestamptz,updated_at timestamptz,income numeric,expenses numeric,remaining numeric,actual_income numeric,actual_expenses numeric,actual_remaining numeric,lifecycle_state text,closed_at timestamptz)
language sql stable security invoker set search_path='' as $$
select month.id,month.user_id,month.source_template_id,month.month_start,month.currency_code,month.status,month.notes,month.last_opened_at,month.created_at,month.updated_at,
coalesce(plan.income,0),coalesce(plan.expenses,0),coalesce(plan.income,0)-coalesce(plan.expenses,0),coalesce(actual.income_minor,0)::numeric/100,coalesce(actual.expense_minor,0)::numeric/100,(coalesce(actual.income_minor,0)-coalesce(actual.expense_minor,0))::numeric/100,
coalesce(lifecycle.state,'open'),lifecycle.closed_at
from public.budget_months month
left join public.budget_month_lifecycle lifecycle on lifecycle.budget_month_id=month.id and lifecycle.user_id=month.user_id
left join lateral(select coalesce(sum(item.amount) filter(where item.item_type='income'),0) income,coalesce(sum(item.amount) filter(where item.item_type='expense'),0) expenses from public.budget_month_items item where item.budget_month_id=month.id and item.user_id=month.user_id and item.archived_at is null and not item.is_disabled) plan on true
left join lateral(select coalesce(sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end) filter(where entry.transaction_type='income' and entry.status='posted'),0) income_minor,coalesce(sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end) filter(where entry.transaction_type='expense' and entry.status='posted'),0) expense_minor from public.budget_transactions entry where entry.budget_month_id=month.id and entry.user_id=month.user_id) actual on true
where month.user_id=auth.uid() order by month.month_start desc;
$$;

revoke all on function public.prevent_append_only_mutation() from public,anon,authenticated;
revoke all on function public.close_budget_month(uuid,boolean),public.reopen_budget_month(uuid),public.create_month_adjustment(uuid,uuid,text,text,bigint,text,uuid) from public,anon;
grant execute on function public.close_budget_month(uuid,boolean),public.reopen_budget_month(uuid),public.create_month_adjustment(uuid,uuid,text,text,bigint,text,uuid),public.retrieve_budget_month_summaries() to authenticated;
