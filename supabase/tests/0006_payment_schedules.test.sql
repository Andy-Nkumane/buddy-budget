begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('d1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','schedule-a@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('d2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','schedule-b@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
update public.profiles set timezone='Africa/Johannesburg' where user_id='d1111111-1111-4111-8111-111111111111';
insert into public.categories(id,user_id,item_type,name) values
('d2000000-0000-4000-8000-000000000001','d1111111-1111-4111-8111-111111111111','expense','Bills'),
('d2000000-0000-4000-8000-000000000002','d2222222-2222-4222-8222-222222222222','expense','Foreign');
insert into public.budget_months(id,user_id,month_start,currency_code) values
('d3000000-0000-4000-8000-000000000001','d1111111-1111-4111-8111-111111111111',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,'ZAR'),
('d3000000-0000-4000-8000-000000000002','d1111111-1111-4111-8111-111111111111',(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '2 months')::date,'ZAR');

set local role authenticated;
select set_config('request.jwt.claim.sub','d1111111-1111-4111-8111-111111111111',true);

select lives_ok($$select * from public.create_payment_schedule(jsonb_build_object(
  'name','Rent','item_type','expense','amount_minor',750000,'amount_is_approximate',false,
  'start_date',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,
  'end_date',null,'recurrence','monthly','selected_days',jsonb_build_array(),
  'timezone','Africa/Johannesburg','enabled',true,
  'category_id','d2000000-0000-4000-8000-000000000001','notes','Monthly rent'
))$$,'An owned schedule can be created');
select is((select count(*)::bigint from public.payment_schedules),1::bigint,'RLS exposes the owned schedule');
select is((select count(*)::bigint from public.payment_schedule_occurrences),1::bigint,'Creation snapshots an occurrence for an existing month');
select is((select amount_minor from public.payment_schedule_occurrences limit 1),750000::bigint,'Occurrence snapshots the exact minor-unit amount');
select throws_ok($$insert into public.payment_schedules(user_id,name,item_type,amount_minor,start_date,recurrence,timezone) values('d1111111-1111-4111-8111-111111111111','Direct','expense',1,current_date,'monthly','UTC')$$,'42501','permission denied for table payment_schedules','Direct schedule writes are denied');
select throws_ok($$select * from public.create_payment_schedule(jsonb_build_object(
  'name','Foreign category','item_type','expense','amount_minor',1,'start_date',current_date,
  'recurrence','monthly','selected_days',jsonb_build_array(),'timezone','UTC','enabled',true,
  'category_id','d2000000-0000-4000-8000-000000000002'
))$$,'23514','Schedule category must be active, owned, and match its type','Cross-user category association is rejected');

reset role;
insert into public.payment_schedule_occurrences(user_id,schedule_id,budget_month_id,due_date,name_snapshot,item_type,amount_minor)
select 'd1111111-1111-4111-8111-111111111111',id,'d3000000-0000-4000-8000-000000000002',
  (date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '2 months')::date,
  'Historical rent','expense',750000 from public.payment_schedules limit 1;

set local role authenticated;
select set_config('request.jwt.claim.sub','d2222222-2222-4222-8222-222222222222',true);
select is((select count(*)::bigint from public.payment_schedules),0::bigint,'Another user cannot read schedules');
select is((select count(*)::bigint from public.payment_schedule_occurrences),0::bigint,'Another user cannot read occurrences');

select set_config('request.jwt.claim.sub','d1111111-1111-4111-8111-111111111111',true);
select throws_ok($$select * from public.confirm_payment_occurrence(
  (select id from public.payment_schedule_occurrences where name_snapshot='Historical rent'), 'paid', null
)$$,'55000','Months that are two or more calendar months old are read-only','Locked occurrence mutation is rejected');
select lives_ok($$select * from public.update_payment_schedule(
  (select id from public.payment_schedules limit 1),
  jsonb_build_object('name','Rent','item_type','expense','amount_minor',750000,
  'amount_is_approximate',false,'start_date',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,
  'end_date',null,'recurrence','monthly','selected_days',jsonb_build_array(),
  'timezone','Africa/Johannesburg','enabled',false,
  'category_id','d2000000-0000-4000-8000-000000000001','notes','Monthly rent')
)$$,'Disabling a schedule keeps history and succeeds');
select is((select count(*)::bigint from public.payment_schedule_occurrences where name_snapshot='Historical rent'),1::bigint,'Historical occurrences remain after disabling');

select * from finish();
rollback;
