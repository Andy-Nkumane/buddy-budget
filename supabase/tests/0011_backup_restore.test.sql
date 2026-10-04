begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('b9111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','restore-source@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('b9222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','restore-target@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('b9333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','restore-other@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.categories(id,user_id,item_type,name,sort_order) values
('b9400000-0000-4000-8000-000000000001','b9111111-1111-4111-8111-111111111111','expense','Portable category',1);
insert into public.budget_templates(id,user_id,name,is_default) values
('b9500000-0000-4000-8000-000000000001','b9111111-1111-4111-8111-111111111111','Portable template',true);
insert into public.template_items(id,template_id,user_id,category_id,item_type,name,default_amount,sort_order) values
('b9600000-0000-4000-8000-000000000001','b9500000-0000-4000-8000-000000000001','b9111111-1111-4111-8111-111111111111','b9400000-0000-4000-8000-000000000001','expense','Portable item',123.45,1);
insert into public.budget_months(id,user_id,source_template_id,month_start,currency_code) values
('b9700000-0000-4000-8000-000000000001','b9111111-1111-4111-8111-111111111111','b9500000-0000-4000-8000-000000000001',(date_trunc('month',now())-interval '2 months')::date,'ZAR');
insert into public.budget_month_items(id,budget_month_id,user_id,source_template_item_id,category_id,item_type,name_snapshot,category_snapshot,amount) values
('b9800000-0000-4000-8000-000000000001','b9700000-0000-4000-8000-000000000001','b9111111-1111-4111-8111-111111111111','b9600000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001','expense','Portable item','Portable category',123.45);
insert into public.budget_transactions(id,user_id,budget_month_id,budget_month_item_id,category_id,transaction_date,description,amount_minor,transaction_type,status) values
('b9900000-0000-4000-8000-000000000001','b9111111-1111-4111-8111-111111111111','b9700000-0000-4000-8000-000000000001','b9800000-0000-4000-8000-000000000001','b9400000-0000-4000-8000-000000000001',(date_trunc('month',now())-interval '2 months')::date,'Portable transaction',12345,'expense','posted');

create temporary table restore_fixture(payload jsonb);
insert into restore_fixture select public.create_backup_recovery_payload('b9111111-1111-4111-8111-111111111111');
grant select, update on restore_fixture to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','b9222222-2222-4222-8222-222222222222',true);
select lives_ok($$select public.restore_backup((select payload from restore_fixture),'merge',repeat('1',64),'')$$,'Merge restores a valid backup transactionally');
select is((select count(*)::bigint from public.categories where user_id='b9222222-2222-4222-8222-222222222222' and name='Portable category'),1::bigint,'Category is reconstructed');
select is((select count(*)::bigint from public.budget_transactions where user_id='b9222222-2222-4222-8222-222222222222' and description='Portable transaction'),1::bigint,'Nested transaction is reconstructed');
select is((select user_id from public.budget_transactions where description='Portable transaction'),'b9222222-2222-4222-8222-222222222222'::uuid,'Restored records are reassigned to the authenticated owner');
select isnt((select id from public.categories where user_id='b9222222-2222-4222-8222-222222222222' and name='Portable category'),'b9400000-0000-4000-8000-000000000001'::uuid,'Source IDs are explicitly remapped');
select lives_ok($$select public.restore_backup((select payload from restore_fixture),'merge',repeat('1',64),'')$$,'Retry returns the completed idempotent report');
select is((select count(*)::bigint from public.budget_transactions where user_id='b9222222-2222-4222-8222-222222222222'),1::bigint,'Idempotent retry creates no duplicate');

update restore_fixture set payload=jsonb_set(payload,'{budget_months,0,budget_transactions,0,description}','"Tampered locked history"');
select lives_ok($$select public.restore_backup((select payload from restore_fixture),'merge',repeat('2',64),'')$$,'A second merge matches the existing month');
select is((select description from public.budget_transactions where user_id='b9222222-2222-4222-8222-222222222222'),'Portable transaction','Merge never rewrites an existing locked month');

select set_config('request.jwt.claims',jsonb_build_object('sub','b9222222-2222-4222-8222-222222222222','role','authenticated')::text,true);
select throws_ok($$select public.restore_backup((select payload from restore_fixture),'replace',repeat('5',64),'REPLACE MY DATA')$$,'42501','Re-enter your password before replacing all data','Replacement requires a recent password authentication event');
select set_config('request.jwt.claims',jsonb_build_object('sub','b9222222-2222-4222-8222-222222222222','role','authenticated','iat',extract(epoch from now())::bigint,
  'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint)))::text,true);
select lives_ok($$select public.restore_backup((select payload from restore_fixture),'replace',repeat('3',64),'REPLACE MY DATA')$$,'Recently authenticated replacement succeeds');
select is((select count(*)::bigint from public.backup_recovery_snapshots where user_id='b9222222-2222-4222-8222-222222222222'),1::bigint,'Replacement first creates a server recovery snapshot');
select is((select count(*)::bigint from public.budget_transactions where user_id='b9222222-2222-4222-8222-222222222222'),1::bigint,'Replacement reconstructs the transaction graph');
select lives_ok($$select public.rollback_backup_restore((select id from public.backup_recovery_snapshots where user_id='b9222222-2222-4222-8222-222222222222' order by created_at limit 1),'REPLACE MY DATA')$$,'Owned recovery snapshot can be restored');
select is((select description from public.budget_transactions where user_id='b9222222-2222-4222-8222-222222222222'),'Portable transaction','Recovery snapshot restores the pre-replacement graph');

select throws_ok($$select public.restore_backup(jsonb_set((select payload from restore_fixture),'{categories,0,name}','""'),'merge',repeat('4',64),'')$$,'23514',null,'Constraint failure aborts a hostile restore');
select is((select count(*)::bigint from public.backup_restore_runs where user_id='b9222222-2222-4222-8222-222222222222' and backup_fingerprint=repeat('4',64)),0::bigint,'Failed transaction leaves no partial restore run');

select set_config('request.jwt.claim.sub','b9333333-3333-4333-8333-333333333333',true);
select is((select count(*)::bigint from public.backup_restore_runs),0::bigint,'Another user cannot read restore runs through RLS');
select is((select count(*)::bigint from public.backup_recovery_snapshots),0::bigint,'Another user cannot read recovery snapshots through RLS');

select * from finish();
rollback;
