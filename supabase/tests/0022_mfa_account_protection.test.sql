begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('ae100000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mfa-owner@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());
insert into auth.mfa_factors(id,user_id,friendly_name,factor_type,status,created_at,updated_at)
values('ae200000-0000-4000-8000-000000000001','ae100000-0000-4000-8000-000000000001','Test authenticator','totp','verified',now(),now());

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object(
  'sub','ae100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'aal','aal1',
  'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint))
)::text,true);
select throws_ok(
  $$select public.delete_own_account()$$,
  '42501',
  'Verify your authenticator before deleting your account',
  'AUTH-002: An enrolled aal1 session cannot delete its account'
);

select set_config('request.jwt.claims',jsonb_build_object(
  'sub','ae100000-0000-4000-8000-000000000001',
  'role','authenticated',
  'aal','aal2',
  'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from now())::bigint))
)::text,true);
select lives_ok(
  $$select public.delete_own_account()$$,
  'AUTH-002: A recently reauthenticated aal2 session can delete its account'
);

select * from finish();
rollback;
