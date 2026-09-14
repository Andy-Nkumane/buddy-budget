export type ItemType = 'income' | 'expense';
export type ThemePreference = 'system' | 'light' | 'dark';
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
export type FinancialAccountType = 'cash' | 'checking' | 'savings' | 'credit';
export type TransactionStatus = 'pending' | 'posted' | 'void';
export type TransactionSource = 'manual';

export type Profile = {
  user_id: string;
  display_name: string | null;
  currency_code: string;
  locale: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  user_id: string;
  last_budget_month_id: string | null;
  last_route: string | null;
  theme: ThemePreference;
  onboarding_completed_at: string | null;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  item_type: ItemType;
  name: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetTemplate = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TemplateItem = {
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
};

export type TemplateWithItems = BudgetTemplate & {
  template_items: TemplateItem[];
};

export type BudgetMonth = {
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
};

export type BudgetMonthItem = {
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
};

export type FinancialAccount = {
  id: string;
  user_id: string;
  name: string;
  account_type: FinancialAccountType;
  currency_code: string;
  opening_balance_minor: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinancialAccountWithBalance = FinancialAccount & {
  balance_minor: number;
};

export type BudgetTransaction = {
  id: string;
  user_id: string;
  budget_month_id: string;
  budget_month_item_id: string | null;
  category_id: string | null;
  account_id: string | null;
  transaction_date: string;
  description: string;
  amount_minor: number;
  transaction_type: ItemType;
  is_refund: boolean;
  notes: string | null;
  source: TransactionSource;
  status: TransactionStatus;
  external_fingerprint: string | null;
  category_snapshot: string | null;
  budget_item_snapshot: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetMonthWithItems = BudgetMonth & {
  budget_month_items: BudgetMonthItem[];
  budget_transactions: BudgetTransaction[];
};

export type MonthSummary = BudgetMonth & {
  income: number;
  expenses: number;
  remaining: number;
  actualIncome: number;
  actualExpenses: number;
  actualRemaining: number;
};
