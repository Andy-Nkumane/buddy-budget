begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','checkin-a@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('f2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','checkin-b@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
select lives_ok($$select * from public.update_weekly_checkin_preferences(jsonb_build_object(
  'opted_in',true,'weekday',1,'delivery_time','18:00','timezone','Africa/Johannesburg',
  'in_app_enabled',true,'email_enabled',false,'email_detail_enabled',false,'paused',false
))$$,'A user can explicitly opt in');
select is((select count(*)::bigint from public.weekly_checkin_preferences),1::bigint,'The owner can read preferences');
select throws_ok($$select * from public.update_weekly_checkin_preferences(jsonb_build_object(
  'opted_in',true,'timezone','Not/AZone','in_app_enabled',true
))$$,'22023','Invalid timezone','Invalid timezones are rejected');
select throws_ok($$select * from public.update_weekly_checkin_preferences(jsonb_build_object(
  'opted_in',true,'timezone','UTC','in_app_enabled',false,'email_enabled',false
))$$,'23514','Choose at least one delivery channel','Opt-in requires a channel');
select throws_ok($$insert into public.notification_deliveries(user_id,channel,job_key,period_start,scheduled_for) values(
  'f1111111-1111-4111-8111-111111111111','in_app','direct-write',current_date,now()
)$$,'42501','permission denied for table notification_deliveries','Direct delivery writes are denied');
select lives_ok($$select * from public.create_test_checkin_delivery('in_app')$$,'An opted-in user can request an in-app test');
select is((select count(*)::bigint from public.notification_deliveries),1::bigint,'The owner can read their delivery');
select throws_ok($$select * from public.create_test_checkin_delivery('email')$$,'55000','Email delivery is unavailable','A disabled channel cannot be tested');

select set_config('request.jwt.claim.sub','f2222222-2222-4222-8222-222222222222',true);
select is((select count(*)::bigint from public.weekly_checkin_preferences),0::bigint,'Another user cannot read preferences');
select is((select count(*)::bigint from public.notification_deliveries),0::bigint,'Another user cannot read deliveries');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
select throws_ok($$insert into public.notification_deliveries(user_id,channel,job_key,period_start,scheduled_for) values
  ('f1111111-1111-4111-8111-111111111111','in_app','test:in_app:duplicate',current_date,now()),
  ('f1111111-1111-4111-8111-111111111111','in_app','test:in_app:duplicate',current_date,now())$$,
  '23505',null,'Job keys are unique per user');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
select lives_ok(format('select public.mark_notification_delivery_read(%L)',(select id from public.notification_deliveries limit 1)),'Owners can dismiss in-app deliveries');

select * from finish();
rollback;
