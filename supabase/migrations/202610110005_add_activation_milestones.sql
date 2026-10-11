create table public.activation_milestones (
  id uuid primary key default gen_random_uuid(),
  milestone_key text not null check (milestone_key in (
    'first_budget','first_categorisation','first_month_close','first_goal_contribution','first_export','first_restore'
  )),
  scope_type text not null check (scope_type in ('user','household')),
  scope_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (milestone_key,scope_type,scope_id),
  check ((scope_type='user' and scope_id=user_id and household_id is null)
    or (scope_type='household' and scope_id=household_id and household_id is not null))
);

alter table public.activation_milestones enable row level security;
create policy activation_milestones_select on public.activation_milestones
for select to authenticated using (
  (scope_type='user' and user_id=auth.uid())
  or (scope_type='household' and household_id=public.current_household_id()
    and public.has_household_role(household_id,array['owner','editor','viewer']))
);
revoke all on public.activation_milestones from public,anon,authenticated;
grant select on public.activation_milestones to authenticated;

create or replace function public.claim_activation_milestone(requested_key text)
returns boolean language plpgsql security definer set search_path='' as $$
declare
  current_user_id uuid:=auth.uid();
  household uuid:=public.current_household_id();
  household_scoped boolean:=requested_key in (
    'first_budget','first_categorisation','first_month_close','first_goal_contribution'
  );
  inserted_count integer;
begin
  if current_user_id is null or requested_key not in (
    'first_budget','first_categorisation','first_month_close','first_goal_contribution','first_export','first_restore'
  ) then raise exception 'Invalid milestone request' using errcode='22023'; end if;
  if household_scoped and (household is null or not public.has_household_role(
    household,array['owner','editor']
  )) then raise exception 'This household role cannot claim milestones' using errcode='42501'; end if;
  if requested_key='first_budget' and not exists(
    select 1 from public.onboarding_activations where household_id=household
  ) then raise exception 'Milestone requirements not met' using errcode='55000'; end if;
  if requested_key='first_categorisation' and not exists(
    select 1 from public.budget_transactions
    where household_id=household and category_id is not null
  ) then raise exception 'Milestone requirements not met' using errcode='55000'; end if;
  if requested_key='first_month_close' and not exists(
    select 1 from public.budget_month_lifecycle
    where household_id=household and state='closed'
  ) then raise exception 'Milestone requirements not met' using errcode='55000'; end if;
  if requested_key='first_goal_contribution' and not exists(
    select 1 from public.goal_contributions where household_id=household
  ) then raise exception 'Milestone requirements not met' using errcode='55000'; end if;
  if requested_key='first_restore' and not exists(
    select 1 from public.backup_restore_runs
    where user_id=current_user_id and status='completed'
  ) then raise exception 'Milestone requirements not met' using errcode='55000'; end if;

  insert into public.activation_milestones(
    milestone_key,scope_type,scope_id,user_id,household_id
  ) values(
    requested_key,
    case when household_scoped then 'household' else 'user' end,
    case when household_scoped then household else current_user_id end,
    current_user_id,
    case when household_scoped then household else null end
  ) on conflict (milestone_key,scope_type,scope_id) do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count=1;
end $$;

revoke all on function public.claim_activation_milestone(text) from public,anon;
grant execute on function public.claim_activation_milestone(text) to authenticated;
