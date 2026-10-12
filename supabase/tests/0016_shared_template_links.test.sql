begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('fb100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','template-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('fb100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','template-recipient@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('fb100000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','template-viewer@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.categories(id,user_id,household_id,item_type,name,sort_order)
values('fb200000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','expense','Housing',0);
insert into public.budget_templates(id,user_id,household_id,name,is_default)
values('fb300000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','Simple home',true);
insert into public.template_items(id,template_id,user_id,household_id,category_id,item_type,name,default_amount,sort_order)
values('fb400000-0000-4000-8000-000000000001','fb300000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','fb200000-0000-4000-8000-000000000001','expense','Rent',1250.00,0);

select lives_ok($$select public.create_shared_template_link(
  'fb100000-0000-4000-8000-000000000001','fb300000-0000-4000-8000-000000000001',repeat('a',64),false,now()+interval '7 days')$$,
  'An owner can publish a template snapshot');
select is((select snapshot->>'name' from public.shared_template_links where token_hash=repeat('a',64)),'Simple home','The snapshot records the template name');
select ok(not (select snapshot->'items'->0 ? 'amount' from public.shared_template_links where token_hash=repeat('a',64)),'Amounts are absent by default');
select is((select snapshot->'items'->0->>'categoryName' from public.shared_template_links where token_hash=repeat('a',64)),'Housing','The snapshot includes the category name');
select isnt((select snapshot->'items'->0->>'key' from public.shared_template_links where token_hash=repeat('a',64)),'fb400000-0000-4000-8000-000000000001','The public item key does not expose the source record ID');
select is((select public.consume_shared_template_link(repeat('a',64),repeat('b',64))->'snapshot'->>'name'),'Simple home','A valid opaque token opens the snapshot');

select lives_ok($$select public.copy_shared_template_link(
  'fb100000-0000-4000-8000-000000000002',repeat('a',64),'fb500000-0000-4000-8000-000000000001','My home',
  (select jsonb_build_array(jsonb_build_object('key',snapshot->'items'->0->>'key','name','Housing payment','itemType','expense','categoryName','Home','amount','900.00')) from public.shared_template_links where token_hash=repeat('a',64)))$$,
  'An editor-capable recipient can copy and customise the snapshot');
select is((select count(*)::integer from public.shared_template_copies where recipient_user_id='fb100000-0000-4000-8000-000000000002'),1,'The copy operation records one idempotency result');
select lives_ok($$select public.copy_shared_template_link(
  'fb100000-0000-4000-8000-000000000002',repeat('a',64),'fb500000-0000-4000-8000-000000000001','My home',
  (select jsonb_build_array(jsonb_build_object('key',snapshot->'items'->0->>'key','name','Housing payment','itemType','expense','categoryName','Home','amount','900.00')) from public.shared_template_links where token_hash=repeat('a',64)))$$,
  'Retrying the same copy key succeeds idempotently');
select is((select count(*)::integer from public.budget_templates where household_id='fb100000-0000-4000-8000-000000000002' and name='My home'),1,'A retry does not duplicate the owned template');
select is((select default_amount::numeric from public.template_items where household_id='fb100000-0000-4000-8000-000000000002' and name='Housing payment'),900.00::numeric,'The recipient customisation is copied exactly');
select isnt((select user_id from public.budget_templates where household_id='fb100000-0000-4000-8000-000000000002' and name='My home'),'fb100000-0000-4000-8000-000000000001'::uuid,'The copy retains no source ownership ID');
select throws_ok($$update public.shared_template_links set snapshot='{}' where token_hash=repeat('a',64)$$,'55000','Shared template snapshots are immutable','A published snapshot cannot be rewritten');

select ok(public.revoke_shared_template_link('fb100000-0000-4000-8000-000000000001',(select id from public.shared_template_links where token_hash=repeat('a',64))),'The owner can revoke the link');
select is(public.consume_shared_template_link(repeat('a',64),repeat('b',64)),null::jsonb,'Revocation blocks future preview access');
select throws_ok($$select public.copy_shared_template_link(
  'fb100000-0000-4000-8000-000000000002',repeat('a',64),'fb500000-0000-4000-8000-000000000002','Another copy',
  (select jsonb_build_array(jsonb_build_object('key',snapshot->'items'->0->>'key','name','Rent','itemType','expense','categoryName','Home','amount','1.00')) from public.shared_template_links where token_hash=repeat('a',64)))$$,
  'P0002','Shared template unavailable','Revocation blocks future copies');

insert into public.household_memberships(household_id,user_id,role)
values('fb100000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000003','viewer');
update public.profiles set active_household_id='fb100000-0000-4000-8000-000000000001'
where user_id='fb100000-0000-4000-8000-000000000003';
select throws_ok($$select public.create_shared_template_link(
  'fb100000-0000-4000-8000-000000000003','fb300000-0000-4000-8000-000000000001',repeat('c',64),false,now()+interval '1 day')$$,
  '42501','Shared report management requires the active household owner','A viewer cannot publish a template');
select ok(not has_table_privilege('anon','public.shared_template_links','select'),'Anonymous clients cannot query the link table');

select * from finish();
rollback;
