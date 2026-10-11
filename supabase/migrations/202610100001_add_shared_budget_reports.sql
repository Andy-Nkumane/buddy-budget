create table public.shared_budget_reports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  access_code_hash text check (access_code_hash is null or access_code_hash ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  expires_at timestamptz not null,
  max_views integer check (max_views is null or max_views between 1 and 10000),
  view_count integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '90 days'),
  check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 1048576)
);

create index shared_budget_reports_household_idx
on public.shared_budget_reports(household_id,created_at desc);
create index shared_budget_reports_expiry_idx
on public.shared_budget_reports(expires_at)
where revoked_at is null;

alter table public.shared_budget_reports enable row level security;

create policy shared_budget_reports_owner_select on public.shared_budget_reports
for select to authenticated
using (public.has_household_role(household_id,array['owner']));

revoke all on public.shared_budget_reports from public,anon,authenticated;
grant select on public.shared_budget_reports to authenticated;

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
    or (shared_report.max_views is not null and shared_report.view_count >= shared_report.max_views)
    or (shared_report.access_code_hash is not null
      and shared_report.access_code_hash is distinct from requested_access_code_hash) then
    return null;
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

create or replace function public.prevent_shared_report_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.household_id<>old.household_id
    or new.created_by<>old.created_by
    or new.token_hash<>old.token_hash
    or new.access_code_hash is distinct from old.access_code_hash
    or new.snapshot<>old.snapshot
    or new.expires_at<>old.expires_at
    or new.max_views is distinct from old.max_views
    or new.created_at<>old.created_at then
    raise exception 'Shared report snapshots are immutable' using errcode='55000';
  end if;
  return new;
end $$;

create trigger shared_budget_reports_immutable
before update on public.shared_budget_reports
for each row execute function public.prevent_shared_report_mutation();

revoke all on function public.prevent_shared_report_mutation() from public,anon,authenticated;
revoke all on public.shared_budget_reports from anon;

create or replace function public.require_shared_report_owner(requested_user_id uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare household uuid;
begin
  select profile.active_household_id into household
  from public.profiles profile
  join public.household_memberships membership
    on membership.household_id=profile.active_household_id
    and membership.user_id=profile.user_id
    and membership.role='owner'
  where profile.user_id=requested_user_id;
  if household is null then
    raise exception 'Shared report management requires the active household owner' using errcode='42501';
  end if;
  return household;
end $$;

create or replace function public.create_shared_budget_report(
  requested_user_id uuid,
  requested_token_hash text,
  requested_access_code_hash text,
  requested_snapshot jsonb,
  requested_expires_at timestamptz,
  requested_max_views integer
)
returns table(id uuid,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare household uuid:=public.require_shared_report_owner(requested_user_id);
begin
  return query insert into public.shared_budget_reports(
    household_id,created_by,token_hash,access_code_hash,snapshot,expires_at,max_views
  ) values(
    household,requested_user_id,requested_token_hash,requested_access_code_hash,
    requested_snapshot,requested_expires_at,requested_max_views
  ) returning shared_budget_reports.id,shared_budget_reports.expires_at;
end $$;

create or replace function public.retrieve_shared_budget_reports(requested_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare household uuid:=public.require_shared_report_owner(requested_user_id); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',report.id,'rangeLabel',report.snapshot->>'rangeLabel','expiresAt',report.expires_at,
    'maxViews',report.max_views,'viewCount',report.view_count,'lastViewedAt',report.last_viewed_at,
    'revokedAt',report.revoked_at,'createdAt',report.created_at
  ) order by report.created_at desc),'[]'::jsonb)
  into result
  from (
    select * from public.shared_budget_reports
    where household_id=household
    order by created_at desc limit 100
  ) report;
  return result;
end
$$;

create or replace function public.revoke_shared_budget_report(requested_user_id uuid,requested_report_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare household uuid:=public.require_shared_report_owner(requested_user_id); changed_count integer;
begin
  update public.shared_budget_reports set revoked_at=now()
  where id=requested_report_id and household_id=household and revoked_at is null;
  get diagnostics changed_count=row_count;
  return changed_count=1;
end $$;

revoke all on function public.require_shared_report_owner(uuid) from public,anon,authenticated;
revoke all on function public.create_shared_budget_report(uuid,text,text,jsonb,timestamptz,integer) from public,anon,authenticated;
revoke all on function public.retrieve_shared_budget_reports(uuid) from public,anon,authenticated;
revoke all on function public.revoke_shared_budget_report(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_shared_budget_report(uuid,text,text,jsonb,timestamptz,integer) to service_role;
grant execute on function public.retrieve_shared_budget_reports(uuid) to service_role;
grant execute on function public.revoke_shared_budget_report(uuid,uuid) to service_role;
