alter table public.budget_month_items
  add column if not exists is_disabled boolean not null default false;
