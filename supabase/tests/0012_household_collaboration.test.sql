begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('ca100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner@household.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{"display_name":"Owner"}',now(),now()),
('ca100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','editor@household.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{"display_name":"Editor"}',now(),now()),
('ca100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','viewer@household.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{"display_name":"Viewer"}',now(),now()),
('ca100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@household.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{"display_name":"Outsider"}',now(),now());

select is((select count(*)::bigint from public.households where id in
  ('ca100000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000003','ca100000-0000-4000-8000-000000000004')),4::bigint,'New users receive an initial household');
select is((select count(*)::bigint from public.household_memberships where role='owner' and user_id in
  ('ca100000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000003','ca100000-0000-4000-8000-000000000004')),4::bigint,'New users own their initial household');
select is((select active_household_id from public.profiles where user_id='ca100000-0000-4000-8000-000000000001'),'ca100000-0000-4000-8000-000000000001'::uuid,'Initial household becomes active');
select is((select name from public.households where id='ca100000-0000-4000-8000-000000000001'),'Owner','Display name is used as the default household name');

create temporary table invitation_tokens(kind text primary key,token text);
grant select,insert on invitation_tokens to authenticated;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000001','role','authenticated','email','owner@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000001',true);
insert into invitation_tokens select 'editor',invitation_token from public.create_household_invitation('editor@household.test','editor');
insert into invitation_tokens select 'viewer',invitation_token from public.create_household_invitation('viewer@household.test','viewer');
reset role;
select is((select count(*)::bigint from public.household_invitations where household_id='ca100000-0000-4000-8000-000000000001'),2::bigint,'Owner can create expiring invitations');
select ok((select bool_and(expires_at<=now()+interval '7 days 1 minute' and expires_at>now()) from public.household_invitations where household_id='ca100000-0000-4000-8000-000000000001'),'Invitations have bounded expiry');

set local role authenticated;
select lives_ok($$select public.update_household_name('Family budget')$$,'Owner can rename the household');
select is((public.retrieve_household_context()->'households'->0->>'name'),'Family budget','Renamed household is visible to members');
select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000002','role','authenticated','email','editor@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000002',true);
select is(public.respond_to_household_invitation((select token from invitation_tokens where kind='editor'),true),'ca100000-0000-4000-8000-000000000001'::uuid,'Verified editor accepts invitation');
select is((select member->>'display_name' from jsonb_array_elements(public.retrieve_household_context()->'members') member where member->>'user_id'='ca100000-0000-4000-8000-000000000001'),'Owner','Member list uses the owner display name');
reset role;
update public.profiles set display_name=null where user_id='ca100000-0000-4000-8000-000000000002';
update auth.users set raw_user_meta_data='{}' where id='ca100000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000002','role','authenticated','email','editor@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000002',true);
select is((select member->>'display_name' from jsonb_array_elements(public.retrieve_household_context()->'members') member where member->>'user_id'='ca100000-0000-4000-8000-000000000002'),'editor@household.test','Member list falls back to email when display name is absent');
select throws_ok(format('select public.respond_to_household_invitation(%L,true)',(select token from invitation_tokens where kind='editor')),'22023','This invitation is invalid or has already been used','Invitation replay is rejected');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000003','role','authenticated','email','wrong@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000003',true);
select throws_ok(format('select public.respond_to_household_invitation(%L,true)',(select token from invitation_tokens where kind='viewer')),'42501','Sign in with the invited email address','Invitation recipient must match verified account');
select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000003','role','authenticated','email','viewer@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000003',true);
select is(public.respond_to_household_invitation((select token from invitation_tokens where kind='viewer'),true),'ca100000-0000-4000-8000-000000000001'::uuid,'Verified viewer accepts invitation');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000001','role','authenticated','email','owner@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000001',true);
insert into public.categories(user_id,household_id,item_type,name,sort_order)
values('ca100000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000001','expense','Shared category',0);
select is((select count(*)::bigint from public.categories where household_id='ca100000-0000-4000-8000-000000000001'),1::bigint,'Owner writes shared records');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000002','role','authenticated','email','editor@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000002',true);
select is((select count(*)::bigint from public.categories),1::bigint,'Editor reads shared records');
insert into public.categories(user_id,household_id,item_type,name,sort_order)
values('ca100000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000001','expense','Editor category',1);
select is((select user_id from public.categories where name='Editor category'),'ca100000-0000-4000-8000-000000000001'::uuid,'Editor writes are stamped with the legacy data owner');
select lives_ok($$select public.switch_household('ca100000-0000-4000-8000-000000000002')$$,'Editor can switch to their personal household');
select is((select count(*)::bigint from public.categories),0::bigint,'Only the active household is visible');
select public.switch_household('ca100000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000003','role','authenticated','email','viewer@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000003',true);
select is((select count(*)::bigint from public.categories),2::bigint,'Viewer reads shared records');
select throws_ok($$insert into public.categories(user_id,household_id,item_type,name,sort_order) values('ca100000-0000-4000-8000-000000000003','ca100000-0000-4000-8000-000000000001','expense','Forbidden',2)$$,'42501','This household role cannot make changes','Viewer cannot mutate shared records');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000004','role','authenticated','email','outsider@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000004',true);
select is((select count(*)::bigint from public.categories where household_id='ca100000-0000-4000-8000-000000000001'),0::bigint,'Outsider cannot read another household');
select throws_ok($$select public.switch_household('ca100000-0000-4000-8000-000000000001')$$,'42501','Household access denied','Outsider cannot activate another household');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000002','role','authenticated','email','editor@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.manage_household_member('remove','ca100000-0000-4000-8000-000000000003',null)$$,'42501','Only the household owner can manage members','Editor cannot manage membership');
select throws_ok($$select public.create_household_invitation('new@household.test','viewer')$$,'42501','Only the household owner can invite members','Editor cannot invite members');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000001','role','authenticated','email','owner@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.manage_household_member('remove','ca100000-0000-4000-8000-000000000003',null)$$,'Owner removes viewer');
select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000003','role','authenticated','email','viewer@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000003',true);
select is((select count(*)::bigint from public.categories where household_id='ca100000-0000-4000-8000-000000000001'),0::bigint,'Revocation takes effect on the next request');

select set_config('request.jwt.claims',jsonb_build_object('sub','ca100000-0000-4000-8000-000000000001','role','authenticated','email','owner@household.test')::text,true);
select set_config('request.jwt.claim.sub','ca100000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.manage_household_member('leave','ca100000-0000-4000-8000-000000000001',null)$$,'23514','Transfer ownership before leaving','Last owner cannot leave');
select lives_ok($$select public.manage_household_member('transfer','ca100000-0000-4000-8000-000000000002',null)$$,'Owner transfers ownership atomically');
select is((select role from public.household_memberships where household_id='ca100000-0000-4000-8000-000000000001' and user_id='ca100000-0000-4000-8000-000000000002'),'owner','Transferred member becomes owner');
select is((select data_owner_user_id from public.households where id='ca100000-0000-4000-8000-000000000001'),'ca100000-0000-4000-8000-000000000001'::uuid,'Ownership transfer preserves legacy data identity');
select is((select count(*)::bigint from public.household_activity where household_id='ca100000-0000-4000-8000-000000000001' and action in ('insert','remove','transfer')),4::bigint,'Material financial and membership changes are audited');
delete from public.household_activity where household_id='ca100000-0000-4000-8000-000000000001';
select is((select count(*)::bigint from public.household_activity where household_id='ca100000-0000-4000-8000-000000000001' and action in ('insert','remove','transfer')),4::bigint,'Activity history cannot be deleted');

select * from finish();
rollback;
