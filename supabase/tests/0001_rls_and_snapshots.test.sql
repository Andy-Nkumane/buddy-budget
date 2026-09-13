begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'alice@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'bob@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'charlie@example.test',
    extensions.crypt('local-test-password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

insert into public.budget_templates (id, user_id, name, is_default)
values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alice plan', true),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Bob plan', true);

insert into public.template_items (
  id, template_id, user_id, item_type, name, default_amount, sort_order
)
values
  (
    'a2000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'income', 'Salary', 25000, 0
  ),
  (
    'a2000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'expense', 'Rent', 9000, 0
  );

insert into public.budget_months (
  id, user_id, source_template_id, month_start, currency_code
)
values (
  'b3000000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'b1000000-0000-4000-8000-000000000001',
  '2026-01-01', 'ZAR'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);

select throws_ok(
  $$select public.setup_first_budget(
      'Charlie', 'ZAR', 'en-ZA', 'Africa/Johannesburg', 'system', 'Starter plan', '[]'::jsonb
    )$$,
  '22023',
  'At least one valid template item is required',
  'First-budget setup rejects an empty template'
);

select lives_ok(
  $$select public.setup_first_budget(
      'Charlie', 'ZAR', 'en-ZA', 'Africa/Johannesburg', 'system', 'Starter plan',
      '[{"name":"Salary","item_type":"income","category_name":"Earnings","default_amount":"25000.00"},{"name":"Rent","item_type":"expense","category_name":"Housing","default_amount":"9000.00"}]'::jsonb
    )$$,
  'First-budget setup accepts ordered JSON template items'
);

select is(
  (select array_agg(name order by sort_order) from public.template_items),
  array['Salary', 'Rent']::text[],
  'First-budget setup preserves template item order'
);

select is(
  (select count(*) from public.template_items where category_id is null),
  0::bigint,
  'First-budget setup assigns a category to every template item'
);

update public.budget_month_items set is_disabled = true
where name_snapshot = 'Rent';

select is(
  (select is_disabled from public.budget_month_items where name_snapshot = 'Rent'),
  true,
  'A user can temporarily disable a monthly budget item'
);

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select is(
  (select count(*) from public.profiles),
  1::bigint,
  'Alice can read only Alice profile'
);

select is(
  (select count(*) from public.budget_months where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint,
  'Alice cannot read Bob months'
);

update public.budget_months set notes = 'tampered'
where id = 'b3000000-0000-4000-8000-000000000001';

reset role;
select is(
  (select notes from public.budget_months where id = 'b3000000-0000-4000-8000-000000000001'),
  null::text,
  'Alice cannot update Bob month'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
delete from public.budget_months
where id = 'b3000000-0000-4000-8000-000000000001';

reset role;
select is(
  (select count(*) from public.budget_months where id = 'b3000000-0000-4000-8000-000000000001'),
  1::bigint,
  'Alice cannot delete Bob month'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

select throws_ok(
  $$insert into public.categories (user_id, item_type, name)
    values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'expense', 'Not Alice')$$,
  '42501',
  null,
  'Alice cannot insert a category owned by Bob'
);

select throws_ok(
  $$insert into public.budget_month_items (
      budget_month_id, user_id, item_type, name_snapshot, amount
    ) values (
      'b3000000-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'expense', 'Cross-parent item', 10
    )$$,
  '23503',
  null,
  'Alice cannot attach an item to Bob month'
);

select throws_ok(
  $$select public.create_month_from_template(
      '2026-02-01', 'b1000000-0000-4000-8000-000000000001'
    )$$,
  '42501',
  null,
  'Alice cannot create a month from Bob template'
);

select lives_ok(
  $$select public.create_month_from_template(
      (date_trunc('month', current_date) - interval '1 month')::date,
      'a1000000-0000-4000-8000-000000000001'
    )$$,
  'Alice can create a month from Alice template'
);

select is(
  (select count(*) from public.budget_months
    where month_start = (date_trunc('month', current_date) - interval '1 month')::date),
  1::bigint,
  'Month creation creates exactly one month'
);

select is(
  (select count(*) from public.budget_month_items where budget_month_id = (
    select id from public.budget_months
      where month_start = (date_trunc('month', current_date) - interval '1 month')::date
  )),
  2::bigint,
  'Month creation copies active template items'
);

select lives_ok(
  $$select public.create_month_from_template(
      (date_trunc('month', current_date) - interval '1 month')::date,
      'a1000000-0000-4000-8000-000000000001'
    )$$,
  'Duplicate month creation is idempotent'
);

update public.template_items
  set name = 'Updated salary', default_amount = 30000
  where id = 'a2000000-0000-4000-8000-000000000001';

select is(
  (select name_snapshot from public.budget_month_items
    where source_template_item_id = 'a2000000-0000-4000-8000-000000000001'),
  'Salary',
  'Template rename does not rewrite historical snapshot name'
);

select is(
  (select default_amount_snapshot from public.budget_month_items
    where source_template_item_id = 'a2000000-0000-4000-8000-000000000001'),
  25000.00::numeric,
  'Template amount change does not rewrite historical snapshot amount'
);

select throws_ok(
  $$insert into public.budget_templates (user_id, name, is_default)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Second default', true)$$,
  '23505',
  null,
  'A user cannot have two active default templates'
);

select lives_ok(
  $$select public.update_profile_and_preferences(
      'Alice Budget', 'USD', 'en-US', 'America/New_York', 'dark'
    )$$,
  'Settings are updated atomically'
);

select is(
  (select display_name from public.profiles),
  'Alice Budget',
  'Atomic settings update saves the profile'
);

select is(
  (select theme from public.user_preferences),
  'dark',
  'Atomic settings update saves preferences'
);

select lives_ok(
  $$select public.create_category('First expense category', 'expense')$$,
  'Category append RPC creates the first category'
);

select lives_ok(
  $$select public.create_category('Second expense category', 'expense')$$,
  'Category append RPC creates the second category'
);

select lives_ok(
  $$select public.move_category(
      (select id from public.categories where name = 'Second expense category'), -1
    )$$,
  'Category reorder RPC moves a category'
);

select is(
  (select array_agg(name order by sort_order) from public.categories where item_type = 'expense'),
  array['Second expense category', 'First expense category']::text[],
  'Category reorder produces deterministic positions'
);

select lives_ok(
  $$select public.create_template_item(
      'a1000000-0000-4000-8000-000000000001', 'Utilities', 'expense', 100, null
    )$$,
  'Template item append RPC creates an item'
);

select lives_ok(
  $$select public.create_template_item(
      'a1000000-0000-4000-8000-000000000001', 'Groceries', 'expense', 200, null
    )$$,
  'Template item append RPC creates another item'
);

select lives_ok(
  $$select public.move_template_item(
      (select id from public.template_items where name = 'Groceries'), -1
    )$$,
  'Template item reorder RPC moves an item'
);

select is(
  (select array_agg(name order by sort_order) from public.template_items where item_type = 'expense'),
  array['Rent', 'Groceries', 'Utilities']::text[],
  'Template item reorder produces deterministic positions'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$select * from public.budget_months$$,
  '42501',
  null,
  'Anonymous users cannot access private budget records'
);

select * from finish();
rollback;
