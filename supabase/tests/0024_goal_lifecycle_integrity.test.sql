begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  'b1100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','goal-lifecycle@test.local',
  extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()
);

insert into public.budget_months(id,user_id,household_id,month_start,currency_code) values(
  'b1200000-0000-4000-8000-000000000001','b1100000-0000-4000-8000-000000000001',
  'b1100000-0000-4000-8000-000000000001',date_trunc('month',current_date)::date,'ZAR'
);

select is(public.goal_occurrence_count('2026-01-31','monthly','2026-02-01','2026-04-30'),3,
  'Monthly occurrences preserve their original month-end anchor');

set local role authenticated;
select set_config('request.jwt.claim.sub','b1100000-0000-4000-8000-000000000001',true);

select lives_ok($$select * from public.create_financial_goal(jsonb_build_object(
  'name','  Emergency   Fund  ','goal_type','savings','target_amount_minor',10000,
  'target_date',current_date + 30,'starting_balance_minor',0,
  'desired_monthly_contribution_minor',5000,'priority',1
))$$,'An ongoing goal can be created');
select is((select name from public.financial_goals),'Emergency Fund','Goal names are normalized');
select is((select contribution_frequency from public.financial_goals),'monthly',
  'Existing monthly goal inputs receive the backward-compatible cadence');
select throws_ok($$select * from public.create_financial_goal(jsonb_build_object(
  'name','emergency fund','goal_type','savings','target_amount_minor',10000,
  'target_date',current_date + 30,'starting_balance_minor',0,'priority',2
))$$,'23505','An ongoing or paused goal already uses this name','Normalized duplicate names are rejected');
select throws_ok($$select * from public.create_financial_goal(jsonb_build_object(
  'name','Past goal','goal_type','savings','target_amount_minor',10000,
  'target_date',current_date - 1,'starting_balance_minor',0,'priority',2
))$$,'22023','Target date must be within the next 30 years','New past target dates are rejected');
select throws_ok($$select * from public.update_financial_goal(
  (select id from public.financial_goals limit 1),jsonb_build_object(
    'name','Emergency Fund','goal_type','savings','target_amount_minor',10000,
    'target_date',current_date + 30,'starting_balance_minor',0,
    'desired_monthly_contribution_minor',5000,'priority',1,'status','completed'
  )
)$$,'23514','A goal can be completed only after it is fully funded','Incomplete goals cannot be completed manually');
select lives_ok($$select * from public.update_financial_goal(
  (select id from public.financial_goals limit 1),jsonb_build_object(
    'name','Emergency Fund','goal_type','savings','target_amount_minor',10000,
    'target_date',current_date + 30,'starting_balance_minor',0,
    'desired_monthly_contribution_minor',5000,'priority',1,'status','cancelled'
  )
)$$,'A goal can be cancelled without deleting history');
select lives_ok($$select * from public.create_financial_goal(jsonb_build_object(
  'name','emergency fund','goal_type','savings','target_amount_minor',10000,
  'target_date',current_date + 30,'starting_balance_minor',0,'priority',2
))$$,'A cancelled name can be reused');

select lives_ok($$select * from public.create_goal_contribution(
  (select id from public.financial_goals where status='active' limit 1),
  'b1200000-0000-4000-8000-000000000001',null,current_date,10000,null
)$$,'A contribution can fully fund an ongoing goal');
select is((select status from public.financial_goals where status='completed'),'completed',
  'A fully funded goal is completed atomically');
select lives_ok($$select public.delete_goal_contribution(
  (select id from public.goal_contributions limit 1)
)$$,'An editable contribution can be removed');
select is((select status from public.financial_goals where name='emergency fund'),'active',
  'Removing funding reopens the completed goal');

select * from finish();
rollback;
