begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('e1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','onboarding-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('e1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','onboarding-viewer@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('e1000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','onboarding-csv@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.complete_first_budget_onboarding(
  'e2000000-0000-4000-8000-000000000001','blank','Owner','ZAR','en-ZA','Africa/Johannesburg','First plan',
  '[{"name":"Income","item_type":"income","category_name":"Custom income","default_amount":"1000.00"}]'::jsonb
)$$,'Blank onboarding completes transactionally');
select is((select count(*)::integer from public.onboarding_activations),1,'Activation is recorded once');
select is((select count(*)::integer from public.budget_templates),1,'One owned template is created');
select is((select count(*)::integer from public.template_items where category_id is not null),1,'Every onboarding item has a valid category');
select lives_ok($$select public.complete_first_budget_onboarding(
  'e2000000-0000-4000-8000-000000000001','blank','Ignored','ZAR','en-ZA','Africa/Johannesburg','Ignored',
  '[{"name":"Other","item_type":"expense","category_name":"Other","default_amount":"1.00"}]'::jsonb
)$$,'Retrying the same setup key is safe');
select is((select count(*)::integer from public.budget_templates),1,'Retry creates no duplicate template');
select is((select count(*)::integer from public.budget_months),1,'Retry creates no duplicate month');
select throws_ok($$select public.complete_first_budget_onboarding(
  'e2000000-0000-4000-8000-000000000011','starter','Owner','ZAR','en-ZA','Africa/Johannesburg','Invalid starter',
  '[{"name":"Income","item_type":"income","category_name":"Earnings","default_amount":"1.00"}]'::jsonb
)$$,'22023','Onboarding path payload does not match the selected path','A path cannot omit its required payload');
select ok(
  position(
    'now() at time zone requested_timezone' in
    lower(pg_get_functiondef('public.setup_first_budget(text,text,text,text,text,text,jsonb)'::regprocedure))
  ) > 0,
  'The first month is selected in the profile timezone'
);

reset role;
insert into public.household_memberships(household_id,user_id,role)
values('e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','viewer');
update public.profiles set active_household_id='e1000000-0000-4000-8000-000000000001'
where user_id='e1000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.complete_first_budget_onboarding(
  'e2000000-0000-4000-8000-000000000002','blank','Viewer','ZAR','en-ZA','Africa/Johannesburg','Viewer plan',
  '[{"name":"Income","item_type":"income","category_name":"Earnings","default_amount":"1.00"}]'::jsonb
)$$,'42501','This household role cannot complete onboarding','A viewer cannot complete household onboarding');

select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000003',true);
select lives_ok(format($query$select public.complete_first_budget_onboarding(
  'e2000000-0000-4000-8000-000000000003','csv','CSV user','ZAR','en-ZA','Africa/Johannesburg','Imported plan',
  '[{"name":"Imported expenses","item_type":"expense","category_name":"Imported expenses","default_amount":"25.00"}]'::jsonb,
  null,null,null,
  jsonb_build_object('file_name','statement.csv','batch_key',repeat('a',64),'invalid_count',0,'excluded_count',0,
    'mapping_metadata',jsonb_build_object('delimiter','comma','date_format','ymd','decimal_format','auto','amount_mode','signed','date_column',0,'description_column',1,'amount_column',2),
    'rows',jsonb_build_array(jsonb_build_object('transaction_date',%L,'description','Coffee','amount_minor',2500,'transaction_type','expense','external_reference',null,'external_fingerprint',repeat('b',64),'category_name','Imported expenses'))))
$query$,(date_trunc('month',current_date)+interval '1 day')::date),'CSV onboarding creates the first month and transactions atomically');
select is((select count(*)::integer from public.budget_transactions),1,'CSV onboarding inserts one actual transaction');
select is((select count(*)::integer from public.budget_transactions where category_id is not null and budget_month_item_id is not null),1,'Imported actual is assigned to its valid category and budget item');
select is((select count(*)::integer from public.onboarding_activations),1,'The CSV account records one isolated activation');

select * from finish();
rollback;
