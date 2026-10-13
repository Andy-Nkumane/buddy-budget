create table public.financial_goals (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  goal_type text not null check (goal_type in ('savings', 'sinking_fund', 'debt_paydown')),
  target_amount_minor bigint not null check (target_amount_minor between 1 and 99999999999999),
  target_date date,
  starting_balance_minor bigint not null default 0 check (starting_balance_minor between 0 and 99999999999999),
  desired_monthly_contribution_minor bigint check (desired_monthly_contribution_minor between 1 and 99999999999999),
  priority smallint not null default 3 check (priority between 1 and 5),
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  category_id uuid,
  account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint financial_goals_owned_category_fk foreign key (category_id, user_id)
    references public.categories(id, user_id) on delete set null (category_id),
  constraint financial_goals_owned_account_fk foreign key (account_id, user_id)
    references public.financial_accounts(id, user_id) on delete set null (account_id),
  constraint financial_goals_debt_balance_check check (
    goal_type <> 'debt_paydown' or target_amount_minor <= starting_balance_minor
  )
);

create table public.goal_contributions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  budget_month_id uuid not null,
  transaction_id uuid,
  goal_name_snapshot text not null check (char_length(btrim(goal_name_snapshot)) between 1 and 100),
  contribution_date date not null,
  amount_minor bigint not null check (amount_minor between 1 and 99999999999999),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint goal_contributions_owned_goal_fk foreign key (goal_id, user_id)
    references public.financial_goals(id, user_id) on delete restrict,
  constraint goal_contributions_owned_month_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete restrict,
  constraint goal_contributions_owned_transaction_fk foreign key (transaction_id, user_id)
    references public.budget_transactions(id, user_id) on delete restrict
);

create table public.goal_month_recommendations (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null,
  budget_month_id uuid not null,
  name_snapshot text not null check (char_length(btrim(name_snapshot)) between 1 and 100),
  goal_type text not null check (goal_type in ('savings', 'sinking_fund', 'debt_paydown')),
  recommended_amount_minor bigint not null check (recommended_amount_minor between 0 and 99999999999999),
  priority smallint not null check (priority between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (goal_id, budget_month_id),
  constraint goal_recommendations_owned_goal_fk foreign key (goal_id, user_id)
    references public.financial_goals(id, user_id) on delete restrict,
  constraint goal_recommendations_owned_month_fk foreign key (budget_month_id, user_id)
    references public.budget_months(id, user_id) on delete restrict
);

create index financial_goals_user_status_idx on public.financial_goals(user_id, status, priority, target_date, id);
create index goal_contributions_goal_date_idx on public.goal_contributions(goal_id, contribution_date, id);
create index goal_contributions_month_idx on public.goal_contributions(budget_month_id, contribution_date, id);
create unique index goal_contributions_transaction_unique_idx
  on public.goal_contributions(transaction_id) where transaction_id is not null;
create index goal_recommendations_month_idx on public.goal_month_recommendations(budget_month_id, priority, id);

create trigger financial_goals_set_updated_at before update on public.financial_goals
  for each row execute function public.set_updated_at();
create trigger goal_contributions_set_updated_at before update on public.goal_contributions
  for each row execute function public.set_updated_at();
create trigger goal_recommendations_set_updated_at before update on public.goal_month_recommendations
  for each row execute function public.set_updated_at();

alter table public.financial_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.goal_month_recommendations enable row level security;

create policy financial_goals_select_own on public.financial_goals for select to authenticated
  using ((select auth.uid()) = user_id);
create policy goal_contributions_select_own on public.goal_contributions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy goal_recommendations_select_own on public.goal_month_recommendations for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.financial_goals from anon, authenticated;
revoke all on public.goal_contributions from anon, authenticated;
revoke all on public.goal_month_recommendations from anon, authenticated;
grant select on public.financial_goals to authenticated;
grant select on public.goal_contributions to authenticated;
grant select on public.goal_month_recommendations to authenticated;

create or replace function public.validate_financial_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare contributed_minor bigint;
begin
  if tg_op = 'UPDATE' then
    select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
      from public.goal_contributions contribution where contribution.goal_id = new.id;
    if contributed_minor > (case
      when new.goal_type = 'debt_paydown' then new.target_amount_minor
      else greatest(new.target_amount_minor - new.starting_balance_minor, 0)
    end) then
      raise exception 'Target or starting balance conflicts with recorded contributions' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger financial_goals_validate before insert or update on public.financial_goals
  for each row execute function public.validate_financial_goal();

create or replace function public.validate_goal_contribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_month public.budget_months%rowtype;
  selected_goal public.financial_goals%rowtype;
  contributed_minor bigint;
begin
  select * into selected_month from public.budget_months month
    where month.id = new.budget_month_id and month.user_id = new.user_id;
  if not found then raise exception 'Budget month not found' using errcode = '23514'; end if;
  if new.contribution_date < selected_month.month_start
    or new.contribution_date >= (selected_month.month_start + interval '1 month')::date then
    raise exception 'Contribution date must belong to its budget month' using errcode = '23514';
  end if;
  if new.transaction_id is not null and not exists (
    select 1 from public.budget_transactions entry
    where entry.id = new.transaction_id and entry.user_id = new.user_id
      and entry.budget_month_id = new.budget_month_id and entry.status = 'posted'
      and entry.amount_minor = new.amount_minor
  ) then raise exception 'Linked transaction must be owned, posted, in the same month, and match the contribution amount' using errcode = '23514'; end if;
  select * into selected_goal from public.financial_goals goal
    where goal.id = new.goal_id and goal.user_id = new.user_id;
  select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
    from public.goal_contributions contribution
    where contribution.goal_id = new.goal_id and contribution.id <> new.id;
  if contributed_minor + new.amount_minor > (case
    when selected_goal.goal_type = 'debt_paydown' then selected_goal.target_amount_minor
    else greatest(selected_goal.target_amount_minor - selected_goal.starting_balance_minor, 0)
  end) then
    raise exception 'Contribution exceeds the remaining goal amount' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger goal_contributions_validate before insert or update on public.goal_contributions
  for each row execute function public.validate_goal_contribution();
create trigger goal_contributions_enforce_editable before insert or update or delete on public.goal_contributions
  for each row execute function public.enforce_budget_transaction_editable();

create or replace function public.goal_recommended_amount(
  requested_goal public.financial_goals,
  requested_month_start date,
  requested_contributed_minor bigint
)
returns bigint
language sql
stable
set search_path = ''
as $$
  select case
    when requested_goal.status <> 'active' then 0
    else least(
      greatest(
        requested_goal.target_amount_minor - requested_contributed_minor
          - case when requested_goal.goal_type = 'debt_paydown' then 0 else requested_goal.starting_balance_minor end,
        0
      ),
      coalesce(
        requested_goal.desired_monthly_contribution_minor,
        case when requested_goal.target_date is null then 0 else
          ceil(
            greatest(
              requested_goal.target_amount_minor - requested_contributed_minor
                - case when requested_goal.goal_type = 'debt_paydown' then 0 else requested_goal.starting_balance_minor end,
              0
            )::numeric /
            greatest(
              1,
              ((extract(year from requested_goal.target_date)::int - extract(year from requested_month_start)::int) * 12)
              + extract(month from requested_goal.target_date)::int - extract(month from requested_month_start)::int + 1
            )
          )::bigint
        end
      )
    )
  end;
$$;

create or replace function public.refresh_goal_recommendations(requested_goal_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  selected_goal public.financial_goals%rowtype;
  selected_month public.budget_months%rowtype;
  contributed_minor bigint;
  refreshed_count integer := 0;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into selected_goal from public.financial_goals goal
    where goal.id = requested_goal_id and goal.user_id = current_user_id for update;
  if not found then raise exception 'Goal not found' using errcode = '42501'; end if;

  for selected_month in
    select month.* from public.budget_months month
    where month.user_id = current_user_id
    order by month.month_start
  loop
    begin
      perform public.assert_budget_month_editable(selected_month.month_start, current_user_id);
    exception when sqlstate '55000' then
      continue;
    end;
    select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
      from public.goal_contributions contribution
      where contribution.goal_id = selected_goal.id
        and contribution.contribution_date < (selected_month.month_start + interval '1 month')::date;
    if selected_goal.status = 'active' and (selected_goal.target_date is null or selected_goal.target_date >= selected_month.month_start) then
      insert into public.goal_month_recommendations (
        user_id, goal_id, budget_month_id, name_snapshot, goal_type,
        recommended_amount_minor, priority
      ) values (
        current_user_id, selected_goal.id, selected_month.id, selected_goal.name, selected_goal.goal_type,
        public.goal_recommended_amount(selected_goal, selected_month.month_start, contributed_minor), selected_goal.priority
      ) on conflict (goal_id, budget_month_id) do update set
        name_snapshot = excluded.name_snapshot,
        goal_type = excluded.goal_type,
        recommended_amount_minor = excluded.recommended_amount_minor,
        priority = excluded.priority;
      refreshed_count := refreshed_count + 1;
    else
      delete from public.goal_month_recommendations recommendation
        where recommendation.goal_id = selected_goal.id
          and recommendation.budget_month_id = selected_month.id;
    end if;
  end loop;
  return refreshed_count;
end;
$$;

create or replace function public.create_financial_goal(requested_goal jsonb)
returns setof public.financial_goals
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  created_goal public.financial_goals%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.financial_goals (
    user_id, name, goal_type, target_amount_minor, target_date, starting_balance_minor,
    desired_monthly_contribution_minor, priority, category_id, account_id
  ) values (
    current_user_id, btrim(requested_goal->>'name'), requested_goal->>'goal_type',
    (requested_goal->>'target_amount_minor')::bigint, nullif(requested_goal->>'target_date', '')::date,
    coalesce((requested_goal->>'starting_balance_minor')::bigint, 0),
    nullif(requested_goal->>'desired_monthly_contribution_minor', '')::bigint,
    coalesce((requested_goal->>'priority')::smallint, 3),
    nullif(requested_goal->>'category_id', '')::uuid, nullif(requested_goal->>'account_id', '')::uuid
  ) returning * into created_goal;
  perform public.refresh_goal_recommendations(created_goal.id);
  return query select * from public.financial_goals where id = created_goal.id;
end;
$$;

create or replace function public.update_financial_goal(requested_goal_id uuid, requested_goal jsonb)
returns setof public.financial_goals
language plpgsql
security definer
set search_path = ''
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.financial_goals set
    name = btrim(requested_goal->>'name'), goal_type = requested_goal->>'goal_type',
    target_amount_minor = (requested_goal->>'target_amount_minor')::bigint,
    target_date = nullif(requested_goal->>'target_date', '')::date,
    starting_balance_minor = coalesce((requested_goal->>'starting_balance_minor')::bigint, 0),
    desired_monthly_contribution_minor = nullif(requested_goal->>'desired_monthly_contribution_minor', '')::bigint,
    priority = coalesce((requested_goal->>'priority')::smallint, 3),
    status = requested_goal->>'status', category_id = nullif(requested_goal->>'category_id', '')::uuid,
    account_id = nullif(requested_goal->>'account_id', '')::uuid
  where id = requested_goal_id and user_id = current_user_id;
  if not found then raise exception 'Goal not found' using errcode = '42501'; end if;
  perform public.refresh_goal_recommendations(requested_goal_id);
  return query select * from public.financial_goals where id = requested_goal_id;
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
  current_user_id uuid := auth.uid();
  created_contribution public.goal_contributions%rowtype;
  selected_goal public.financial_goals%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into selected_goal from public.financial_goals goal
    where goal.id = requested_goal_id and goal.user_id = current_user_id for update;
  if not found then raise exception 'Goal not found' using errcode = '42501'; end if;
  if selected_goal.status <> 'active' then
    raise exception 'Contributions can only be added to an active goal' using errcode = '55000';
  end if;
  insert into public.goal_contributions (
    user_id, goal_id, budget_month_id, transaction_id, goal_name_snapshot,
    contribution_date, amount_minor, notes
  ) values (
    current_user_id, requested_goal_id, requested_budget_month_id, requested_transaction_id,
    selected_goal.name, requested_contribution_date, requested_amount_minor, nullif(btrim(requested_notes), '')
  ) returning * into created_contribution;
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
declare current_user_id uuid := auth.uid(); selected_goal_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select goal_id into selected_goal_id from public.goal_contributions
    where id = requested_contribution_id and user_id = current_user_id for update;
  if not found then raise exception 'Contribution not found' using errcode = '42501'; end if;
  delete from public.goal_contributions where id = requested_contribution_id and user_id = current_user_id;
  perform public.refresh_goal_recommendations(selected_goal_id);
end;
$$;

create or replace function public.snapshot_goal_recommendations_for_month()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare selected_goal public.financial_goals%rowtype; contributed_minor bigint;
begin
  for selected_goal in select * from public.financial_goals goal
    where goal.user_id = new.user_id and goal.status = 'active'
      and (goal.target_date is null or goal.target_date >= new.month_start)
  loop
    select coalesce(sum(contribution.amount_minor), 0) into contributed_minor
      from public.goal_contributions contribution
      where contribution.goal_id = selected_goal.id
        and contribution.contribution_date < (new.month_start + interval '1 month')::date;
    insert into public.goal_month_recommendations (
      user_id, goal_id, budget_month_id, name_snapshot, goal_type, recommended_amount_minor, priority
    ) values (
      new.user_id, selected_goal.id, new.id, selected_goal.name, selected_goal.goal_type,
      public.goal_recommended_amount(selected_goal, new.month_start, contributed_minor), selected_goal.priority
    ) on conflict (goal_id, budget_month_id) do nothing;
  end loop;
  return new;
end;
$$;

create trigger budget_months_snapshot_goal_recommendations
  after insert on public.budget_months
  for each row execute function public.snapshot_goal_recommendations_for_month();

revoke all on function public.goal_recommended_amount(public.financial_goals, date, bigint) from public, anon, authenticated;
revoke all on function public.refresh_goal_recommendations(uuid) from public;
revoke all on function public.create_financial_goal(jsonb) from public;
revoke all on function public.update_financial_goal(uuid, jsonb) from public;
revoke all on function public.create_goal_contribution(uuid, uuid, uuid, date, bigint, text) from public;
revoke all on function public.delete_goal_contribution(uuid) from public;
grant execute on function public.create_financial_goal(jsonb) to authenticated;
grant execute on function public.update_financial_goal(uuid, jsonb) to authenticated;
grant execute on function public.create_goal_contribution(uuid, uuid, uuid, date, bigint, text) to authenticated;
grant execute on function public.delete_goal_contribution(uuid) to authenticated;
