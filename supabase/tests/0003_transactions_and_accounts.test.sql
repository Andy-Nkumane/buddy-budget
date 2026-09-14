begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'ledger@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'other-ledger@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

update public.profiles set timezone = 'Africa/Johannesburg'
where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

insert into public.budget_months (id, user_id, month_start, currency_code)
values
  (
    'e1000000-0000-4000-8000-000000000001',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    date_trunc('month', now() at time zone 'Africa/Johannesburg')::date,
    'ZAR'
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '2 months')::date,
    'ZAR'
  ),
  (
    'f1000000-0000-4000-8000-000000000001',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    date_trunc('month', now())::date,
    'ZAR'
  );

insert into public.categories (id, user_id, item_type, name)
values
  ('e2000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'expense', 'Food'),
  ('f2000000-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'expense', 'Other food');

insert into public.budget_month_items (
  id, budget_month_id, user_id, item_type, name_snapshot, amount, is_disabled
)
values
  (
    'e3000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000001',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'expense', 'Groceries', 100, true
  ),
  (
    'e3000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000001',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'income', 'Salary', 1000, false
  );

insert into public.financial_accounts (
  id, user_id, name, account_type, currency_code, opening_balance_minor
)
values
  ('e4000000-0000-4000-8000-000000000001', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Wallet', 'cash', 'ZAR', 10000),
  ('e4000000-0000-4000-8000-000000000002', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Dollar wallet', 'cash', 'USD', 0),
  ('f4000000-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'Other wallet', 'cash', 'ZAR', 0);

insert into public.budget_transactions (
  id, user_id, budget_month_id, transaction_date, description, amount_minor,
  transaction_type, status
)
values (
  'e5000000-0000-4000-8000-000000000001',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'e1000000-0000-4000-8000-000000000002',
  (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '2 months')::date,
  'Locked transaction', 1000, 'expense', 'posted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);

select results_eq(
  $$select count(*)::bigint from public.financial_accounts$$,
  $$values (2::bigint)$$,
  'RLS hides another user financial accounts'
);

select lives_ok(
  $$select * from public.create_financial_account('Savings', 'savings', 'ZAR', 0)$$,
  'An authenticated user can create an owned account through the secured RPC'
);

select lives_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001',
    date_trunc('month', now() at time zone 'Africa/Johannesburg')::date,
    'Groceries', 2500, 'expense', false,
    'e4000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001', '', 'posted'
  )$$,
  'Posted spending can be linked to a paused budget item'
);

select lives_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001',
    date_trunc('month', now() at time zone 'Africa/Johannesburg')::date,
    'Refund', 500, 'expense', true,
    'e4000000-0000-4000-8000-000000000001', null, null, '', 'posted'
  )$$,
  'An expense refund is represented by a non-negative reversal entry'
);

select lives_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001',
    date_trunc('month', now() at time zone 'Africa/Johannesburg')::date,
    'Pending', 100, 'expense', false,
    'e4000000-0000-4000-8000-000000000001', null, null, '', 'pending'
  )$$,
  'Pending activity can be retained without affecting posted balances'
);

select results_eq(
  $$select balance_minor from public.retrieve_financial_accounts(false)
    where id = 'e4000000-0000-4000-8000-000000000001'$$,
  $$values (8000::bigint)$$,
  'Account balance is derived from opening balance, posted spending, and refunds'
);

select results_eq(
  $$select count(*)::bigint from public.budget_transactions
    where budget_month_id = 'e1000000-0000-4000-8000-000000000001'$$,
  $$values (3::bigint)$$,
  'The user can retrieve only their current transaction records'
);

select results_eq(
  $$select income, expenses, actual_income, actual_expenses
    from public.retrieve_budget_month_summaries()
    where id = 'e1000000-0000-4000-8000-000000000001'$$,
  $$values (1000::numeric, 0::numeric, 0::numeric, 20::numeric)$$,
  'Month summaries aggregate active plans and posted actuals without loading the ledger'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001',
    (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '1 day')::date,
    'Wrong date', 100, 'expense', false, null, null, null, '', 'posted'
  )$$,
  '23514', 'Transaction date must be inside its budget month',
  'A transaction date cannot disagree with its budget month'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'f1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Cross owner', 100, 'expense', false, null, null, null, '', 'posted'
  )$$,
  '42501', 'Budget month not found',
  'A user cannot create a transaction in another user month'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Cross category', 100, 'expense', false, null, null,
    'f2000000-0000-4000-8000-000000000001', '', 'posted'
  )$$,
  '23514', 'Category must belong to the same user and transaction type',
  'Composite ownership prevents assigning another user category'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Wrong currency', 100, 'expense', false,
    'e4000000-0000-4000-8000-000000000002', null, null, '', 'posted'
  )$$,
  '23514', 'Account must be active, belong to the same user, and use the month currency',
  'A transaction account must use the budget month currency'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000002',
    (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '2 months')::date,
    'Late entry', 100, 'expense', false, null, null, null, '', 'posted'
  )$$,
  '55000', 'Months that are two or more calendar months old are read-only',
  'Transactions cannot be created in locked reports'
);

select throws_ok(
  $$select * from public.update_budget_transaction(
    'e5000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000002',
    (date_trunc('month', now() at time zone 'Africa/Johannesburg') - interval '2 months')::date,
    'Changed', 1000, 'expense', false, null, null, null, '', 'posted'
  )$$,
  '55000', 'Months that are two or more calendar months old are read-only',
  'Transactions cannot be updated in locked reports'
);

select throws_ok(
  $$select public.delete_budget_transaction('e5000000-0000-4000-8000-000000000001')$$,
  '55000', 'Months that are two or more calendar months old are read-only',
  'Transactions cannot be deleted from locked reports'
);

select throws_ok(
  $$insert into public.budget_transactions (
    user_id, budget_month_id, transaction_date, description, amount_minor, transaction_type
  ) values (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Direct write', 100, 'expense'
  )$$,
  '42501', 'permission denied for table budget_transactions',
  'Direct table mutation is denied in favor of secured RPCs'
);

select lives_ok(
  $$select * from public.update_budget_transaction(
    (select id from public.budget_transactions where description = 'Groceries'),
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Groceries updated', 2600, 'expense', false,
    'e4000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001', '', 'posted'
  )$$,
  'An owned transaction in an editable month can be updated'
);

select lives_ok(
  $$select public.delete_budget_transaction(
    (select id from public.budget_transactions where description = 'Pending')
  )$$,
  'An owned transaction in an editable month can be deleted'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Wrong item type', 100, 'expense', false, null,
    'e3000000-0000-4000-8000-000000000002', null, '', 'posted'
  )$$,
  '23514', 'Budget item must belong to the same month, user, and transaction type',
  'A transaction cannot be assigned to a budget item of another type'
);

select throws_ok(
  $$select * from public.update_financial_account(
    'e4000000-0000-4000-8000-000000000001', 'Wallet', 'cash', 'USD', 10000, false
  )$$,
  '55000', 'An account with transactions cannot change currency',
  'An account currency cannot change after ledger activity exists'
);

set local role postgres;
update public.categories
  set archived_at = now()
  where id = 'e2000000-0000-4000-8000-000000000001';
update public.budget_month_items
  set archived_at = now()
  where id = 'e3000000-0000-4000-8000-000000000001';
update public.financial_accounts
  set archived_at = now()
  where id = 'e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Archived category', 100, 'expense', false, null, null,
    'e2000000-0000-4000-8000-000000000001', '', 'posted'
  )$$,
  '23514', 'New transaction assignments require an active category',
  'A new transaction cannot use an archived category'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Archived item', 100, 'expense', false, null,
    'e3000000-0000-4000-8000-000000000001', null, '', 'posted'
  )$$,
  '23514', 'New transaction assignments require an active budget item',
  'A new transaction cannot use an archived budget item'
);

select throws_ok(
  $$select * from public.create_budget_transaction(
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Archived account', 100, 'expense', false,
    'e4000000-0000-4000-8000-000000000001', null, null, '', 'posted'
  )$$,
  '23514', 'Account must be active, belong to the same user, and use the month currency',
  'A new transaction cannot use an archived account'
);

select lives_ok(
  $$select * from public.update_budget_transaction(
    (select id from public.budget_transactions where description = 'Groceries updated'),
    'e1000000-0000-4000-8000-000000000001', date_trunc('month', now())::date,
    'Groceries retained', 2600, 'expense', false,
    'e4000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'e2000000-0000-4000-8000-000000000001', '', 'posted'
  )$$,
  'Editing a transaction can preserve its existing archived assignments'
);

select lives_ok(
  $$select public.delete_own_account()$$,
  'Account deletion can cascade through locked reports and their transactions'
);

select * from finish();
rollback;
