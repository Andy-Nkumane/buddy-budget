create or replace function public.consume_shared_budget_report(
  requested_token_hash text,
  requested_access_code_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  shared_report public.shared_budget_reports%rowtype;
begin
  if requested_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into shared_report
  from public.shared_budget_reports
  where token_hash=requested_token_hash
  for update;
  if not found
    or shared_report.revoked_at is not null
    or shared_report.expires_at <= now()
    or (shared_report.max_views is not null and shared_report.view_count >= shared_report.max_views) then
    return null;
  end if;
  if shared_report.access_code_hash is not null
    and shared_report.access_code_hash is distinct from requested_access_code_hash then
    return jsonb_build_object('access_code_required',true);
  end if;
  update public.shared_budget_reports
  set view_count=view_count+1,last_viewed_at=now()
  where id=shared_report.id;
  return jsonb_build_object(
    'snapshot',shared_report.snapshot,
    'expires_at',shared_report.expires_at,
    'remaining_views',case when shared_report.max_views is null then null
      else shared_report.max_views-shared_report.view_count-1 end
  );
end $$;

revoke all on function public.consume_shared_budget_report(text,text) from public,anon,authenticated;
grant execute on function public.consume_shared_budget_report(text,text) to service_role;
