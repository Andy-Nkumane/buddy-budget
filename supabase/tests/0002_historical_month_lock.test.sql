begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'history@example.test',
  extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

update public.profiles
set display_name = 'History Tester', timezone = 'Africa/Johannesburg'
where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

insert into public.budget_months (id, user_id, month_start, currency_code)
values
  (
    'd1000000-0000-4000-8000-000000000001',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '2 months')::date,
    'ZAR'
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '1 month')::date,
    'ZAR'
  );

insert into public.budget_month_items (
  id, budget_month_id, user_id, item_type, name_snapshot, amount
)
values
  (
    'd2000000-0000-4000-8000-000000000001',
    'd1000000-0000-4000-8000-000000000001',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'expense', 'Locked item', 100
  ),
  (
    'd2000000-0000-4000-8000-000000000002',
    'd1000000-0000-4000-8000-000000000002',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'expense', 'Editable item', 100
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);

select lives_ok(
  $$update public.budget_month_items
      set amount = 125
      where id = 'd2000000-0000-4000-8000-000000000002'$$,
  'The previous calendar month remains editable'
);

select throws_ok(
  $$update public.budget_month_items
      set amount = 125
      where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '55000',
  'Months that are two or more calendar months old are read-only',
  'Amounts in locked months cannot be updated'
);

select throws_ok(
  $$insert into public.budget_month_items (
      budget_month_id, user_id, item_type, name_snapshot, amount
    ) values (
      'd1000000-0000-4000-8000-000000000001',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'expense', 'Late item', 10
    )$$,
  '55000',
  'Months that are two or more calendar months old are read-only',
  'Items cannot be added to locked months'
);

select throws_ok(
  $$delete from public.budget_month_items
      where id = 'd2000000-0000-4000-8000-000000000001'$$,
  '55000',
  'Months that are two or more calendar months old are read-only',
  'Items cannot be deleted from locked months'
);

select throws_ok(
  $$update public.budget_months
      set notes = 'Changed'
      where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '55000',
  'Months that are two or more calendar months old are read-only',
  'Locked month records cannot be updated'
);

select throws_ok(
  $$delete from public.budget_months
      where id = 'd1000000-0000-4000-8000-000000000001'$$,
  '55000',
  'Months that are two or more calendar months old are read-only',
  'Locked month records cannot be deleted'
);

select throws_ok(
  $$insert into public.budget_months (user_id, month_start, currency_code)
    values (
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '3 months')::date,
      'ZAR'
    )$$,
  '55000',
  'Months that are two or more calendar months old are read-only',
  'Locked months cannot be created later'
);

select lives_ok(
  $$insert into public.budget_month_items (
      budget_month_id, user_id, item_type, name_snapshot, amount
    ) values (
      'd1000000-0000-4000-8000-000000000002',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'income', 'Recent item', 50
    )$$,
  'Items can still be added to the previous calendar month'
);

select * from finish();
rollback;
