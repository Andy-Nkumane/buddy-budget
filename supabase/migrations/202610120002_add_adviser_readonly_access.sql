create table public.adviser_access_grants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  grantor_user_id uuid not null references auth.users(id) on delete cascade,
  adviser_user_id uuid references auth.users(id) on delete cascade,
  adviser_email text not null check(adviser_email=lower(btrim(adviser_email)) and adviser_email like '%@%'),
  token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),
  date_from date not null,
  date_to date not null,
  sections text[] not null default array['summary']::text[],
  allow_export boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  declined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  renewed_from_id uuid references public.adviser_access_grants(id) on delete set null,
  check(date_from<=date_to and date_to<=date_from+interval '2 years'),
  check(starts_at<expires_at and expires_at<=starts_at+interval '90 days'),
  check(sections<@array['summary','categories','transactions','schedules','goals']::text[] and cardinality(sections) between 1 and 5),
  check(not (accepted_at is not null and declined_at is not null))
);
create index adviser_grants_household_idx on public.adviser_access_grants(household_id,created_at desc);
create index adviser_grants_adviser_idx on public.adviser_access_grants(adviser_user_id,expires_at desc)
where accepted_at is not null and revoked_at is null;

create table public.adviser_access_events (
  id bigint generated always as identity primary key,
  grant_id uuid not null references public.adviser_access_grants(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('created','accepted','declined','accessed','revoked','renewed')),
  event_day date not null default (timezone('utc',now()))::date,
  created_at timestamptz not null default now()
);
create index adviser_events_household_idx on public.adviser_access_events(household_id,created_at desc,id desc);
create unique index adviser_events_daily_access_idx on public.adviser_access_events(grant_id,actor_user_id,event_day)
where action='accessed';

alter table public.adviser_access_grants enable row level security;
alter table public.adviser_access_events enable row level security;
create policy adviser_grants_owner_select on public.adviser_access_grants for select to authenticated
using(public.has_household_role(household_id,array['owner']));
create policy adviser_grants_recipient_select on public.adviser_access_grants for select to authenticated
using(adviser_user_id=auth.uid());
create policy adviser_events_owner_select on public.adviser_access_events for select to authenticated
using(public.has_household_role(household_id,array['owner']));
revoke all on public.adviser_access_grants,public.adviser_access_events from public,anon,authenticated;

create or replace function public.create_adviser_grant(
  requested_email text,requested_token_hash text,requested_date_from date,requested_date_to date,
  requested_sections text[],requested_starts_at timestamptz,requested_expires_at timestamptz,
  requested_allow_export boolean,requested_renewed_from_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare household uuid:=public.current_household_id(); created_id uuid; normalized_sections text[];
begin
  if not public.has_household_role(household,array['owner']) then raise exception 'Only the household owner can grant adviser access' using errcode='42501'; end if;
  normalized_sections:=array(select distinct section from unnest(requested_sections) section order by section);
  if lower(btrim(requested_email)) not like '%@%' or requested_token_hash!~'^[0-9a-f]{64}$'
    or requested_date_from>requested_date_to or requested_date_to>requested_date_from+interval '2 years'
    or requested_starts_at<now()-interval '5 minutes' or requested_starts_at>now()+interval '30 days'
    or requested_expires_at<=requested_starts_at or requested_expires_at>requested_starts_at+interval '90 days'
    or cardinality(normalized_sections) not between 1 and 5
    or not normalized_sections<@array['summary','categories','transactions','schedules','goals']::text[] then
    raise exception 'Invalid adviser grant' using errcode='22023'; end if;
  if requested_renewed_from_id is not null and not exists(select 1 from public.adviser_access_grants
    where id=requested_renewed_from_id and household_id=household) then
    raise exception 'Original grant unavailable' using errcode='22023'; end if;
  insert into public.adviser_access_grants(household_id,grantor_user_id,adviser_email,token_hash,date_from,date_to,
    sections,allow_export,starts_at,expires_at,renewed_from_id)
  values(household,auth.uid(),lower(btrim(requested_email)),requested_token_hash,requested_date_from,requested_date_to,
    normalized_sections,requested_allow_export,requested_starts_at,requested_expires_at,requested_renewed_from_id)
  returning id into created_id;
  insert into public.adviser_access_events(grant_id,household_id,actor_user_id,action)
  values(created_id,household,auth.uid(),case when requested_renewed_from_id is null then 'created' else 'renewed' end);
  return created_id;
end $$;

create or replace function public.respond_to_adviser_grant(requested_token text,requested_accept boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare selected public.adviser_access_grants%rowtype; verified_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into selected from public.adviser_access_grants
  where token_hash=encode(extensions.digest(requested_token,'sha256'),'hex') for update;
  if not found or selected.accepted_at is not null or selected.declined_at is not null or selected.revoked_at is not null
    or selected.expires_at<=now() then raise exception 'This adviser invitation is unavailable' using errcode='22023'; end if;
  if verified_email='' or verified_email<>selected.adviser_email or not exists(select 1 from auth.users
    where id=auth.uid() and email_confirmed_at is not null) then
    raise exception 'Sign in with the invited verified email address' using errcode='42501'; end if;
  if requested_accept then update public.adviser_access_grants set adviser_user_id=auth.uid(),accepted_at=now() where id=selected.id;
  else update public.adviser_access_grants set adviser_user_id=auth.uid(),declined_at=now() where id=selected.id; end if;
  insert into public.adviser_access_events(grant_id,household_id,actor_user_id,action)
  values(selected.id,selected.household_id,auth.uid(),case when requested_accept then 'accepted' else 'declined' end);
  return selected.id;
end $$;

create or replace function public.revoke_adviser_grant(requested_grant_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare selected public.adviser_access_grants%rowtype;
begin
  select * into selected from public.adviser_access_grants where id=requested_grant_id for update;
  if not found or not public.has_household_role(selected.household_id,array['owner']) then raise exception 'Adviser grant unavailable' using errcode='42501'; end if;
  if selected.revoked_at is null then
    update public.adviser_access_grants set revoked_at=now() where id=selected.id;
    insert into public.adviser_access_events(grant_id,household_id,actor_user_id,action) values(selected.id,selected.household_id,auth.uid(),'revoked');
  end if;
  return true;
end $$;

create or replace function public.retrieve_adviser_grants()
returns jsonb language sql security definer stable set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',grant_row.id,'householdId',grant_row.household_id,
    'householdName',household.name,'adviserEmail',grant_row.adviser_email,'dateFrom',grant_row.date_from,
    'dateTo',grant_row.date_to,'sections',grant_row.sections,'allowExport',grant_row.allow_export,
    'startsAt',grant_row.starts_at,'expiresAt',grant_row.expires_at,'acceptedAt',grant_row.accepted_at,
    'declinedAt',grant_row.declined_at,'revokedAt',grant_row.revoked_at,'createdAt',grant_row.created_at,
    'lastAccessedAt',case when public.has_household_role(grant_row.household_id,array['owner']) then
      (select max(event.created_at) from public.adviser_access_events event where event.grant_id=grant_row.id and event.action='accessed') end,
    'accessCount',case when public.has_household_role(grant_row.household_id,array['owner']) then
      (select count(*) from public.adviser_access_events event where event.grant_id=grant_row.id and event.action='accessed') else 0 end,
    'events',case when public.has_household_role(grant_row.household_id,array['owner']) then coalesce((select jsonb_agg(jsonb_build_object('action',event.action,'createdAt',event.created_at,
      'actor',coalesce(nullif(profile.display_name,''),users.email,'Former account')) order by event.created_at desc,event.id desc)
      from public.adviser_access_events event left join public.profiles profile on profile.user_id=event.actor_user_id
      left join auth.users users on users.id=event.actor_user_id where event.grant_id=grant_row.id),'[]'::jsonb) else '[]'::jsonb end,
    'isOwner',public.has_household_role(grant_row.household_id,array['owner'])) order by grant_row.created_at desc),'[]'::jsonb)
  from public.adviser_access_grants grant_row join public.households household on household.id=grant_row.household_id
  where grant_row.adviser_user_id=auth.uid() or public.has_household_role(grant_row.household_id,array['owner']);
$$;

create or replace function public.retrieve_adviser_data(requested_grant_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare selected public.adviser_access_grants%rowtype; result jsonb;
begin
  select grant_row.* into selected from public.adviser_access_grants grant_row
  where grant_row.id=requested_grant_id and (
    public.has_household_role(grant_row.household_id,array['owner']) or (
      grant_row.adviser_user_id=auth.uid() and grant_row.accepted_at is not null and grant_row.revoked_at is null
      and grant_row.starts_at<=now() and grant_row.expires_at>now()
      and exists(select 1 from public.household_memberships membership
        where membership.household_id=grant_row.household_id and membership.user_id=grant_row.grantor_user_id and membership.role='owner')));
  if not found then raise exception 'Adviser access unavailable' using errcode='42501'; end if;
  result:=jsonb_build_object('grantId',selected.id,'householdId',selected.household_id,'dateFrom',selected.date_from,
    'dateTo',selected.date_to,'sections',selected.sections,'allowExport',selected.allow_export,'expiresAt',selected.expires_at,
    'currencyCode',coalesce((select month_row.currency_code from public.budget_months month_row
      where month_row.household_id=selected.household_id and month_row.month_start<=selected.date_to
      order by month_row.month_start desc limit 1),'ZAR'));
  if 'summary'=any(selected.sections) then result:=result||jsonb_build_object('summary',coalesce((select jsonb_agg(jsonb_build_object(
    'monthStart',month_row.month_start,'currencyCode',month_row.currency_code,
    'plannedIncomeMinor',coalesce((select sum(round(item.amount*100)::bigint) from public.budget_month_items item where item.budget_month_id=month_row.id and item.item_type='income' and not item.is_disabled and item.archived_at is null),0),
    'plannedExpensesMinor',coalesce((select sum(round(item.amount*100)::bigint) from public.budget_month_items item where item.budget_month_id=month_row.id and item.item_type='expense' and not item.is_disabled and item.archived_at is null),0),
    'actualIncomeMinor',coalesce((select sum(case when transaction.is_refund then -transaction.amount_minor else transaction.amount_minor end) from public.budget_transactions transaction where transaction.budget_month_id=month_row.id and transaction.transaction_date between selected.date_from and selected.date_to and transaction.transaction_type='income' and transaction.status='posted'),0),
    'actualExpensesMinor',coalesce((select sum(case when transaction.is_refund then -transaction.amount_minor else transaction.amount_minor end) from public.budget_transactions transaction where transaction.budget_month_id=month_row.id and transaction.transaction_date between selected.date_from and selected.date_to and transaction.transaction_type='expense' and transaction.status='posted'),0)) order by month_row.month_start)
    from public.budget_months month_row where month_row.household_id=selected.household_id and month_row.month_start between selected.date_from and selected.date_to),'[]'::jsonb)); end if;
  if 'categories'=any(selected.sections) then result:=result||jsonb_build_object('categories',coalesce((select jsonb_agg(category_data order by category_data->>'name') from (
    select jsonb_build_object('name',coalesce(transaction.category_snapshot,'Uncategorised'),'type',transaction.transaction_type,
      'actualMinor',sum(case when transaction.is_refund then -transaction.amount_minor else transaction.amount_minor end)) category_data from public.budget_transactions transaction
    where transaction.household_id=selected.household_id and transaction.transaction_date between selected.date_from and selected.date_to and transaction.status='posted'
    group by coalesce(transaction.category_snapshot,'Uncategorised'),transaction.transaction_type) grouped),'[]'::jsonb)); end if;
  if 'transactions'=any(selected.sections) then result:=result||jsonb_build_object('transactions',coalesce((select jsonb_agg(jsonb_build_object(
    'date',transaction.transaction_date,'description',transaction.description,'amountMinor',transaction.amount_minor,
    'type',transaction.transaction_type,'category',transaction.category_snapshot,'status',transaction.status) order by transaction.transaction_date,transaction.id)
    from public.budget_transactions transaction where transaction.household_id=selected.household_id
      and transaction.transaction_date between selected.date_from and selected.date_to),'[]'::jsonb)); end if;
  if 'schedules'=any(selected.sections) then result:=result||jsonb_build_object('schedules',coalesce((select jsonb_agg(jsonb_build_object(
    'name',schedule.name,'type',schedule.item_type,'amountMinor',schedule.amount_minor,'approximate',schedule.amount_is_approximate,
    'recurrence',schedule.recurrence,'nextOccurrence',schedule.next_occurrence) order by schedule.next_occurrence,schedule.id)
    from public.payment_schedules schedule where schedule.household_id=selected.household_id
      and schedule.next_occurrence between selected.date_from and selected.date_to
      and schedule.start_date<=selected.date_to and (schedule.end_date is null or schedule.end_date>=selected.date_from)),'[]'::jsonb)); end if;
  if 'goals'=any(selected.sections) then result:=result||jsonb_build_object('goals',coalesce((select jsonb_agg(jsonb_build_object(
    'name',goal.name,'type',goal.goal_type,'targetAmountMinor',goal.target_amount_minor,'currentBalanceMinor',case when goal.goal_type='debt_paydown'
      then greatest(0,goal.starting_balance_minor-coalesce((select sum(contribution.amount_minor) from public.goal_contributions contribution where contribution.goal_id=goal.id and contribution.contribution_date<=selected.date_to),0))
      else goal.starting_balance_minor+coalesce((select sum(contribution.amount_minor) from public.goal_contributions contribution where contribution.goal_id=goal.id and contribution.contribution_date<=selected.date_to),0) end,
    'targetDate',goal.target_date,'status',goal.status) order by goal.priority,goal.id)
    from public.financial_goals goal where goal.household_id=selected.household_id
      and goal.created_at::date<=selected.date_to and (goal.target_date is null or goal.target_date>=selected.date_from)),'[]'::jsonb)); end if;
  if selected.adviser_user_id=auth.uid() then
    insert into public.adviser_access_events(grant_id,household_id,actor_user_id,action)
    values(selected.id,selected.household_id,auth.uid(),'accessed') on conflict do nothing;
  end if;
  return result;
end $$;

create or replace function public.prevent_adviser_event_changes()
returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Adviser access history is append-only' using errcode='42501'; end $$;
create trigger adviser_events_append_only before update or delete on public.adviser_access_events
for each row execute function public.prevent_adviser_event_changes();

revoke all on function public.create_adviser_grant(text,text,date,date,text[],timestamptz,timestamptz,boolean,uuid),
  public.respond_to_adviser_grant(text,boolean),public.revoke_adviser_grant(uuid),
  public.retrieve_adviser_grants(),public.retrieve_adviser_data(uuid),public.prevent_adviser_event_changes() from public,anon;
grant execute on function public.create_adviser_grant(text,text,date,date,text[],timestamptz,timestamptz,boolean,uuid),
  public.respond_to_adviser_grant(text,boolean),public.revoke_adviser_grant(uuid),
  public.retrieve_adviser_grants(),public.retrieve_adviser_data(uuid) to authenticated;
