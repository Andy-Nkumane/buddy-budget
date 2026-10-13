begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('c1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rules-a@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('c2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rules-b@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
update public.profiles set timezone='Africa/Johannesburg' where user_id='c1111111-1111-4111-8111-111111111111';
insert into public.categories(id,user_id,item_type,name) values
('c2000000-0000-4000-8000-000000000001','c1111111-1111-4111-8111-111111111111','expense','Food'),
('c2000000-0000-4000-8000-000000000002','c2222222-2222-4222-8222-222222222222','expense','Foreign');
insert into public.budget_months(id,user_id,month_start,currency_code) values
('c3000000-0000-4000-8000-000000000001','c1111111-1111-4111-8111-111111111111',date_trunc('month',now())::date,'ZAR'),
('c3000000-0000-4000-8000-000000000002','c1111111-1111-4111-8111-111111111111',(date_trunc('month',now())-interval '2 months')::date,'ZAR');
insert into public.budget_month_items(id,budget_month_id,user_id,category_id,item_type,name_snapshot,amount) values
('c3500000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','c1111111-1111-4111-8111-111111111111','c2000000-0000-4000-8000-000000000001','expense','Food budget',1000);
insert into public.budget_transactions(id,user_id,budget_month_id,transaction_date,description,amount_minor,transaction_type) values
('c4000000-0000-4000-8000-000000000001','c1111111-1111-4111-8111-111111111111','c3000000-0000-4000-8000-000000000001',date_trunc('month',now())::date,'Corner Shop',1250,'expense'),
('c4000000-0000-4000-8000-000000000002','c1111111-1111-4111-8111-111111111111','c3000000-0000-4000-8000-000000000002',(date_trunc('month',now())-interval '2 months')::date,'Corner Shop old',1250,'expense');

set local role authenticated;
select set_config('request.jwt.claim.sub','c1111111-1111-4111-8111-111111111111',true);

select lives_ok($$select * from public.upsert_categorisation_rule('{"name":"Food shops","description_match":"contains","description_value":"corner shop","transaction_type":"expense","days_of_week":[],"action_category_id":"c2000000-0000-4000-8000-000000000001"}')$$,'Owned rule can be created');
select is((select count(*)::bigint from public.transaction_categorisation_rules),1::bigint,'RLS exposes the owned rule');
select throws_ok($$insert into public.transaction_categorisation_rules(user_id,name,sort_order,description_match,description_value,action_description) values('c1111111-1111-4111-8111-111111111111','Direct',9,'contains','x','y')$$,'42501','permission denied for table transaction_categorisation_rules','Direct rule writes are denied');
select throws_ok($$select * from public.upsert_categorisation_rule('{"name":"Foreign","description_match":"contains","description_value":"corner","transaction_type":"expense","days_of_week":[],"action_category_id":"c2000000-0000-4000-8000-000000000002"}')$$,'23514','A category action requires a matching transaction type and active owned category','Cross-user action ownership is rejected');
select is((public.process_categorisation_rules(array['c4000000-0000-4000-8000-000000000001'::uuid],true)->>'changed_count')::integer,1,'Dry run reports one change');
select is((select category_id from public.budget_transactions where id='c4000000-0000-4000-8000-000000000001'),null::uuid,'Dry run writes nothing');
select lives_ok($$select public.process_categorisation_rules(array['c4000000-0000-4000-8000-000000000001'::uuid],false)$$,'Bounded apply succeeds');
select is((select category_id from public.budget_transactions where id='c4000000-0000-4000-8000-000000000001'),'c2000000-0000-4000-8000-000000000001'::uuid,'Apply stores the winning action');
select is((select budget_month_item_id from public.budget_transactions where id='c4000000-0000-4000-8000-000000000001'),'c3500000-0000-4000-8000-000000000001'::uuid,'A category action links the matching month budget item');
select is((public.process_categorisation_rules(array['c4000000-0000-4000-8000-000000000001'::uuid],false)->>'changed_count')::integer,0,'Applying twice is idempotent');
select throws_ok($$select public.process_categorisation_rules(array['c4000000-0000-4000-8000-000000000002'::uuid],false)$$,'55000','Months that are two or more calendar months old are read-only','Locked reports reject rule writes');

select * from finish();
rollback;
