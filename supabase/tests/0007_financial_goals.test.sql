begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('e1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-a@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('e2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','goal-b@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
update public.profiles set timezone='Africa/Johannesburg' where user_id='e1111111-1111-4111-8111-111111111111';
insert into public.categories(id,user_id,item_type,name) values
('e2000000-0000-4000-8000-000000000001','e1111111-1111-4111-8111-111111111111','expense','Savings'),
('e2000000-0000-4000-8000-000000000002','e2222222-2222-4222-8222-222222222222','expense','Foreign');
insert into public.budget_months(id,user_id,month_start,currency_code) values
('e3000000-0000-4000-8000-000000000001','e1111111-1111-4111-8111-111111111111',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,'ZAR'),
('e3000000-0000-4000-8000-000000000002','e1111111-1111-4111-8111-111111111111',(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '2 months')::date,'ZAR');

set local role authenticated;
select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
select lives_ok($$select * from public.create_financial_goal(jsonb_build_object(
  'name','Emergency fund','goal_type','savings','target_amount_minor',100000,
  'target_date',(current_date + interval '5 months')::date,'starting_balance_minor',20000,
  'desired_monthly_contribution_minor',10000,'priority',1,
  'category_id','e2000000-0000-4000-8000-000000000001'
))$$,'An owned goal can be created');
select is((select count(*)::bigint from public.financial_goals),1::bigint,'RLS exposes the owned goal');
select is((select recommended_amount_minor from public.goal_month_recommendations where budget_month_id='e3000000-0000-4000-8000-000000000001'),10000::bigint,'The editable month receives an exact recommendation');
select is((select count(*)::bigint from public.goal_month_recommendations where budget_month_id='e3000000-0000-4000-8000-000000000002'),0::bigint,'A locked month is not backfilled');
select throws_ok($$insert into public.financial_goals(user_id,name,goal_type,target_amount_minor) values('e1111111-1111-4111-8111-111111111111','Direct','savings',1)$$,'42501','permission denied for table financial_goals','Direct goal writes are denied');
select throws_ok($$select * from public.create_financial_goal(jsonb_build_object(
  'name','Foreign link','goal_type','sinking_fund','target_amount_minor',1000,
  'starting_balance_minor',0,'priority',3,'category_id','e2000000-0000-4000-8000-000000000002'
))$$,'23503',null,'A cross-user context cannot be linked');

select lives_ok($$select * from public.create_goal_contribution(
  (select id from public.financial_goals limit 1),'e3000000-0000-4000-8000-000000000001',null,
  current_date,2500,'First transfer'
)$$,'An editable contribution can be recorded');
select is((select sum(amount_minor) from public.goal_contributions),2500::numeric,'Contribution progress remains exact in minor units');
select throws_ok($$select * from public.create_goal_contribution(
  (select id from public.financial_goals limit 1),'e3000000-0000-4000-8000-000000000001',null,
  current_date,78000,'Too much'
)$$,'23514','Contribution exceeds the remaining goal amount','A contribution cannot exceed the remaining target');
select throws_ok($$select * from public.update_financial_goal(
  (select id from public.financial_goals limit 1),jsonb_build_object(
    'name','Emergency fund','goal_type','savings','target_amount_minor',21000,
    'target_date',(current_date + interval '5 months')::date,'starting_balance_minor',20000,
    'desired_monthly_contribution_minor',10000,'priority',1,'status','active',
    'category_id','e2000000-0000-4000-8000-000000000001'
  )
)$$,'23514','Target or starting balance conflicts with recorded contributions','Target edits cannot invalidate contribution history');
select throws_ok($$select * from public.create_goal_contribution(
  (select id from public.financial_goals limit 1),'e3000000-0000-4000-8000-000000000002',null,
  (date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '2 months')::date,1000,null
)$$,'55000','Months that are two or more calendar months old are read-only','Locked history rejects contributions');

select set_config('request.jwt.claim.sub','e2222222-2222-4222-8222-222222222222',true);
select is((select count(*)::bigint from public.financial_goals),0::bigint,'Another user cannot read goals');
select is((select count(*)::bigint from public.goal_contributions),0::bigint,'Another user cannot read contributions');

select set_config('request.jwt.claim.sub','e1111111-1111-4111-8111-111111111111',true);
select lives_ok($$select * from public.update_financial_goal(
  (select id from public.financial_goals limit 1),jsonb_build_object(
    'name','Emergency fund','goal_type','savings','target_amount_minor',100000,
    'target_date',(current_date + interval '5 months')::date,'starting_balance_minor',20000,
    'desired_monthly_contribution_minor',10000,'priority',1,'status','paused',
    'category_id','e2000000-0000-4000-8000-000000000001'
  )
)$$,'A goal can be paused without deleting its history');
select is((select count(*)::bigint from public.goal_contributions),1::bigint,'Pausing retains contribution history');

select * from finish();
rollback;
