-- LOCAL DEVELOPMENT ONLY. Applied explicitly by `supabase db reset`; never loaded by the frontend.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  'de000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'demo@buddybudget.local',
  extensions.crypt('buddy-budget-local-only', extensions.gen_salt('bf')), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
)
on conflict (id) do nothing;

insert into public.budget_templates (id, user_id, name, is_default)
values (
  'de100000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000001',
  'Everyday plan', true
)
on conflict (id) do nothing;

insert into public.categories (id, user_id, item_type, name, sort_order)
values
  ('de200000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'income', 'Earnings', 0),
  ('de200000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000001', 'expense', 'Housing', 0),
  ('de200000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000001', 'expense', 'Utilities', 1),
  ('de200000-0000-4000-8000-000000000004', 'de000000-0000-4000-8000-000000000001', 'expense', 'Groceries', 2),
  ('de200000-0000-4000-8000-000000000005', 'de000000-0000-4000-8000-000000000001', 'expense', 'Transport', 3),
  ('de200000-0000-4000-8000-000000000006', 'de000000-0000-4000-8000-000000000001', 'expense', 'Entertainment', 4)
on conflict (id) do nothing;

insert into public.template_items (
  id, template_id, user_id, category_id, item_type, name, default_amount, sort_order
)
values
  ('de300000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000001', 'income', 'Salary', 42000, 0),
  ('de300000-0000-4000-8000-000000000002', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000001', 'income', 'Freelance', 3000, 1),
  ('de300000-0000-4000-8000-000000000003', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000002', 'expense', 'Rent', 14500, 0),
  ('de300000-0000-4000-8000-000000000004', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000003', 'expense', 'Electricity', 1800, 1),
  ('de300000-0000-4000-8000-000000000005', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000004', 'expense', 'Groceries', 5200, 2),
  ('de300000-0000-4000-8000-000000000006', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000005', 'expense', 'Transport', 2800, 3),
  ('de300000-0000-4000-8000-000000000007', 'de100000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de200000-0000-4000-8000-000000000006', 'expense', 'Entertainment', 1600, 4)
on conflict (id) do nothing;

insert into public.budget_months (id, user_id, source_template_id, month_start, currency_code)
values
  ('de400000-0000-4000-8000-000000000001', 'de000000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', date_trunc('month', current_date - interval '2 months')::date, 'ZAR'),
  ('de400000-0000-4000-8000-000000000002', 'de000000-0000-4000-8000-000000000001', 'de100000-0000-4000-8000-000000000001', date_trunc('month', current_date - interval '1 month')::date, 'ZAR')
on conflict (user_id, month_start) do nothing;

insert into public.budget_month_items (
  budget_month_id, user_id, source_template_item_id, category_id, item_type,
  name_snapshot, category_snapshot, default_amount_snapshot, amount, sort_order
)
select
  month.id, month.user_id, item.id, item.category_id, item.item_type,
  item.name, category.name, item.default_amount,
  case when month.id = 'de400000-0000-4000-8000-000000000001' and item.name = 'Electricity'
    then 2100 else item.default_amount end,
  item.sort_order
from public.budget_months month
join public.template_items item on item.template_id = month.source_template_id
left join public.categories category on category.id = item.category_id
where month.id in (
  'de400000-0000-4000-8000-000000000001',
  'de400000-0000-4000-8000-000000000002'
)
and not exists (
  select 1 from public.budget_month_items existing
  where existing.budget_month_id = month.id and existing.source_template_item_id = item.id
);

insert into public.financial_accounts (
  id, user_id, name, account_type, currency_code, opening_balance_minor
)
values (
  'de500000-0000-4000-8000-000000000001',
  'de000000-0000-4000-8000-000000000001',
  'Daily account', 'checking', 'ZAR', 5000000
)
on conflict (id) do nothing;

insert into public.budget_transactions (
  id, user_id, budget_month_id, budget_month_item_id, category_id, account_id,
  transaction_date, description, amount_minor, transaction_type, status
)
select
  entry.id,
  month.user_id,
  month.id,
  item.id,
  item.category_id,
  'de500000-0000-4000-8000-000000000001',
  month.month_start + entry.day_offset,
  entry.description,
  entry.amount_minor,
  entry.transaction_type,
  'posted'
from public.budget_months month
cross join (values
  ('de600000-0000-4000-8000-000000000001'::uuid, 'Salary', 'Salary payment', 4200000::bigint, 'income', 0),
  ('de600000-0000-4000-8000-000000000002'::uuid, 'Groceries', 'Weekly groceries', 123450::bigint, 'expense', 4)
) as entry(id, item_name, description, amount_minor, transaction_type, day_offset)
join public.budget_month_items item
  on item.budget_month_id = month.id and item.name_snapshot = entry.item_name
where month.id = 'de400000-0000-4000-8000-000000000002'
on conflict (id) do nothing;

update public.profiles set
  display_name = 'Demo User', currency_code = 'ZAR', locale = 'en-ZA', timezone = 'Africa/Johannesburg'
where user_id = 'de000000-0000-4000-8000-000000000001';
update public.user_preferences set onboarding_completed_at = now()
where user_id = 'de000000-0000-4000-8000-000000000001';
