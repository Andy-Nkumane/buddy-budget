begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('ac100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','access-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('ac100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','access-editor@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('ac100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','access-viewer@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('ac100000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','access-outsider@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.household_memberships(household_id,user_id,role) values
('ac100000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000002','editor'),
('ac100000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000003','viewer');
update public.profiles set active_household_id='ac100000-0000-4000-8000-000000000001'
where user_id in ('ac100000-0000-4000-8000-000000000002','ac100000-0000-4000-8000-000000000003');

insert into public.categories(id,user_id,household_id,item_type,name,sort_order) values
('ac200000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','expense','Access category',0);
insert into public.budget_months(id,user_id,household_id,month_start,currency_code) values
('ac300000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001',date_trunc('month',now())::date,'ZAR');
insert into public.budget_transactions(id,user_id,household_id,budget_month_id,transaction_date,description,amount_minor,transaction_type,status) values
('ac400000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','ac100000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001',date_trunc('month',now())::date,'Original description',1250,'expense','posted');

set local role authenticated;
select set_config('request.jwt.claim.sub','ac100000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.budget_transactions),1,'COMP-006: Owner export queries see the active household record');

select set_config('request.jwt.claim.sub','ac100000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.budget_transactions),1,'Editor export queries see the shared active household record');
select lives_ok($$select * from public.update_budget_transaction(
  'ac400000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001',date_trunc('month',now())::date,
  'Editor correction',1250,'expense',false,null,null,null,'','posted')$$,'Editor can correct an editable household transaction');
select is((select description from public.budget_transactions where id='ac400000-0000-4000-8000-000000000001'),'Editor correction','The correction updates the editable description');
select is((select amount_minor from public.budget_transactions where id='ac400000-0000-4000-8000-000000000001'),1250::bigint,'The correction preserves the exact transaction amount');

select set_config('request.jwt.claim.sub','ac100000-0000-4000-8000-000000000003',true);
select is((select count(*)::integer from public.budget_transactions),1,'Viewer export queries can read the shared active household record');
select throws_ok($$select * from public.update_budget_transaction(
  'ac400000-0000-4000-8000-000000000001','ac300000-0000-4000-8000-000000000001',date_trunc('month',now())::date,
  'Viewer correction',1250,'expense',false,null,null,null,'','posted')$$,'42501','This household role cannot make changes','Viewer cannot correct household financial records');

select set_config('request.jwt.claim.sub','ac100000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.categories),0,'Outsider export queries cannot read another household category');
select is((select count(*)::integer from public.budget_months),0,'Outsider export queries cannot read another household month');
select is((select count(*)::integer from public.budget_transactions),0,'COMP-006: Outsider export queries cannot read another household transaction');

select * from finish();
rollback;
