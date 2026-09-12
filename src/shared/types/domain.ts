export type ItemType = 'income' | 'expense';
export type ThemePreference = 'system' | 'light' | 'dark';
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface Profile {
  user_id: string;
  display_name: string | null;
  currency_code: string;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  user_id: string;
  last_budget_month_id: string | null;
  last_route: string | null;
  theme: ThemePreference;
  onboarding_completed_at: string | null;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  item_type: ItemType;
  name: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetTemplate {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  user_id: string;
  category_id: string | null;
  item_type: ItemType;
  name: string;
  default_amount: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateWithItems extends BudgetTemplate {
  template_items: TemplateItem[];
}

export interface BudgetMonth {
  id: string;
  user_id: string;
  source_template_id: string | null;
  month_start: string;
  currency_code: string;
  status: string;
  notes: string | null;
  last_opened_at: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetMonthItem {
  id: string;
  budget_month_id: string;
  user_id: string;
  source_template_item_id: string | null;
  category_id: string | null;
  item_type: ItemType;
  name_snapshot: string;
  category_snapshot: string | null;
  default_amount_snapshot: string;
  amount: string;
  is_disabled: boolean;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetMonthWithItems extends BudgetMonth {
  budget_month_items: BudgetMonthItem[];
}

export interface MonthSummary extends BudgetMonth {
  income: number;
  expenses: number;
  remaining: number;
}
