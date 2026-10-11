begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f1000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','milestone-one@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now()),
('f1000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','milestone-two@test.local',extensions.crypt('password',extensions.gen_salt('bf')),now(),'{}','{}',now(),now());

set local role authenticated;
select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
select ok(public.claim_activation_milestone('first_export'),'First user milestone is claimed');
select isnt(public.claim_activation_milestone('first_export'),true,'A repeated user claim is rejected');
do $$ begin perform public.complete_first_budget_onboarding(
  'f2000000-0000-4000-8000-000000000001','blank','Milestone user','ZAR','en-ZA','Africa/Johannesburg','First plan',
  '[{"name":"Income","item_type":"income","category_name":"Earnings","default_amount":"1000.00"}]'::jsonb
); end $$;
select ok(public.claim_activation_milestone('first_budget'),'First household milestone is claimed');
select isnt(public.claim_activation_milestone('first_budget'),true,'A repeated household claim is rejected');
select is((select count(*)::integer from public.activation_milestones),2,'Only one row exists per intended scope');
select throws_ok(
  $$select public.claim_activation_milestone('registration')$$,
  '22023','Invalid milestone request','Registration cannot create a milestone'
);

select set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000002',true);
select ok(public.claim_activation_milestone('first_export'),'Another user has an independent export milestone');
select is((select count(*)::integer from public.activation_milestones),1,'RLS hides another user and household milestones');

select * from finish();
rollback;
