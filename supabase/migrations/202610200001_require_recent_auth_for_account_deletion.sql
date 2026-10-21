create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  current_user_id uuid:=auth.uid();
  blocked_household text;
  recent_password_at bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select coalesce(max((method->>'timestamp')::bigint),0)
  into recent_password_at
  from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method
  where method->>'method'='password';

  if recent_password_at<extract(epoch from now()-interval '10 minutes')::bigint then
    raise exception 'Re-enter your password before deleting your account' using errcode='42501';
  end if;

  select household.name into blocked_household from public.households household
  where (household.owner_user_id=current_user_id or household.data_owner_user_id=current_user_id)
    and exists(select 1 from public.household_memberships membership
      where membership.household_id=household.id and membership.user_id<>current_user_id)
  limit 1;
  if blocked_household is not null then
    raise exception 'Transfer ownership and remove or relocate all members from % before deleting your account',blocked_household using errcode='23514';
  end if;
  insert into public.household_deletion_execution(transaction_id,user_id) values(txid_current(),current_user_id);
  insert into public.backup_restore_execution(transaction_id,user_id) values(txid_current(),current_user_id) on conflict do nothing;
  delete from public.household_memberships where user_id=current_user_id;
  delete from public.households where owner_user_id=current_user_id or data_owner_user_id=current_user_id;
  delete from auth.users where id=current_user_id;
end $$;

revoke all on function public.delete_own_account() from public,anon;
grant execute on function public.delete_own_account() to authenticated;
