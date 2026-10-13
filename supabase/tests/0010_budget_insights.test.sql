begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('a8111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','insights-a@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('a8222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','insights-b@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.categories(id,user_id,item_type,name,sort_order) values
('a8300000-0000-4000-8000-000000000001','a8111111-1111-4111-8111-111111111111','expense','Dining',1),
('a8300000-0000-4000-8000-000000000002','a8222222-2222-4222-8222-222222222222','expense','Private',1);

insert into public.budget_months(id,user_id,month_start,currency_code) values
('a8400000-0000-4000-8000-000000000001','a8111111-1111-4111-8111-111111111111',(date_trunc('month',now())-interval '2 months')::date,'ZAR'),
('a8400000-0000-4000-8000-000000000002','a8111111-1111-4111-8111-111111111111',(date_trunc('month',now())-interval '1 month')::date,'ZAR'),
('a8400000-0000-4000-8000-000000000003','a8111111-1111-4111-8111-111111111111',date_trunc('month',now())::date,'ZAR'),
('a8400000-0000-4000-8000-000000000005','a8111111-1111-4111-8111-111111111111',(date_trunc('month',now())-interval '3 months')::date,'GBP'),
('a8400000-0000-4000-8000-000000000004','a8222222-2222-4222-8222-222222222222',date_trunc('month',now())::date,'ZAR');

insert into public.budget_month_items(id,budget_month_id,user_id,category_id,item_type,name_snapshot,category_snapshot,amount) values
('a8500000-0000-4000-8000-000000000001','a8400000-0000-4000-8000-000000000001','a8111111-1111-4111-8111-111111111111','a8300000-0000-4000-8000-000000000001','expense','Dining','Dining',100),
('a8500000-0000-4000-8000-000000000002','a8400000-0000-4000-8000-000000000002','a8111111-1111-4111-8111-111111111111','a8300000-0000-4000-8000-000000000001','expense','Dining','Dining',100),
('a8500000-0000-4000-8000-000000000003','a8400000-0000-4000-8000-000000000003','a8111111-1111-4111-8111-111111111111','a8300000-0000-4000-8000-000000000001','expense','Dining','Dining',100),
('a8500000-0000-4000-8000-000000000004','a8400000-0000-4000-8000-000000000001','a8111111-1111-4111-8111-111111111111',null,'income','Salary','Income',1000),
('a8500000-0000-4000-8000-000000000005','a8400000-0000-4000-8000-000000000002','a8111111-1111-4111-8111-111111111111',null,'income','Salary','Income',1000),
('a8500000-0000-4000-8000-000000000006','a8400000-0000-4000-8000-000000000003','a8111111-1111-4111-8111-111111111111',null,'income','Salary','Income',1000);
insert into public.budget_month_items(id,budget_month_id,user_id,category_id,item_type,name_snapshot,category_snapshot,amount) values
('a8500000-0000-4000-8000-000000000007','a8400000-0000-4000-8000-000000000005','a8111111-1111-4111-8111-111111111111',null,'income','Reversed income','Income',1000);

insert into public.budget_transactions(id,user_id,budget_month_id,category_id,transaction_date,description,amount_minor,transaction_type,is_refund,status,is_recurring_candidate) values
('a8600000-0000-4000-8000-000000000001','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000001','a8300000-0000-4000-8000-000000000001',(date_trunc('month',now())-interval '2 months')::date,'Dining subscription',12000,'expense',false,'posted',true),
('a8600000-0000-4000-8000-000000000002','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000002','a8300000-0000-4000-8000-000000000001',(date_trunc('month',now())-interval '1 month')::date,'Dining subscription',15000,'expense',false,'posted',true),
('a8600000-0000-4000-8000-000000000003','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000003','a8300000-0000-4000-8000-000000000001',date_trunc('month',now())::date,'Dining purchase',10000,'expense',false,'posted',false),
('a8600000-0000-4000-8000-000000000004','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000003','a8300000-0000-4000-8000-000000000001',date_trunc('month',now())::date,'Dining refund',2000,'expense',true,'posted',false),
('a8600000-0000-4000-8000-000000000005','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000003','a8300000-0000-4000-8000-000000000001',date_trunc('month',now())::date,'Pending dining',99999,'expense',false,'pending',false),
('a8600000-0000-4000-8000-000000000006','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000001',null,(date_trunc('month',now())-interval '2 months')::date,'Salary',100000,'income',false,'posted',false),
('a8600000-0000-4000-8000-000000000007','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000002',null,(date_trunc('month',now())-interval '1 month')::date,'Salary',100000,'income',false,'posted',false),
('a8600000-0000-4000-8000-000000000008','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000003',null,date_trunc('month',now())::date,'Salary',100000,'income',false,'posted',false),
('a8600000-0000-4000-8000-000000000009','a8222222-2222-4222-8222-222222222222','a8400000-0000-4000-8000-000000000004','a8300000-0000-4000-8000-000000000002',date_trunc('month',now())::date,'Private expense',77777,'expense',false,'posted',false);
insert into public.budget_transactions(id,user_id,budget_month_id,category_id,transaction_date,description,amount_minor,transaction_type,is_refund,status,is_recurring_candidate) values
('a8600000-0000-4000-8000-000000000010','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000005',null,(date_trunc('month',now())-interval '3 months')::date,'Income reversal',50000,'income',true,'posted',false);

insert into public.month_adjustments(id,user_id,original_budget_month_id,applied_budget_month_id,item_type,direction,amount_minor,reason,idempotency_key) values
('a8700000-0000-4000-8000-000000000001','a8111111-1111-4111-8111-111111111111','a8400000-0000-4000-8000-000000000001','a8400000-0000-4000-8000-000000000003','expense','increase',500,'Late fee','a8800000-0000-4000-8000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','a8111111-1111-4111-8111-111111111111',true);

select lives_ok(format($$select public.retrieve_budget_insights('%s','%s',null)$$,
  (date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date),'Aggregate RPC accepts a bounded owned range');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->>'month_count')::integer,3,'All selected months are represented');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'monthly'->0->>'planned_expenses_minor')::bigint,10000::bigint,'Planned money remains exact in minor units');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'monthly'->0->>'actual_expenses_minor')::bigint,12500::bigint,'Whole-month actual includes explicit historical adjustment');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,'a8300000-0000-4000-8000-000000000001')->'monthly'->0->>'actual_expenses_minor')::bigint,12000::bigint,'Category filter excludes unattributed adjustment');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'monthly'->2->>'actual_expenses_minor')::bigint,8000::bigint,'Refund reverses expense and pending transaction is ignored');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'categories'->0->>'overspent_months')::integer,2,'Repeated overspending counts category months above plan');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'categories'->0->>'average_actual_minor')::bigint,11667::bigint,'Category average rounds deterministically in minor units');
select is(jsonb_array_length(public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'recurring_changes'),1,'Recurring amount change is detected between consecutive observations');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)->'largest_discretionary'->0->>'amount_minor')::bigint,15000::bigint,'Largest discretionary result is bounded and ordered');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date,null)::text like '%Private expense%'),false,'Other user data never enters aggregates');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '3 months')::date,(date_trunc('month',now())-interval '3 months')::date,null)->'monthly'->0->>'actual_income_minor')::bigint,-50000::bigint,'Income reversals can produce an honest negative actual');
select is((public.retrieve_budget_insights((date_trunc('month',now())-interval '3 months')::date,(date_trunc('month',now())-interval '3 months')::date,null)->'monthly'->0->>'savings_rate_basis_points'),null::text,'Negative income has no misleading savings rate');
select is(jsonb_array_length(public.retrieve_budget_insights((date_trunc('month',now())-interval '3 months')::date,date_trunc('month',now())::date,null)->'currencies'),2,'Unlike currencies remain explicit separate groups');
select is((public.retrieve_budget_insights((date_trunc('month',now())+interval '1 month')::date,(date_trunc('month',now())+interval '1 month')::date,null)->>'month_count')::integer,0,'An empty range is distinct from zero-valued activity');
select throws_ok(format($$select public.retrieve_budget_insights('%s','%s',null)$$,(date_trunc('month',now())-interval '60 months')::date,date_trunc('month',now())::date),'22023','Insight ranges are limited to 60 months','Ranges above the bound are rejected');
select throws_ok(format($$select public.retrieve_budget_insights('%s','%s','a8300000-0000-4000-8000-000000000002')$$,(date_trunc('month',now())-interval '2 months')::date,date_trunc('month',now())::date),'42501','Category not found','Cross-user category filters are rejected');

select set_config('request.jwt.claim.sub','a8222222-2222-4222-8222-222222222222',true);
select is((public.retrieve_budget_insights(date_trunc('month',now())::date,date_trunc('month',now())::date,null)->>'month_count')::integer,1,'Second user sees only their own month');

select * from finish();
rollback;
