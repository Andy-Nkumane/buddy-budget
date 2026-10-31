alter table public.financial_goals drop constraint financial_goals_status_check;
alter table public.financial_goals add constraint financial_goals_status_check
  check (status in ('active', 'paused', 'completed', 'cancelled', 'archived'));

alter table public.financial_goals
  add column contribution_frequency text not null default 'monthly'
    check (contribution_frequency in ('daily', 'weekly', 'fortnightly', 'monthly')),
  add column contribution_start_mode text not null default 'this_month'
    check (contribution_start_mode in ('this_month', 'next_month')),
  add column contribution_start_date date,
  add column desired_contribution_minor bigint
    check (desired_contribution_minor between 1 and 99999999999999);

update public.financial_goals set
  contribution_start_date = date_trunc('month', created_at)::date,
  desired_contribution_minor = desired_monthly_contribution_minor;
alter table public.financial_goals alter column contribution_start_date set not null;
alter table public.financial_goals alter column contribution_start_date set default current_date;

create or replace function public.goal_occurrence_count(
  requested_start date,
  requested_frequency text,
  requested_from date,
  requested_to date
)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  occurrence date := requested_start;
  occurrence_index integer := 0;
  result integer := 0;
  target_month date;
begin
  if requested_to < requested_from or requested_to < requested_start then return 0; end if;
  while occurrence <= requested_to and occurrence_index < 11000 loop
    if occurrence >= requested_from then result := result + 1; end if;
    occurrence_index := occurrence_index + 1;
    if requested_frequency = 'daily' then occurrence := requested_start + occurrence_index;
    elsif requested_frequency = 'weekly' then occurrence := requested_start + occurrence_index * 7;
    elsif requested_frequency = 'fortnightly' then occurrence := requested_start + occurrence_index * 14;
    else
      target_month := (date_trunc('month', requested_start) + (occurrence_index || ' months')::interval)::date;
      occurrence := make_date(
        extract(year from target_month)::integer,
        extract(month from target_month)::integer,
        least(
          extract(day from requested_start)::integer,
          extract(day from (target_month + interval '1 month - 1 day'))::integer
        )
      );
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.goal_recommended_amount(
  requested_goal public.financial_goals,
  requested_month_start date,
  requested_contributed_minor bigint
)
returns bigint
language plpgsql
stable
set search_path = ''
as $$
declare
  remaining_minor bigint := greatest(
    requested_goal.target_amount_minor - requested_contributed_minor -
      case when requested_goal.goal_type = 'debt_paydown' then 0 else requested_goal.starting_balance_minor end,
    0
  );
  month_end date := (requested_month_start + interval '1 month - 1 day')::date;
  month_occurrences integer;
  remaining_occurrences integer;
  per_occurrence bigint;
begin
  if requested_goal.status <> 'active' or remaining_minor = 0 then return 0; end if;
  month_occurrences := public.goal_occurrence_count(
    requested_goal.contribution_start_date, requested_goal.contribution_frequency,
    requested_month_start, month_end
  );
  if month_occurrences = 0 then return 0; end if;
  per_occurrence := coalesce(
    requested_goal.desired_contribution_minor,
    requested_goal.desired_monthly_contribution_minor
  );
  if per_occurrence is null and requested_goal.target_date is not null then
    remaining_occurrences := public.goal_occurrence_count(
      requested_goal.contribution_start_date, requested_goal.contribution_frequency,
      greatest(requested_month_start, requested_goal.contribution_start_date), requested_goal.target_date
    );
    if remaining_occurrences > 0 then
      per_occurrence := ceil(remaining_minor::numeric / remaining_occurrences)::bigint;
    end if;
  end if;
  return least(remaining_minor, coalesce(per_occurrence, 0) * month_occurrences);
end;
$$;

revoke all on function public.goal_occurrence_count(date, text, date, date) from public, anon, authenticated;
revoke all on function public.goal_recommended_amount(public.financial_goals, date, bigint) from public, anon, authenticated;

create or replace function public.create_financial_goal(requested_goal jsonb)
returns setof public.financial_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household_id uuid := public.current_household_id();
  current_owner_id uuid := public.current_household_owner_id();
  created_goal public.financial_goals%rowtype;
  requested_target_date date := nullif(requested_goal->>'target_date', '')::date;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_household_role(current_household_id, array['owner', 'editor']) then
    raise exception 'This household role cannot create goals' using errcode = '42501';
  end if;
  if requested_target_date is not null and
    (requested_target_date < current_date or requested_target_date > current_date + interval '30 years') then
    raise exception 'Target date must be within the next 30 years' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    current_household_id::text || ':goal:' || lower(regexp_replace(btrim(requested_goal->>'name'), E'\\s+', ' ', 'g')),
    0
  ));
  if exists (
    select 1 from public.financial_goals goal
    where goal.household_id = current_household_id and goal.status in ('active', 'paused')
      and lower(regexp_replace(btrim(goal.name), E'\\s+', ' ', 'g')) =
        lower(regexp_replace(btrim(requested_goal->>'name'), E'\\s+', ' ', 'g'))
  ) then
    raise exception 'An ongoing or paused goal already uses this name' using errcode = '23505';
  end if;

  insert into public.financial_goals (
    user_id, household_id, name, goal_type, target_amount_minor, target_date,
    starting_balance_minor, desired_monthly_contribution_minor, desired_contribution_minor,
    contribution_frequency, contribution_start_mode, contribution_start_date,
    priority, status, category_id, account_id
  ) values (
    current_owner_id, current_household_id,
    regexp_replace(btrim(requested_goal->>'name'), E'\\s+', ' ', 'g'),
    requested_goal->>'goal_type', (requested_goal->>'target_amount_minor')::bigint,
    requested_target_date, coalesce((requested_goal->>'starting_balance_minor')::bigint, 0),
    nullif(requested_goal->>'desired_monthly_contribution_minor', '')::bigint,
    coalesce(
      nullif(requested_goal->>'desired_contribution_minor', '')::bigint,
      nullif(requested_goal->>'desired_monthly_contribution_minor', '')::bigint
    ),
    coalesce(nullif(requested_goal->>'contribution_frequency', ''), 'monthly'),
    coalesce(nullif(requested_goal->>'contribution_start_mode', ''), 'this_month'),
    coalesce(nullif(requested_goal->>'contribution_start_date', '')::date, current_date),
    coalesce((requested_goal->>'priority')::smallint, 3),
    case
      when requested_goal->>'goal_type' <> 'debt_paydown' and
        coalesce((requested_goal->>'starting_balance_minor')::bigint, 0) >=
          (requested_goal->>'target_amount_minor')::bigint then 'completed'
      else 'active'
    end,
    nullif(requested_goal->>'category_id', '')::uuid,
    nullif(requested_goal->>'account_id', '')::uuid
  ) returning * into created_goal;
  perform public.refresh_goal_recommendations(created_goal.id);
  return query select * from public.financial_goals where id = created_goal.id;
exception when unique_violation then
  raise exception 'An ongoing or paused goal already uses this name' using errcode = '23505';
end;
$$;

create or replace function public.update_financial_goal(requested_goal_id uuid, requested_goal jsonb)
returns setof public.financial_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household_id uuid := public.current_household_id();
  existing_goal public.financial_goals%rowtype;
  contributed_minor bigint;
  required_minor bigint;
  requested_target_date date := nullif(requested_goal->>'target_date', '')::date;
  requested_status text := requested_goal->>'status';
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_household_role(current_household_id, array['owner', 'editor']) then
    raise exception 'This household role cannot update goals' using errcode = '42501';
  end if;
  select * into existing_goal from public.financial_goals goal
    where goal.id = requested_goal_id and goal.household_id = current_household_id for update;
  if not found then raise exception 'Goal not found' using errcode = '42501'; end if;
  if requested_target_date is distinct from existing_goal.target_date and requested_target_date is not null and
    (requested_target_date < current_date or requested_target_date > current_date + interval '30 years') then
    raise exception 'Target date must be within the next 30 years' using errcode = '22023';
  end if;
  if requested_status not in ('active', 'paused', 'completed', 'cancelled', 'archived') then
    raise exception 'Invalid goal status' using errcode = '22023';
  end if;
  if requested_status in ('active', 'paused') then
    perform pg_advisory_xact_lock(hashtextextended(
      current_household_id::text || ':goal:' || lower(regexp_replace(btrim(requested_goal->>'name'), E'\\s+', ' ', 'g')),
      0
    ));
    if exists (
      select 1 from public.financial_goals goal
      where goal.household_id = current_household_id and goal.id <> requested_goal_id
        and goal.status in ('active', 'paused')
        and lower(regexp_replace(btrim(goal.name), E'\\s+', ' ', 'g')) =
          lower(regexp_replace(btrim(requested_goal->>'name'), E'\\s+', ' ', 'g'))
    ) then
      raise exception 'An ongoing or paused goal already uses this name' using errcode = '23505';
    end if;
  end if;

  select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
    from public.goal_contributions contribution where contribution.goal_id = requested_goal_id;
  required_minor := case when requested_goal->>'goal_type' = 'debt_paydown'
    then (requested_goal->>'target_amount_minor')::bigint
    else greatest(
      (requested_goal->>'target_amount_minor')::bigint -
      coalesce((requested_goal->>'starting_balance_minor')::bigint, 0), 0
    ) end;
  if requested_status = 'completed' and contributed_minor < required_minor then
    if existing_goal.status = 'completed' then
      requested_status := 'active';
    else
      raise exception 'A goal can be completed only after it is fully funded' using errcode = '23514';
    end if;
  end if;
  if contributed_minor >= required_minor then requested_status := 'completed'; end if;

  update public.financial_goals set
    name = regexp_replace(btrim(requested_goal->>'name'), E'\\s+', ' ', 'g'),
    goal_type = requested_goal->>'goal_type',
    target_amount_minor = (requested_goal->>'target_amount_minor')::bigint,
    target_date = requested_target_date,
    starting_balance_minor = coalesce((requested_goal->>'starting_balance_minor')::bigint, 0),
    desired_monthly_contribution_minor = nullif(requested_goal->>'desired_monthly_contribution_minor', '')::bigint,
    desired_contribution_minor = coalesce(
      nullif(requested_goal->>'desired_contribution_minor', '')::bigint,
      nullif(requested_goal->>'desired_monthly_contribution_minor', '')::bigint
    ),
    contribution_frequency = coalesce(nullif(requested_goal->>'contribution_frequency', ''), contribution_frequency),
    contribution_start_mode = coalesce(nullif(requested_goal->>'contribution_start_mode', ''), contribution_start_mode),
    contribution_start_date = coalesce(nullif(requested_goal->>'contribution_start_date', '')::date, contribution_start_date),
    priority = coalesce((requested_goal->>'priority')::smallint, 3), status = requested_status,
    category_id = nullif(requested_goal->>'category_id', '')::uuid,
    account_id = nullif(requested_goal->>'account_id', '')::uuid
  where id = requested_goal_id and household_id = current_household_id;
  perform public.refresh_goal_recommendations(requested_goal_id);
  return query select * from public.financial_goals where id = requested_goal_id;
exception when unique_violation then
  raise exception 'An ongoing or paused goal already uses this name' using errcode = '23505';
end;
$$;

create or replace function public.create_goal_contribution(
  requested_goal_id uuid,
  requested_budget_month_id uuid,
  requested_transaction_id uuid,
  requested_contribution_date date,
  requested_amount_minor bigint,
  requested_notes text default null
)
returns setof public.goal_contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household_id uuid := public.current_household_id();
  current_owner_id uuid := public.current_household_owner_id();
  created_contribution public.goal_contributions%rowtype;
  selected_goal public.financial_goals%rowtype;
  contributed_minor bigint;
  required_minor bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_household_role(current_household_id, array['owner', 'editor']) then
    raise exception 'This household role cannot add contributions' using errcode = '42501';
  end if;
  select * into selected_goal from public.financial_goals goal
    where goal.id = requested_goal_id and goal.household_id = current_household_id for update;
  if not found then raise exception 'Goal not found' using errcode = '42501'; end if;
  if selected_goal.status <> 'active' then
    raise exception 'Contributions can only be added to an ongoing goal' using errcode = '55000';
  end if;
  insert into public.goal_contributions (
    user_id, household_id, goal_id, budget_month_id, transaction_id, goal_name_snapshot,
    contribution_date, amount_minor, notes
  ) values (
    current_owner_id, current_household_id, requested_goal_id, requested_budget_month_id,
    requested_transaction_id, selected_goal.name, requested_contribution_date,
    requested_amount_minor, nullif(btrim(requested_notes), '')
  ) returning * into created_contribution;

  select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
    from public.goal_contributions contribution where contribution.goal_id = requested_goal_id;
  required_minor := case when selected_goal.goal_type = 'debt_paydown'
    then selected_goal.target_amount_minor
    else greatest(selected_goal.target_amount_minor - selected_goal.starting_balance_minor, 0) end;
  if contributed_minor >= required_minor then
    update public.financial_goals set status = 'completed'
      where id = requested_goal_id and household_id = current_household_id;
  end if;
  perform public.refresh_goal_recommendations(requested_goal_id);
  return query select * from public.goal_contributions where id = created_contribution.id;
end;
$$;

create or replace function public.delete_goal_contribution(requested_contribution_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household_id uuid := public.current_household_id();
  selected_goal_id uuid;
  selected_goal public.financial_goals%rowtype;
  contributed_minor bigint;
  required_minor bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.has_household_role(current_household_id, array['owner', 'editor']) then
    raise exception 'This household role cannot remove contributions' using errcode = '42501';
  end if;
  select goal_id into selected_goal_id from public.goal_contributions
    where id = requested_contribution_id and household_id = current_household_id for update;
  if not found then raise exception 'Contribution not found' using errcode = '42501'; end if;
  delete from public.goal_contributions
    where id = requested_contribution_id and household_id = current_household_id;
  select * into selected_goal from public.financial_goals where id = selected_goal_id for update;
  select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
    from public.goal_contributions contribution where contribution.goal_id = selected_goal_id;
  required_minor := case when selected_goal.goal_type = 'debt_paydown'
    then selected_goal.target_amount_minor
    else greatest(selected_goal.target_amount_minor - selected_goal.starting_balance_minor, 0) end;
  if selected_goal.status = 'completed' and contributed_minor < required_minor then
    update public.financial_goals set status = 'active' where id = selected_goal_id;
  end if;
  perform public.refresh_goal_recommendations(selected_goal_id);
end;
$$;

revoke all on function public.create_financial_goal(jsonb) from public;
revoke all on function public.update_financial_goal(uuid, jsonb) from public;
revoke all on function public.create_goal_contribution(uuid, uuid, uuid, date, bigint, text) from public;
revoke all on function public.delete_goal_contribution(uuid) from public;
grant execute on function public.create_financial_goal(jsonb) to authenticated;
grant execute on function public.update_financial_goal(uuid, jsonb) to authenticated;
grant execute on function public.create_goal_contribution(uuid, uuid, uuid, date, bigint, text) to authenticated;
grant execute on function public.delete_goal_contribution(uuid) to authenticated;

do $$
declare definition text;
begin
  select pg_get_functiondef('public.create_backup_recovery_payload_household_internal(uuid)'::regprocedure)
    into definition;
  if position('''schema_version'',11' in definition) = 0 then
    raise exception 'Backup payload schema marker was not found';
  end if;
  execute replace(definition, '''schema_version'',11', '''schema_version'',12');

  select pg_get_functiondef('public.restore_backup_household_internal(jsonb,text,text,text)'::regprocedure)
    into definition;
  if position('<>11' in definition) = 0 then
    raise exception 'Restore schema validator was not found';
  end if;
  definition := replace(definition, '<>11', '<>12');
  definition := replace(definition, 'values(current_user_id,requested_fingerprint,11,', 'values(current_user_id,requested_fingerprint,12,');
  definition := replace(definition, 'values(current_user_id,restore_run.id,11,', 'values(current_user_id,restore_run.id,12,');
  execute definition;
end;
$$;
