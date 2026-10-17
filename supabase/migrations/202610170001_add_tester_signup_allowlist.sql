create schema if not exists buddy_budget_private;

revoke all on schema buddy_budget_private from public, anon, authenticated;

create table buddy_budget_private.tester_signup_allowlist (
  email text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint tester_signup_allowlist_email_normalized
    check (email = lower(btrim(email)) and email like '%_@_%._%'),
  constraint tester_signup_allowlist_expiry_after_creation check (expires_at > created_at)
);

revoke all on buddy_budget_private.tester_signup_allowlist from public, anon, authenticated;
grant usage on schema buddy_budget_private to supabase_auth_admin;
grant select on buddy_budget_private.tester_signup_allowlist to supabase_auth_admin;

create or replace function public.authorize_tester_signup(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  candidate_email text := lower(btrim(event->'user'->>'email'));
  terms_version text := event->'user'->'user_metadata'->>'testing_terms_acknowledged_version';
  privacy_version text := event->'user'->'user_metadata'->>'privacy_notice_seen_version';
begin
  if candidate_email is not null and exists (
    select 1
    from buddy_budget_private.tester_signup_allowlist allowed
    where allowed.email = candidate_email
      and allowed.expires_at > now()
  ) and terms_version = 'draft-0.1' and privacy_version = 'draft-0.1' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This deployment is limited to authorised testers.'
    )
  );
end;
$$;

revoke all on function public.authorize_tester_signup(jsonb) from public, anon, authenticated;
grant execute on function public.authorize_tester_signup(jsonb) to supabase_auth_admin;
