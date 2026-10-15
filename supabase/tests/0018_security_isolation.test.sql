begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema='public' and grantee='anon'),
  0,
  'Anonymous users have no direct public-table privileges'
);
select is(
  (select count(*)::integer from pg_proc procedure
   join pg_namespace namespace on namespace.oid=procedure.pronamespace
   where namespace.nspname='public' and has_function_privilege('anon',procedure.oid,'execute')),
  0,
  'Anonymous users cannot execute public-schema functions'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema='public' and grantee='authenticated'
     and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')),
  0,
  'Authenticated users have no RLS-bypassing or schema-control table privileges'
);
select is(
  (select count(*)::integer from pg_class relation
   join pg_namespace namespace on namespace.oid=relation.relnamespace
   where namespace.nspname='public' and relation.relkind in ('r','p')
     and not relation.relrowsecurity),
  0,
  'Every public table has RLS enabled'
);
select is(
  (select count(*)::integer from pg_proc procedure
   join pg_namespace namespace on namespace.oid=procedure.pronamespace
   where namespace.nspname='public' and procedure.prosecdef
     and not coalesce(procedure.proconfig,'{}'::text[]) @> array['search_path=""']),
  0,
  'Every SECURITY DEFINER function fixes an empty search_path'
);
select is(
  (select count(*)::integer from pg_proc procedure
   join pg_namespace namespace on namespace.oid=procedure.pronamespace
   where namespace.nspname='public' and procedure.prorettype='trigger'::regtype
     and has_function_privilege('authenticated',procedure.oid,'execute')),
  0,
  'Authenticated users cannot invoke trigger functions directly'
);
select ok(not has_function_privilege('authenticated','public.claim_due_weekly_checkins(integer)','execute'),
  'Authenticated users cannot claim server delivery jobs');
select ok(has_function_privilege('service_role','public.claim_due_weekly_checkins(integer)','execute'),
  'The server role retains weekly delivery access');
select ok(has_function_privilege('service_role','public.consume_shared_budget_report(text,text)','execute'),
  'The server role retains shared-report access');
select ok(not has_table_privilege('authenticated','public.categories','truncate'),
  'Authenticated users cannot truncate financial tables');

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('fd100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','isolation-one@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('fd100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','isolation-two@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fd100000-0000-4000-8000-000000000001','email','isolation-one@test.local','role','authenticated')::text,true);
insert into public.categories(id,user_id,household_id,item_type,name,sort_order)
values('fd200000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','expense','Private category',0);
select is((select count(*)::integer from public.categories where id='fd200000-0000-4000-8000-000000000001'),1,
  'The owning user can read their record');

select set_config('request.jwt.claim.sub','fd100000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','fd100000-0000-4000-8000-000000000002','email','isolation-two@test.local','role','authenticated')::text,true);
select is((select count(*)::integer from public.categories where id='fd200000-0000-4000-8000-000000000001'),0,
  'A different user cannot SELECT the record');
select throws_ok(
  $$insert into public.categories(user_id,household_id,item_type,name,sort_order)
    values('fd100000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','expense','Forged owner',1)$$,
  '42501',null,'A different user cannot INSERT with forged ownership IDs'
);
update public.categories set name='Cross-user update' where id='fd200000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.categories where id='fd200000-0000-4000-8000-000000000001'),0,
  'A cross-user UPDATE cannot expose or return the target');
delete from public.categories where id='fd200000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.categories where id='fd200000-0000-4000-8000-000000000001'),0,
  'A cross-user DELETE cannot expose or return the target');

reset role;
select is((select name from public.categories where id='fd200000-0000-4000-8000-000000000001'),'Private category',
  'The cross-user UPDATE was blocked');
select is((select count(*)::integer from public.categories where id='fd200000-0000-4000-8000-000000000001'),1,
  'The cross-user DELETE was blocked');

set local role anon;
select throws_ok($$select count(*) from public.categories$$,
  '42501',null,'Anonymous SELECT is denied');
select throws_ok(
  $$insert into public.categories(user_id,household_id,item_type,name,sort_order)
    values('fd100000-0000-4000-8000-000000000001','fd100000-0000-4000-8000-000000000001','expense','Anonymous insert',2)$$,
  '42501',null,'Anonymous INSERT is denied'
);
select throws_ok($$update public.categories set name='Anonymous update'$$,
  '42501',null,'Anonymous UPDATE is denied');
select throws_ok($$delete from public.categories$$,
  '42501',null,'Anonymous DELETE is denied');

select * from finish();
rollback;
