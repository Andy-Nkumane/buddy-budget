alter function public.retrieve_adviser_data(uuid)
rename to retrieve_adviser_data_authorized;

revoke all on function public.retrieve_adviser_data_authorized(uuid) from public,anon,authenticated;

create function public.retrieve_adviser_data(requested_grant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.session_meets_mfa_requirement() then
    raise exception 'Complete your authenticator challenge before accessing financial data'
      using errcode='42501';
  end if;
  return public.retrieve_adviser_data_authorized(requested_grant_id);
end;
$$;

revoke all on function public.retrieve_adviser_data(uuid) from public,anon;
grant execute on function public.retrieve_adviser_data(uuid) to authenticated;

