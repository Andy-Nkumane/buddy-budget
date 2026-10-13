begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'importer@example.test', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('b2222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-importer@example.test', extensions.crypt('password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles set timezone = 'Africa/Johannesburg'
where user_id = 'a1111111-1111-4111-8111-111111111111';

insert into public.budget_months (id, user_id, month_start, currency_code) values
  ('a1000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', date_trunc('month', now() at time zone 'Africa/Johannesburg')::date, 'ZAR'),
  ('a1000000-0000-4000-8000-000000000002', 'a1111111-1111-4111-8111-111111111111', (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '2 months')::date, 'ZAR'),
  ('b1000000-0000-4000-8000-000000000001', 'b2222222-2222-4222-8222-222222222222', date_trunc('month', now())::date, 'ZAR');

insert into public.financial_accounts (id, user_id, name, account_type, currency_code) values
  ('a4000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'Current', 'checking', 'ZAR'),
  ('b4000000-0000-4000-8000-000000000001', 'b2222222-2222-4222-8222-222222222222', 'Other', 'checking', 'ZAR');

insert into public.transaction_import_batches (
  user_id, budget_month_id, file_name, batch_key,
  total_count, accepted_count, duplicate_count, invalid_count, excluded_count
) values (
  'b2222222-2222-4222-8222-222222222222',
  'b1000000-0000-4000-8000-000000000001',
  'other-user.csv', repeat('0', 64), 0, 0, 0, 0, 0
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $$select * from public.import_budget_transactions(
    'a1000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000001', 'statement.csv', repeat('a', 64),
    '{"delimiter":"comma","date_format":"ymd","decimal_format":"dot","amount_mode":"signed","date_column":0,"description_column":1,"amount_column":2}',
    jsonb_build_array(
      jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', 'Coffee', 'amount_minor', 1000, 'transaction_type', 'expense', 'external_fingerprint', repeat('1', 64)),
      jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', 'Coffee', 'amount_minor', 1000, 'transaction_type', 'expense', 'external_fingerprint', repeat('2', 64))
    ), 0, 0
  )$$,
  'An owned CSV batch imports through one secured operation'
);

select results_eq(
  $$select accepted_count, duplicate_count from public.transaction_import_batches where batch_key = repeat('a', 64)$$,
  $$values (2, 0)$$,
  'Same-date and same-amount transactions remain distinct when fingerprints differ'
);

select results_eq(
  $$select accepted_count, was_existing from public.import_budget_transactions(
    'a1000000-0000-4000-8000-000000000001', null, 'renamed.csv', repeat('a', 64),
    '{"delimiter":"comma","date_format":"ymd","decimal_format":"dot","amount_mode":"signed"}',
    jsonb_build_array(jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', 'Ignored', 'amount_minor', 999, 'transaction_type', 'expense', 'external_fingerprint', repeat('3', 64))), 0, 0
  )$$,
  $$values (2, true)$$,
  'Replaying a batch key is idempotent'
);

select results_eq(
  $$select count(*)::bigint from public.budget_transactions where source = 'csv_import'$$,
  $$values (2::bigint)$$,
  'Idempotent replay creates no duplicate transactions'
);

select throws_ok(
  $$select * from public.import_budget_transactions(
    'a1000000-0000-4000-8000-000000000001', null, 'bad.csv', repeat('b', 64),
    '{"delimiter":"comma","date_format":"ymd","decimal_format":"dot","amount_mode":"signed"}',
    jsonb_build_array(
      jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', 'Valid', 'amount_minor', 100, 'transaction_type', 'expense', 'external_fingerprint', repeat('4', 64)),
      jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', '', 'amount_minor', 100, 'transaction_type', 'expense', 'external_fingerprint', repeat('5', 64))
    ), 0, 0
  )$$,
  '22023', 'One or more normalized import rows are invalid for the destination month',
  'A malformed member rejects the entire transaction'
);

select results_eq(
  $$select count(*)::bigint from public.transaction_import_batches where batch_key = repeat('b', 64)$$,
  $$values (0::bigint)$$,
  'A failed transactional batch leaves no batch metadata'
);

select throws_ok(
  $$select * from public.import_budget_transactions(
    'b1000000-0000-4000-8000-000000000001', null, 'foreign.csv', repeat('c', 64),
    '{"delimiter":"comma","date_format":"ymd","decimal_format":"dot","amount_mode":"signed"}',
    jsonb_build_array(jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', 'Foreign', 'amount_minor', 100, 'transaction_type', 'expense', 'external_fingerprint', repeat('6', 64))), 0, 0
  )$$,
  '42501', 'Budget month not found',
  'A user cannot import into another user month'
);

select throws_ok(
  $$select * from public.import_budget_transactions(
    'a1000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'foreign-account.csv', repeat('d', 64),
    '{"delimiter":"comma","date_format":"ymd","decimal_format":"dot","amount_mode":"signed"}',
    jsonb_build_array(jsonb_build_object('transaction_date', date_trunc('month', now())::date, 'description', 'Foreign', 'amount_minor', 100, 'transaction_type', 'expense', 'external_fingerprint', repeat('7', 64))), 0, 0
  )$$,
  '23514', 'Import account must be active, owned by the user, and use the month currency',
  'A user cannot assign another user account'
);

select throws_ok(
  $$select * from public.import_budget_transactions(
    'a1000000-0000-4000-8000-000000000002', null, 'locked.csv', repeat('e', 64),
    '{"delimiter":"comma","date_format":"ymd","decimal_format":"dot","amount_mode":"signed"}',
    jsonb_build_array(jsonb_build_object('transaction_date', (date_trunc('month', now()) - interval '2 months')::date, 'description', 'Locked', 'amount_minor', 100, 'transaction_type', 'expense', 'external_fingerprint', repeat('8', 64))), 0, 0
  )$$,
  '55000', 'Months that are two or more calendar months old are read-only',
  'CSV writes are rejected for locked historical reports'
);

select results_eq(
  $$select count(*)::bigint from public.transaction_import_batches$$,
  $$values (1::bigint)$$,
  'RLS hides import batches owned by another user and failed requests persist nothing'
);

select throws_ok(
  $$insert into public.transaction_import_batches (user_id, budget_month_id, file_name, batch_key, total_count, accepted_count, duplicate_count, invalid_count, excluded_count) values ('a1111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'direct.csv', repeat('f', 64), 0, 0, 0, 0, 0)$$,
  '42501', 'permission denied for table transaction_import_batches',
  'Direct import batch writes are denied'
);

select lives_ok(
  $statement$select * from public.undo_transaction_import_batch((select id from public.transaction_import_batches where batch_key = repeat('a', 64)))$statement$,
  'An editable import batch can be undone atomically'
);

select results_eq(
  $$select count(*)::bigint from public.budget_transactions where source = 'csv_import'$$,
  $$values (0::bigint)$$,
  'Undo removes every transaction created by the batch'
);

set local role postgres;
insert into public.transaction_import_batches (id, user_id, budget_month_id, file_name, batch_key, mapping_metadata, total_count, accepted_count, duplicate_count, invalid_count, excluded_count) values ('a9000000-0000-4000-8000-000000000001', 'a1111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000002', 'old.csv', repeat('9', 64), '{}', 0, 0, 0, 0, 0);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-4111-8111-111111111111', true);

select throws_ok(
  $$select * from public.undo_transaction_import_batch('a9000000-0000-4000-8000-000000000001')$$,
  '55000', 'Months that are two or more calendar months old are read-only',
  'Undo is rejected after the affected month locks'
);

select * from finish();
rollback;
