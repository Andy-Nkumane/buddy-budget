begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(
  id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('af100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','session-mfa@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('af100000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','session-password@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.categories(id,user_id,household_id,item_type,name,sort_order)
values
('af200000-0000-4000-8000-000000000001','af100000-0000-4000-8000-000000000001','af100000-0000-4000-8000-000000000001','expense','MFA private category',0),
('af200000-0000-4000-8000-000000000002','af100000-0000-4000-8000-000000000002','af100000-0000-4000-8000-000000000002','expense','Password-only category',0);

insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at)
values('af300000-0000-4000-8000-000000000001','af100000-0000-4000-8000-000000000001','Session test authenticator','totp','verified',now(),now());

insert into public.adviser_access_grants(
  id,household_id,grantor_user_id,adviser_user_id,adviser_email,token_hash,date_from,date_to,
  sections,starts_at,expires_at,accepted_at
) values(
  'af400000-0000-4000-8000-000000000001',
  'af100000-0000-4000-8000-000000000002',
  'af100000-0000-4000-8000-000000000002',
  'af100000-0000-4000-8000-000000000001',
  'session-mfa@test.local',
  repeat('a',64),
  '2026-10-01','2026-10-31',
  array['summary'],now()-interval '1 day',now()+interval '1 day',now()
);

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','af100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'aal','aal1'
)::text,true);

select is(public.session_meets_mfa_requirement(),false,
  'AUTH-005: An enrolled AAL1 session fails the database MFA requirement');
select is((select count(*)::integer from public.categories),0,
  'AUTH-005: An enrolled AAL1 session cannot read household financial data');
select throws_ok(
  $$insert into public.categories(user_id,household_id,item_type,name,sort_order)
    values('af100000-0000-4000-8000-000000000001','af100000-0000-4000-8000-000000000001','expense','Bypass attempt',1)$$,
  '42501',null,
  'AUTH-005: An enrolled AAL1 session cannot insert household financial data'
);
select throws_ok(
  $$select public.retrieve_adviser_data('af400000-0000-4000-8000-000000000001')$$,
  '42501','Complete your authenticator challenge before accessing financial data',
  'AUTH-005: An enrolled AAL1 adviser cannot invoke the financial report RPC'
);

select set_config('request.jwt.claims',jsonb_build_object(
  'sub','af100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'aal','aal2'
)::text,true);

select is(public.session_meets_mfa_requirement(),true,
  'AUTH-005: An enrolled AAL2 session meets the database MFA requirement');
select is((select count(*)::integer from public.categories),1,
  'AUTH-005: An enrolled AAL2 session can read its household financial data');
update public.categories set name='AAL2 update'
where id='af200000-0000-4000-8000-000000000001';
select is((select name from public.categories where id='af200000-0000-4000-8000-000000000001'),'AAL2 update',
  'AUTH-005: An enrolled AAL2 session can update its household financial data');
select is(
  public.retrieve_adviser_data('af400000-0000-4000-8000-000000000001')->>'householdId',
  'af100000-0000-4000-8000-000000000002',
  'AUTH-005: An enrolled AAL2 adviser can invoke an authorized financial report'
);

select set_config('request.jwt.claims',jsonb_build_object(
  'sub','af100000-0000-4000-8000-000000000002',
  'role','authenticated',
  'aal','aal1'
)::text,true);

select is(public.session_meets_mfa_requirement(),true,
  'AUTH-005: A password-only AAL1 account remains supported');
select is((select count(*)::integer from public.categories),1,
  'AUTH-005: A password-only account can read its own household financial data');
select is((select count(*)::integer from public.categories where id='af200000-0000-4000-8000-000000000001'),0,
  'AUTH-005: MFA enforcement does not weaken cross-household isolation');

reset role;
select ok(
  not has_function_privilege('authenticated','public.retrieve_adviser_data_authorized(uuid)','execute'),
  'AUTH-005: Browser roles cannot bypass the adviser MFA wrapper'
);

select * from finish();
rollback;

