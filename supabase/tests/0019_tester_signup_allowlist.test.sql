begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into buddy_budget_private.tester_signup_allowlist(email, created_at, expires_at) values
  ('allowed@test.local', now(), now() + interval '1 day'),
  ('expired@test.local', now() - interval '2 days', now() - interval '1 day');

select is(
  public.authorize_tester_signup('{"user":{"email":"ALLOWED@test.local","user_metadata":{"testing_terms_acknowledged_version":"draft-0.1","privacy_notice_seen_version":"draft-0.1"}}}'::jsonb),
  '{}'::jsonb,
  'An active allowlisted email is accepted case-insensitively'
);
select is(
  public.authorize_tester_signup('{"user":{"email":"allowed@test.local"}}'::jsonb)->'error'->>'http_code',
  '403',
  'An allowlisted email without the required acknowledgement is rejected'
);
select is(
  public.authorize_tester_signup('{"user":{"email":"unknown@test.local"}}'::jsonb)->'error'->>'http_code',
  '403',
  'An email absent from the allowlist is rejected'
);
select is(
  public.authorize_tester_signup('{"user":{"email":"expired@test.local"}}'::jsonb)->'error'->>'http_code',
  '403',
  'An expired allowlist entry is rejected'
);
select is(
  public.authorize_tester_signup('{"user":{}}'::jsonb)->'error'->>'http_code',
  '403',
  'A signup without an email is rejected'
);
select ok(
  has_function_privilege('supabase_auth_admin', 'public.authorize_tester_signup(jsonb)', 'execute'),
  'Supabase Auth can execute the admission hook'
);
select ok(
  not has_function_privilege('anon', 'public.authorize_tester_signup(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.authorize_tester_signup(jsonb)', 'execute'),
  'Browser roles cannot execute the admission hook'
);
select ok(
  not has_schema_privilege('anon', 'buddy_budget_private', 'usage')
  and not has_schema_privilege('authenticated', 'buddy_budget_private', 'usage'),
  'Browser roles cannot use the private schema'
);
select ok(
  not has_table_privilege('anon', 'buddy_budget_private.tester_signup_allowlist', 'select')
  and not has_table_privilege('authenticated', 'buddy_budget_private.tester_signup_allowlist', 'select'),
  'Browser roles cannot read tester email entries'
);

select * from finish();
rollback;
