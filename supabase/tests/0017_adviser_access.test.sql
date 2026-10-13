begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('fc100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-adviser@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('fc100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','adviser@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.budget_months(id,user_id,household_id,month_start,currency_code)
values
('fc200000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','2026-10-01','ZAR'),
('fc200000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','2026-11-01','ZAR');

set local role authenticated;
select set_config('request.jwt.claim.sub','fc100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fc100000-0000-4000-8000-000000000001','email','owner-adviser@test.local','role','authenticated')::text,true);
select lives_ok($$select public.create_adviser_grant('adviser@test.local',encode(extensions.digest('invite-one','sha256'),'hex'),
  '2026-10-01','2026-10-31',array['summary'],now(),now()+interval '7 days',false,null)$$,'Owner creates a minimum-scope grant');
select throws_ok($$select public.create_adviser_grant('adviser@test.local',encode(extensions.digest('bad-range','sha256'),'hex'),
  '2026-10-01','2029-01-01',array['summary'],now(),now()+interval '7 days',false,null)$$,'22023','Invalid adviser grant','Over-broad ranges are rejected');

select set_config('request.jwt.claim.sub','fc100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fc100000-0000-4000-8000-000000000002','email','adviser@test.local','role','authenticated')::text,true);
select is(public.respond_to_adviser_grant('invite-one',true) is not null,true,'Verified invited adviser accepts');
select is(jsonb_array_length(public.retrieve_adviser_grants()),1,'Adviser receives only their accepted grant through the sanitized RPC');
select is(jsonb_array_length(public.retrieve_adviser_grants()->0->'events'),0,'Adviser cannot receive owner audit history');
select is((public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)->'sections'->>0),'summary','The approved section is returned');
select is(jsonb_array_length(public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)->'summary'),1,'Rows outside the approved date range are absent');
select ok(not (public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid) ? 'transactions'),'Unapproved transaction details are absent');
select is((public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)->>'allowExport')::boolean,false,'Export remains disabled by default');
select is((select count(*)::integer from public.household_memberships where household_id='fc100000-0000-4000-8000-000000000001' and user_id='fc100000-0000-4000-8000-000000000002'),0,'Adviser is not made a household member');
select is((select count(*)::integer from public.budget_months where household_id='fc100000-0000-4000-8000-000000000001'),0,'Direct RLS queries reveal no granted household rows');
update public.budget_months set currency_code='USD' where id='fc200000-0000-4000-8000-000000000001';
select is(public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)->'summary'->0->>'currencyCode','ZAR','Direct updates cannot mutate granted data');
select throws_ok($$select public.revoke_adviser_grant((public.retrieve_adviser_grants()->0->>'id')::uuid)$$,'42501','Adviser grant unavailable','Adviser cannot revoke their own grant');

select set_config('request.jwt.claim.sub','fc100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fc100000-0000-4000-8000-000000000001','email','owner-adviser@test.local','role','authenticated')::text,true);
select ok(public.revoke_adviser_grant((public.retrieve_adviser_grants()->0->>'id')::uuid),'Owner revokes access');
select ok((public.retrieve_adviser_grants()->0->'events') @> '[{"action":"revoked"}]'::jsonb,'Revocation is appended to the visible audit trail');
select is(public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)->>'currencyCode','ZAR','Owner can open the scoped report from grant history');

select set_config('request.jwt.claim.sub','fc100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fc100000-0000-4000-8000-000000000002','email','adviser@test.local','role','authenticated')::text,true);
select throws_ok($$select public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)$$,'42501','Adviser access unavailable','Revocation takes effect immediately');
reset role;
update public.adviser_access_grants set revoked_at=null,starts_at=now()-interval '2 days',expires_at=now()-interval '1 day';
set local role authenticated;
select set_config('request.jwt.claim.sub','fc100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fc100000-0000-4000-8000-000000000002','email','adviser@test.local','role','authenticated')::text,true);
select throws_ok($$select public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)$$,'42501','Adviser access unavailable','Expiry takes effect immediately');
reset role;
update public.adviser_access_grants set starts_at=now()-interval '1 day',expires_at=now()+interval '1 day';
delete from public.household_memberships where household_id='fc100000-0000-4000-8000-000000000001' and user_id='fc100000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','fc100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fc100000-0000-4000-8000-000000000002','email','adviser@test.local','role','authenticated')::text,true);
select throws_ok($$select public.retrieve_adviser_data((public.retrieve_adviser_grants()->0->>'id')::uuid)$$,'42501','Adviser access unavailable','Removing the owner membership invalidates the grant');
select throws_ok($$update public.adviser_access_events set action='accessed'$$,'42501',null,'Audit events cannot be rewritten');

reset role;
select ok(not has_table_privilege('authenticated','public.adviser_access_grants','insert'),'Browser roles cannot insert grants directly');
select ok(not has_table_privilege('authenticated','public.adviser_access_events','insert'),'Browser roles cannot forge audit events');
select ok(not has_table_privilege('authenticated','public.adviser_access_grants','select'),'Authenticated users cannot query token hashes or raw grants');
select ok(has_function_privilege('authenticated','public.retrieve_adviser_data(uuid)','execute'),'Authenticated advisers use only the scoped read RPC');
select ok(not has_function_privilege('anon','public.retrieve_adviser_data(uuid)','execute'),'Anonymous users cannot call the scoped read RPC');

select * from finish();
rollback;
