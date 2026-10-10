begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

select is((select count(*)::integer from public.starter_budget_templates where is_active),5,'Five curated starters are active');
select is((select count(distinct starter_template_id)::integer from public.starter_budget_template_items),5,'Every starter has content');
select is((select count(*)::integer from public.starter_budget_template_items where btrim(category_name)=''),0,'Every starter item has a category');
select is((select count(*)::integer from public.starter_budget_template_items where default_amount<>0),0,'Curated defaults do not invent spending advice');
select ok((select count(*)>=5 from public.starter_budget_template_items where starter_template_id='student' and starter_template_version=1),'Student content is complete');
select ok((select count(*)>=5 from public.starter_budget_template_items where starter_template_id='first-salary' and starter_template_version=1),'First salary content is complete');
select ok((select count(*)>=5 from public.starter_budget_template_items where starter_template_id='household' and starter_template_version=1),'Household content is complete');
select ok((select count(*)>=5 from public.starter_budget_template_items where starter_template_id='freelancer' and starter_template_version=1),'Freelancer content is complete');
select ok((select count(*)>=5 from public.starter_budget_template_items where starter_template_id='minimal-essentials' and starter_template_version=1),'Minimal essentials content is complete');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','starter-owner@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('c1222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','starter-viewer@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('c1333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','starter-other@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.household_memberships(household_id,user_id,role)
values('c1111111-1111-4111-8111-111111111111','c1222222-2222-4222-8222-222222222222','viewer');
update public.profiles set active_household_id='c1111111-1111-4111-8111-111111111111'
where user_id='c1222222-2222-4222-8222-222222222222';

set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select lives_ok($$select public.copy_starter_budget_template('student',1,'My student plan',
  '[{"item_key":"income","amount":"1250.50"},{"item_key":"housing","amount":"500.00"}]'::jsonb,
  'c1444444-4444-4444-8444-444444444444',true)$$,'Owner can transactionally copy a starter');
select is((select count(*)::integer from public.budget_templates where starter_copy_key='c1444444-4444-4444-8444-444444444444'),1,'One owned template is created');
select is((select count(*)::integer from public.template_items item join public.categories category on category.id=item.category_id
  where item.template_id=(select id from public.budget_templates where starter_copy_key='c1444444-4444-4444-8444-444444444444')),2,'Every copied item has a category');
select lives_ok($$select public.copy_starter_budget_template('student',1,'Ignored retry name',
  '[{"item_key":"income","amount":"1250.50"},{"item_key":"housing","amount":"500.00"}]'::jsonb,
  'c1444444-4444-4444-8444-444444444444',true)$$,'An identical copy key is safely retryable');
select is((select count(*)::integer from public.budget_templates where starter_copy_key='c1444444-4444-4444-8444-444444444444'),1,'Retry creates no duplicate');
select throws_ok($$select public.copy_starter_budget_template('student',1,'Invalid duplicate items',
  '[{"item_key":"income","amount":"1.00"},{"item_key":"income","amount":"1.00"}]'::jsonb,
  'c1555555-5555-4555-8555-555555555555',false)$$,'22023','Every included item must be valid and unique','Duplicate item keys are rejected');

reset role;
update public.starter_budget_template_items set name='Updated catalog label'
where starter_template_id='student' and starter_template_version=1 and item_key='housing';
set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);
select is((select name from public.template_items where template_id=(select id from public.budget_templates
  where starter_copy_key='c1444444-4444-4444-8444-444444444444') and item_type='expense'),'Housing','Catalog changes never rewrite a copied template');

select set_config('request.jwt.claim.sub','c1222222-2222-4222-8222-222222222222',true);
select throws_ok($$select public.copy_starter_budget_template('minimal-essentials',1,'Viewer plan',
  '[{"item_key":"income","amount":"0.00"}]'::jsonb,'c1666666-6666-4666-8666-666666666666',false)$$,
  '42501','This household role cannot copy starter templates','Viewers cannot copy starters');

select set_config('request.jwt.claim.sub','c1333333-3333-4333-8333-333333333333',true);
select is((select count(*)::integer from public.budget_templates where starter_copy_key='c1444444-4444-4444-8444-444444444444'),0,'Another household cannot read the copied template');
select throws_ok($$select public.copy_starter_budget_template('student',999,'Missing version',
  '[{"item_key":"income","amount":"0.00"}]'::jsonb,'c1777777-7777-4777-8777-777777777777',false)$$,
  '22023','Starter template version is unavailable','Unavailable versions are rejected');

select is((select count(*)::integer from public.budget_months),0,'Copying a starter does not create or rewrite historical months');
select lives_ok($$select public.setup_first_budget_from_starter('Starter user','ZAR','en-ZA','Africa/Johannesburg','system','First salary plan',
  '[{"name":"Salary","item_type":"income","category_name":"Earnings","default_amount":"1000.00","starter_item_key":"salary"},{"name":"Healthcare","item_type":"expense","category_name":"Healthcare","default_amount":"50.00","starter_item_key":"healthcare"}]'::jsonb,
  'first-salary',1,'c1888888-8888-4888-8888-888888888888')$$,'Onboarding copies a selected starter transactionally');
select is((select starter_template_id from public.budget_templates where starter_copy_key='c1888888-8888-4888-8888-888888888888'),'first-salary','Onboarding records starter source diagnostics');
select is((select count(*)::integer from public.budget_month_items item where item.budget_month_id=(select id from public.budget_months limit 1) and item.category_id is not null),2,'The onboarding month snapshots valid categories for every starter item');
select * from finish();
rollback;
