begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f1111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','close-a@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('f2222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','close-b@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('f3333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','close-delete@example.test',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
update public.profiles set timezone='Africa/Johannesburg' where user_id in ('f1111111-1111-4111-8111-111111111111','f2222222-2222-4222-8222-222222222222','f3333333-3333-4333-8333-333333333333');

insert into public.budget_months(id,user_id,month_start,currency_code) values
('f3000000-0000-4000-8000-000000000001','f1111111-1111-4111-8111-111111111111',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,'ZAR'),
('f3000000-0000-4000-8000-000000000002','f1111111-1111-4111-8111-111111111111',(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '1 month')::date,'ZAR'),
('f3000000-0000-4000-8000-000000000003','f1111111-1111-4111-8111-111111111111',(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '2 months')::date,'ZAR'),
('f3000000-0000-4000-8000-000000000004','f2222222-2222-4222-8222-222222222222',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,'ZAR'),
('f3000000-0000-4000-8000-000000000005','f1111111-1111-4111-8111-111111111111',(date_trunc('month',now() at time zone 'Africa/Johannesburg')+interval '1 month')::date,'ZAR'),
('f3000000-0000-4000-8000-000000000006','f3333333-3333-4333-8333-333333333333',date_trunc('month',now() at time zone 'Africa/Johannesburg')::date,'ZAR');
insert into public.budget_month_items(id,budget_month_id,user_id,item_type,name_snapshot,amount) values
('f4000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002','f1111111-1111-4111-8111-111111111111','income','Salary',1000),
('f4000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000002','f1111111-1111-4111-8111-111111111111','expense','Rent',400);
insert into public.budget_transactions(id,user_id,budget_month_id,transaction_date,description,amount_minor,transaction_type) values
('f5000000-0000-4000-8000-000000000001','f1111111-1111-4111-8111-111111111111','f3000000-0000-4000-8000-000000000002',(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '1 month')::date,'Salary',100000,'income'),
('f5000000-0000-4000-8000-000000000002','f1111111-1111-4111-8111-111111111111','f3000000-0000-4000-8000-000000000003',(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '2 months')::date,'Locked expense',1000,'expense');
create temporary table locked_before as select md5(row_to_json(month.*)::text) month_hash,(select md5(row_to_json(entry.*)::text) from public.budget_transactions entry where entry.id='f5000000-0000-4000-8000-000000000002') transaction_hash from public.budget_months month where month.id='f3000000-0000-4000-8000-000000000003';
grant select on table locked_before to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','f1111111-1111-4111-8111-111111111111',true);
select lives_ok($$select * from public.close_budget_month('f3000000-0000-4000-8000-000000000002',true)$$,'An editable month closes transactionally');
select is((select state from public.budget_month_lifecycle where budget_month_id='f3000000-0000-4000-8000-000000000002'),'closed','Lifecycle becomes closed');
select is((select actual_balance_minor from public.month_close_summaries where budget_month_id='f3000000-0000-4000-8000-000000000002'),100000::bigint,'Close summary preserves exact derived balance');
select lives_ok($$select * from public.close_budget_month('f3000000-0000-4000-8000-000000000002',true)$$,'Closing twice is idempotent');
select is((select count(*)::bigint from public.month_close_summaries where budget_month_id='f3000000-0000-4000-8000-000000000002'),1::bigint,'Idempotent close creates one summary');
select is((select count(*)::bigint from public.month_lifecycle_events where budget_month_id='f3000000-0000-4000-8000-000000000002' and event_type='closed'),1::bigint,'Idempotent close creates one close event');
select throws_ok($$update public.budget_month_items set amount=500 where id='f4000000-0000-4000-8000-000000000002'$$,'55000','Closed months are read-only until reopened','Closed month items cannot mutate');
select lives_ok($$select * from public.reopen_budget_month('f3000000-0000-4000-8000-000000000002')$$,'Editable closed month can reopen');
select is((select state from public.budget_month_lifecycle where budget_month_id='f3000000-0000-4000-8000-000000000002'),'open','Reopen restores open state');
select is((select count(*)::bigint from public.month_lifecycle_events where budget_month_id='f3000000-0000-4000-8000-000000000002' and event_type='reopened'),1::bigint,'Reopen is audited');
select throws_ok($$select * from public.reopen_budget_month('f3000000-0000-4000-8000-000000000003')$$,'55000','Age-locked months cannot be reopened','Age-locked month cannot reopen');
select throws_ok($$select * from public.close_budget_month('f3000000-0000-4000-8000-000000000005',true)$$,'22023','Future months cannot be closed','Future month cannot close');
select lives_ok($$select * from public.create_month_adjustment('f3000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000001','expense','increase',2500,'Late bank fee','f6000000-0000-4000-8000-000000000001')$$,'Locked month accepts a current-month adjustment');
select lives_ok($$select * from public.create_month_adjustment('f3000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000001','expense','increase',2500,'Late bank fee','f6000000-0000-4000-8000-000000000001')$$,'Adjustment retry is idempotent');
select throws_ok($$select * from public.create_month_adjustment('f3000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000001','expense','increase',2600,'Different retry','f6000000-0000-4000-8000-000000000001')$$,'22023','Idempotency key was already used for a different adjustment','Idempotency key cannot hide a different payload');
select is((select count(*)::bigint from public.month_adjustments where original_budget_month_id='f3000000-0000-4000-8000-000000000003'),1::bigint,'Adjustment retry does not duplicate');
select is((select md5(row_to_json(month.*)::text) from public.budget_months month where month.id='f3000000-0000-4000-8000-000000000003'),(select month_hash from locked_before),'Adjustment leaves locked month byte-for-byte unchanged');
select is((select md5(row_to_json(entry.*)::text) from public.budget_transactions entry where entry.id='f5000000-0000-4000-8000-000000000002'),(select transaction_hash from locked_before),'Adjustment leaves locked transaction byte-for-byte unchanged');
reset role;
select throws_ok($$update public.month_adjustments set reason='Changed reason' where original_budget_month_id='f3000000-0000-4000-8000-000000000003'$$,'55000','Month history is append-only','Adjustments are append-only');
set local role authenticated;
select set_config('request.jwt.claim.sub','f2222222-2222-4222-8222-222222222222',true);
select throws_ok($$select * from public.create_month_adjustment('f3000000-0000-4000-8000-000000000003','f3000000-0000-4000-8000-000000000004','expense','increase',100,'Foreign month','f6000000-0000-4000-8000-000000000002')$$,'42501','Budget month not found','Cross-user adjustment is rejected');
select set_config('request.jwt.claim.sub','f3333333-3333-4333-8333-333333333333',true);
select lives_ok($$select * from public.close_budget_month('f3000000-0000-4000-8000-000000000006',true)$$,'A deletion test month can close');
select lives_ok($$select public.delete_own_account()$$,'Account deletion cascades through append-only close history');

select * from finish();
rollback;
