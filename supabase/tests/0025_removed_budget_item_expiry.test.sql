begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  'b2100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'authenticated','authenticated','removed-items@test.local',
  extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()
);

insert into public.budget_months(id,user_id,household_id,month_start,currency_code) values(
  'b2200000-0000-4000-8000-000000000001','b2100000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',date_trunc('month',current_date)::date,'ZAR'
);

insert into public.budget_month_items(
  id,budget_month_id,user_id,household_id,item_type,name_snapshot,category_snapshot,
  default_amount_snapshot,amount,sort_order,archived_at
) values
  ('b2300000-0000-4000-8000-000000000001','b2200000-0000-4000-8000-000000000001',
   'b2100000-0000-4000-8000-000000000001','b2100000-0000-4000-8000-000000000001',
   'expense','Recent item','Groceries',100,100,0,now() - interval '23 hours'),
  ('b2300000-0000-4000-8000-000000000002','b2200000-0000-4000-8000-000000000001',
   'b2100000-0000-4000-8000-000000000001','b2100000-0000-4000-8000-000000000001',
   'expense','Expired item','Transport',100,100,1,now() - interval '25 hours');

set local role authenticated;
select set_config('request.jwt.claim.sub','b2100000-0000-4000-8000-000000000001',true);

select lives_ok(
  $$update public.budget_month_items set archived_at=null
    where id='b2300000-0000-4000-8000-000000000001'$$,
  'An item remains restorable during its first 24 hours'
);
update public.budget_month_items set archived_at=now()
where id='b2300000-0000-4000-8000-000000000001';

select throws_ok(
  $$update public.budget_month_items set archived_at=null
    where id='b2300000-0000-4000-8000-000000000002'$$,
  '22023','This budget item can no longer be restored',
  'An expired item cannot be restored through a direct update'
);
select is(public.delete_expired_budget_month_items(),1::bigint,
  'Cleanup permanently removes expired household items');
select is((select count(*) from public.budget_month_items),1::bigint,
  'Cleanup keeps items that are still inside the restore window');

select * from finish();
rollback;
