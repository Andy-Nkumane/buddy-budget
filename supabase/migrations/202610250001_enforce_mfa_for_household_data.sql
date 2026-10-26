create or replace function public.session_meets_mfa_requirement()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select auth.uid() is not null
    and (
      coalesce(auth.jwt()->>'aal','aal1')='aal2'
      or not exists(
        select 1
        from auth.mfa_factors factor
        where factor.user_id=auth.uid()
          and factor.status='verified'
      )
    );
$$;

revoke all on function public.session_meets_mfa_requirement() from public,anon;
grant execute on function public.session_meets_mfa_requirement() to authenticated;

create or replace function public.has_household_role(requested_household_id uuid,allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select public.session_meets_mfa_requirement()
    and exists(
      select 1
      from public.household_memberships membership
      where membership.household_id=requested_household_id
        and membership.user_id=auth.uid()
        and membership.role=any(allowed_roles)
    );
$$;

