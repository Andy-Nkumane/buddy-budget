begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('ad100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('ad100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','delete-member@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.household_memberships(household_id,user_id,role)
values('ad100000-0000-4000-8000-000000000001','ad100000-0000-4000-8000-000000000002','viewer');
insert into public.weekly_checkin_preferences(user_id,opted_in)
values('ad100000-0000-4000-8000-000000000001',false);
insert into public.notification_deliveries(user_id,channel,job_key,period_start,scheduled_for)
values('ad100000-0000-4000-8000-000000000001','in_app','deletion-test-job',current_date,now());
insert into public.activation_milestones(milestone_key,scope_type,scope_id,user_id)
values('first_export','user','ad100000-0000-4000-8000-000000000001','ad100000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.delete_own_account()$$,'42501','Authentication required','COMP-007: Anonymous deletion is rejected');

select set_config('request.jwt.claim.sub','ad100000-0000-4000-8000-000000000001',true);
select throws_ok(
  $$select public.delete_own_account()$$,
  '42501',
  'Re-enter your password before deleting your account',
  'AUTH-004: Deletion requires a recent password authentication method'
);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','ad100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now()-interval '11 minutes')::bigint))
)::text,true);
select throws_ok(
  $$select public.delete_own_account()$$,
  '42501',
  'Re-enter your password before deleting your account',
  'AUTH-004: Stale password authentication cannot authorize deletion'
);
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','ad100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint))
)::text,true);
select throws_ok(
  $$select public.delete_own_account()$$,
  '23514',
  'Transfer ownership and remove or relocate all members from delete-owner@test.local''s household before deleting your account',
  'An owner cannot orphan a shared household'
);
reset role;
select is((select count(*)::integer from auth.users where id='ad100000-0000-4000-8000-000000000001'),1,'A blocked deletion retains the Auth identity');
delete from public.household_memberships
where household_id='ad100000-0000-4000-8000-000000000001' and user_id='ad100000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','ad100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint))
)::text,true);
select lives_ok($$select public.delete_own_account()$$,'COMP-007: An eligible user can delete their own account');
reset role;
select is((select count(*)::integer from auth.users where id='ad100000-0000-4000-8000-000000000001'),0,'Deletion removes the Auth identity');
select is((select count(*)::integer from public.profiles where user_id='ad100000-0000-4000-8000-000000000001'),0,'Deletion cascades the profile');
select is((select count(*)::integer from public.households where id='ad100000-0000-4000-8000-000000000001'),0,'Deletion removes the sole-owned household');
select is((select count(*)::integer from public.weekly_checkin_preferences where user_id='ad100000-0000-4000-8000-000000000001'),0,'Deletion cascades check-in preferences');
select is((select count(*)::integer from public.notification_deliveries where user_id='ad100000-0000-4000-8000-000000000001'),0,'Deletion cascades notification delivery history');
select is((select count(*)::integer from public.activation_milestones where user_id='ad100000-0000-4000-8000-000000000001'),0,'Deletion cascades user milestones');
select is((select count(*)::integer from auth.users where id='ad100000-0000-4000-8000-000000000002'),1,'Deletion does not remove another Auth identity');
select is((select count(*)::integer from public.households where id='ad100000-0000-4000-8000-000000000002'),1,'Deletion does not remove another user household');
select is((select count(*)::integer from public.profiles where user_id='ad100000-0000-4000-8000-000000000002'),1,'Deletion does not remove another profile');

select * from finish();
rollback;
