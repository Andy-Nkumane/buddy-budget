create index budget_month_items_insights_idx
  on public.budget_month_items(user_id, budget_month_id, category_id, item_type)
  include (amount)
  where archived_at is null and not is_disabled;

create index budget_transactions_insights_idx
  on public.budget_transactions(user_id, budget_month_id, status, category_id, transaction_type)
  include (amount_minor, is_refund, transaction_date);

create index budget_transactions_recurring_insights_idx
  on public.budget_transactions(user_id, transaction_date, transaction_type, description)
  include (amount_minor, is_refund, budget_month_id, category_id)
  where status = 'posted' and is_recurring_candidate;

create or replace function public.retrieve_budget_insights(
  requested_from_month date,
  requested_to_month date,
  requested_category_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_from_month is null or requested_to_month is null
    or requested_from_month <> date_trunc('month', requested_from_month)::date
    or requested_to_month <> date_trunc('month', requested_to_month)::date then
    raise exception 'Insight boundaries must be first-of-month dates' using errcode = '22023';
  end if;
  if requested_from_month > requested_to_month then
    raise exception 'Insight start month must not follow the end month' using errcode = '22023';
  end if;
  if ((extract(year from age(requested_to_month, requested_from_month)) * 12)
      + extract(month from age(requested_to_month, requested_from_month))) >= 60 then
    raise exception 'Insight ranges are limited to 60 months' using errcode = '22023';
  end if;
  if requested_category_id is not null and not exists (
    select 1 from public.categories category
    where category.id = requested_category_id and category.user_id = current_user_id
  ) then
    raise exception 'Category not found' using errcode = '42501';
  end if;

  with
  selected_months as (
    select month.id, month.month_start, month.currency_code
    from public.budget_months month
    where month.user_id = current_user_id
      and month.month_start between requested_from_month and requested_to_month
    order by month.month_start
  ),
  planned_monthly as (
    select item.budget_month_id,
      coalesce(sum(round(item.amount * 100)::bigint) filter (where item.item_type = 'income'), 0)::bigint planned_income_minor,
      coalesce(sum(round(item.amount * 100)::bigint) filter (where item.item_type = 'expense'), 0)::bigint planned_expenses_minor
    from public.budget_month_items item
    join selected_months month on month.id = item.budget_month_id
    where item.user_id = current_user_id and item.archived_at is null and not item.is_disabled
      and (requested_category_id is null or item.category_id = requested_category_id)
    group by item.budget_month_id
  ),
  actual_monthly as (
    select entry.budget_month_id,
      coalesce(sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end)
        filter (where entry.transaction_type = 'income'), 0)::bigint actual_income_minor,
      coalesce(sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end)
        filter (where entry.transaction_type = 'expense'), 0)::bigint actual_expenses_minor
    from public.budget_transactions entry
    join selected_months month on month.id = entry.budget_month_id
    where entry.user_id = current_user_id and entry.status = 'posted'
      and (requested_category_id is null or entry.category_id = requested_category_id)
    group by entry.budget_month_id
  ),
  adjustment_monthly as (
    select adjustment.original_budget_month_id,
      coalesce(sum(case when adjustment.direction = 'increase' then adjustment.amount_minor else -adjustment.amount_minor end)
        filter (where adjustment.item_type = 'income'), 0)::bigint adjustment_income_minor,
      coalesce(sum(case when adjustment.direction = 'increase' then adjustment.amount_minor else -adjustment.amount_minor end)
        filter (where adjustment.item_type = 'expense'), 0)::bigint adjustment_expenses_minor
    from public.month_adjustments adjustment
    join selected_months month on month.id = adjustment.original_budget_month_id
    where adjustment.user_id = current_user_id and requested_category_id is null
    group by adjustment.original_budget_month_id
  ),
  monthly as (
    select month.id, month.month_start, month.currency_code,
      coalesce(planned.planned_income_minor, 0)::bigint planned_income_minor,
      coalesce(planned.planned_expenses_minor, 0)::bigint planned_expenses_minor,
      (coalesce(actual.actual_income_minor, 0) + coalesce(adjustment.adjustment_income_minor, 0))::bigint actual_income_minor,
      (coalesce(actual.actual_expenses_minor, 0) + coalesce(adjustment.adjustment_expenses_minor, 0))::bigint actual_expenses_minor,
      coalesce(adjustment.adjustment_income_minor, 0)::bigint adjustment_income_minor,
      coalesce(adjustment.adjustment_expenses_minor, 0)::bigint adjustment_expenses_minor
    from selected_months month
    left join planned_monthly planned on planned.budget_month_id = month.id
    left join actual_monthly actual on actual.budget_month_id = month.id
    left join adjustment_monthly adjustment on adjustment.original_budget_month_id = month.id
  ),
  category_planned as (
    select item.budget_month_id, item.category_id, item.item_type,
      min(coalesce(item.category_snapshot, category.name, 'Uncategorised')) category_name,
      sum(round(item.amount * 100)::bigint)::bigint planned_minor
    from public.budget_month_items item
    join selected_months month on month.id = item.budget_month_id
    left join public.categories category on category.id = item.category_id and category.user_id = item.user_id
    where item.user_id = current_user_id and item.archived_at is null and not item.is_disabled
      and (requested_category_id is null or item.category_id = requested_category_id)
    group by item.budget_month_id, item.category_id, item.item_type
  ),
  category_actual as (
    select entry.budget_month_id, entry.category_id, entry.transaction_type item_type,
      min(coalesce(entry.category_snapshot, category.name, 'Uncategorised')) category_name,
      sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end)::bigint actual_minor
    from public.budget_transactions entry
    join selected_months month on month.id = entry.budget_month_id
    left join public.categories category on category.id = entry.category_id and category.user_id = entry.user_id
    where entry.user_id = current_user_id and entry.status = 'posted'
      and (requested_category_id is null or entry.category_id = requested_category_id)
    group by entry.budget_month_id, entry.category_id, entry.transaction_type
  ),
  category_monthly as (
    select month.month_start, month.currency_code,
      coalesce(planned.category_id, actual.category_id) category_id,
      coalesce(planned.item_type, actual.item_type) item_type,
      coalesce(planned.category_name, actual.category_name) category_name,
      coalesce(planned.planned_minor, 0)::bigint planned_minor,
      coalesce(actual.actual_minor, 0)::bigint actual_minor
    from category_planned planned
    full join category_actual actual
      on actual.budget_month_id = planned.budget_month_id
      and actual.category_id is not distinct from planned.category_id
      and actual.item_type = planned.item_type
    join selected_months month on month.id = coalesce(planned.budget_month_id, actual.budget_month_id)
  ),
  category_totals as (
    select category_id, category_name, item_type, currency_code,
      sum(planned_minor)::bigint planned_minor,
      sum(actual_minor)::bigint actual_minor,
      round(sum(actual_minor)::numeric / count(distinct month_start))::bigint average_actual_minor,
      count(distinct month_start)::integer months_with_data,
      count(*) filter (where item_type = 'expense' and actual_minor > planned_minor)::integer overspent_months
    from category_monthly
    group by category_id, category_name, item_type, currency_code
  ),
  recurring_monthly as (
    select date_trunc('month', entry.transaction_date)::date month_start, month.currency_code,
      entry.transaction_type,
      lower(regexp_replace(btrim(entry.description), '\s+', ' ', 'g')) normalized_description,
      min(entry.description) display_description,
      sum(case when entry.is_refund then -entry.amount_minor else entry.amount_minor end)::bigint amount_minor
    from public.budget_transactions entry
    join selected_months month on month.id = entry.budget_month_id
    where entry.user_id = current_user_id and entry.status = 'posted' and entry.is_recurring_candidate
      and (requested_category_id is null or entry.category_id = requested_category_id)
    group by date_trunc('month', entry.transaction_date)::date, month.currency_code,
      entry.transaction_type, lower(regexp_replace(btrim(entry.description), '\s+', ' ', 'g'))
  ),
  recurring_compared as (
    select recurring.*,
      lag(month_start) over recurring_window previous_month,
      lag(amount_minor) over recurring_window previous_amount_minor
    from recurring_monthly recurring
    window recurring_window as (
      partition by currency_code, transaction_type, normalized_description order by month_start
    )
  ),
  recurring_changes_limited as (
    select * from recurring_compared
    where previous_amount_minor is not null and amount_minor <> previous_amount_minor
    order by month_start desc, abs(amount_minor - previous_amount_minor) desc
    limit 100
  ),
  discretionary_ranked as (
    select entry.id, entry.transaction_date, entry.description,
      coalesce(entry.category_snapshot, category.name, 'Uncategorised') category_name,
      month.currency_code, entry.amount_minor,
      row_number() over (partition by month.currency_code order by entry.amount_minor desc, entry.transaction_date desc, entry.id) currency_rank
    from public.budget_transactions entry
    join selected_months month on month.id = entry.budget_month_id
    left join public.categories category on category.id = entry.category_id and category.user_id = entry.user_id
    where entry.user_id = current_user_id and entry.status = 'posted'
      and entry.transaction_type = 'expense' and not entry.is_refund
      and (requested_category_id is null or entry.category_id = requested_category_id)
      and not exists (
        select 1 from public.payment_schedule_occurrences occurrence
        where occurrence.user_id = current_user_id and occurrence.matched_transaction_id = entry.id
      )
  ),
  largest_discretionary as (
    select id, transaction_date, description, category_name, currency_code, amount_minor
    from discretionary_ranked where currency_rank <= 10
  ),
  goal_progress as (
    select goal.id, goal.name, goal.goal_type, goal.status, goal.priority,
      profile.currency_code,
      goal.target_amount_minor,
      goal.starting_balance_minor,
      coalesce(sum(contribution.amount_minor) filter (
        where contribution.contribution_date < (requested_to_month + interval '1 month')::date
      ), 0)::bigint contributed_minor
    from public.financial_goals goal
    join public.profiles profile on profile.user_id = goal.user_id
    left join public.goal_contributions contribution
      on contribution.goal_id = goal.id and contribution.user_id = goal.user_id
    where goal.user_id = current_user_id and goal.status <> 'archived'
      and (requested_category_id is null or goal.category_id = requested_category_id)
    group by goal.id, profile.currency_code
  )
  select jsonb_build_object(
    'definitions_version', 1,
    'from_month', requested_from_month,
    'to_month', requested_to_month,
    'category_id', requested_category_id,
    'month_count', (select count(*) from selected_months),
    'currencies', coalesce((select jsonb_agg(distinct currency_code order by currency_code) from selected_months), '[]'::jsonb),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object(
      'month_start', month_start,
      'currency_code', currency_code,
      'planned_income_minor', planned_income_minor,
      'planned_expenses_minor', planned_expenses_minor,
      'actual_income_minor', actual_income_minor,
      'actual_expenses_minor', actual_expenses_minor,
      'income_variance_minor', actual_income_minor - planned_income_minor,
      'expense_variance_minor', actual_expenses_minor - planned_expenses_minor,
      'savings_minor', actual_income_minor - actual_expenses_minor,
      'savings_rate_basis_points', case when requested_category_id is null and actual_income_minor > 0
        then round(((actual_income_minor - actual_expenses_minor)::numeric * 10000) / actual_income_minor)::bigint else null end,
      'adjustment_income_minor', adjustment_income_minor,
      'adjustment_expenses_minor', adjustment_expenses_minor
    ) order by month_start) from monthly), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object(
      'category_id', category_id,
      'category_name', category_name,
      'item_type', item_type,
      'currency_code', currency_code,
      'planned_minor', planned_minor,
      'actual_minor', actual_minor,
      'variance_minor', actual_minor - planned_minor,
      'average_actual_minor', average_actual_minor,
      'months_with_data', months_with_data,
      'overspent_months', overspent_months
    ) order by currency_code, item_type, actual_minor desc, category_name) from category_totals), '[]'::jsonb),
    'recurring_changes', coalesce((select jsonb_agg(jsonb_build_object(
      'description', display_description,
      'transaction_type', transaction_type,
      'currency_code', currency_code,
      'previous_month', previous_month,
      'current_month', month_start,
      'previous_amount_minor', previous_amount_minor,
      'current_amount_minor', amount_minor,
      'change_minor', amount_minor - previous_amount_minor
    ) order by month_start desc, abs(amount_minor - previous_amount_minor) desc)
      from recurring_changes_limited), '[]'::jsonb),
    'largest_discretionary', coalesce((select jsonb_agg(to_jsonb(expense) order by expense.amount_minor desc, expense.transaction_date desc)
      from largest_discretionary expense), '[]'::jsonb),
    'income_stability', coalesce((select jsonb_agg(to_jsonb(stability) order by stability.currency_code)
      from (
        select currency_code,
          count(*)::integer months_observed,
          count(*) filter (where actual_income_minor <> 0)::integer months_with_income,
          round(avg(actual_income_minor))::bigint average_income_minor,
          min(actual_income_minor)::bigint minimum_income_minor,
          max(actual_income_minor)::bigint maximum_income_minor,
          case when requested_category_id is null and avg(actual_income_minor) > 0 and count(*) >= 3
            then round(((max(actual_income_minor) - min(actual_income_minor))::numeric * 10000) / avg(actual_income_minor))::bigint else null end range_basis_points
        from monthly group by currency_code
      ) stability), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(jsonb_build_object(
      'goal_id', id,
      'name', name,
      'goal_type', goal_type,
      'status', status,
      'priority', priority,
      'currency_code', currency_code,
      'target_amount_minor', target_amount_minor,
      'contributed_minor', contributed_minor,
      'achieved_minor', case when goal_type = 'debt_paydown' then contributed_minor else starting_balance_minor + contributed_minor end,
      'remaining_minor', greatest(0, target_amount_minor - case when goal_type = 'debt_paydown' then contributed_minor else starting_balance_minor + contributed_minor end),
      'progress_basis_points', least(10000, round((case when goal_type = 'debt_paydown' then contributed_minor else starting_balance_minor + contributed_minor end)::numeric * 10000 / target_amount_minor)::bigint)
    ) order by priority, name) from goal_progress), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.retrieve_budget_insights(date, date, uuid) from public, anon;
grant execute on function public.retrieve_budget_insights(date, date, uuid) to authenticated;
