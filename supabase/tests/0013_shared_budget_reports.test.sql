begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('da100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','share-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('da100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','share-outsider@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.shared_budget_reports(household_id,created_by,token_hash,access_code_hash,snapshot,expires_at,max_views)
values('da100000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64),'{"title":"Limited report"}',now()+interval '1 day',1);

select is((select count(*)::bigint from public.shared_budget_reports where token_hash=repeat('a',64)),1::bigint,'Owner snapshot is stored once');
select is((select public.consume_shared_budget_report(repeat('a',64),repeat('c',64))),'{"access_code_required": true}'::jsonb,'Incorrect access code reveals only that a code is required');
select is((select public.consume_shared_budget_report(repeat('a',64),repeat('b',64))->'snapshot'->>'title'),'Limited report','Valid token and code return only the snapshot');
select is((select view_count from public.shared_budget_reports where token_hash=repeat('a',64)),1,'View count increments atomically');
select is((select public.consume_shared_budget_report(repeat('a',64),repeat('b',64))),null::jsonb,'View limit stops subsequent access');

insert into public.shared_budget_reports(household_id,created_by,token_hash,access_code_hash,snapshot,expires_at)
values('da100000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001',repeat('e',64),null,'{"title":"Passwordless report"}',now()+interval '1 day');
select is((select public.consume_shared_budget_report(repeat('e',64),null)->'snapshot'->>'title'),'Passwordless report','A report without an access code opens directly');
select is((select view_count from public.shared_budget_reports where token_hash=repeat('e',64)),1,'Opening a passwordless report counts one view');

update public.shared_budget_reports set revoked_at=now() where token_hash=repeat('a',64);
select is((select public.consume_shared_budget_report(repeat('a',64),repeat('b',64))),null::jsonb,'Revoked links stop immediately');
select throws_ok($$update public.shared_budget_reports set snapshot='{}' where token_hash=repeat('a',64)$$,'55000','Shared report snapshots are immutable','Snapshot cannot be rewritten');
select throws_ok($$insert into public.shared_budget_reports(household_id,created_by,token_hash,snapshot,expires_at) values('da100000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001','short','{}',now()+interval '1 day')$$,'23514',null,'Short token hashes are rejected');
select throws_ok($$insert into public.shared_budget_reports(household_id,created_by,token_hash,snapshot,expires_at) values('da100000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000001',repeat('d',64),'{}',now()+interval '91 days')$$,'23514',null,'Expiry is bounded');

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','da100000-0000-4000-8000-000000000002','role','authenticated')::text,true);
select set_config('request.jwt.claim.sub','da100000-0000-4000-8000-000000000002',true);
select is((select count(*)::bigint from public.shared_budget_reports),0::bigint,'Another household cannot enumerate shares');
select throws_ok($$select public.consume_shared_budget_report(repeat('a',64),repeat('b',64))$$,'42501',null,'Authenticated users cannot call the anonymous consume primitive');
reset role;
select ok(not has_table_privilege('anon','public.shared_budget_reports','select'),'Anonymous clients cannot query the table');
insert into public.household_memberships(household_id,user_id,role)
values('da100000-0000-4000-8000-000000000001','da100000-0000-4000-8000-000000000002','viewer');
update public.profiles set active_household_id='da100000-0000-4000-8000-000000000001'
where user_id='da100000-0000-4000-8000-000000000002';
select throws_ok($$select public.require_shared_report_owner('da100000-0000-4000-8000-000000000002')$$,'42501','Shared report management requires the active household owner','Transactional management rejects a non-owner');
select is(public.require_shared_report_owner('da100000-0000-4000-8000-000000000001'),'da100000-0000-4000-8000-000000000001'::uuid,'Transactional management resolves the owner active household');
select ok(not has_function_privilege('authenticated','public.create_shared_budget_report(uuid,text,text,jsonb,timestamptz,integer)','execute'),'Browser clients cannot call the service management primitive');

select * from finish();
rollback;
