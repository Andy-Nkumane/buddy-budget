import type { User } from '@supabase/supabase-js';
import { adjacentMonthStart, calculateBudgetProgress } from '../../shared/formatting/money';
import type {
  BudgetMonth,
  BudgetMonthItem,
  BudgetMonthWithItems,
  BudgetTemplate,
  BudgetTransaction,
  Category,
  FinancialAccount,
  FinancialAccountType,
  FinancialAccountWithBalance,
  ItemType,
  MonthSummary,
  Profile,
  TemplateItem,
  TemplateWithItems,
  ThemePreference,
  TransactionStatus,
  UserPreferences,
} from '../../shared/types/domain';
import { requireSupabase } from '../supabase/client';

const throwWhenError = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
};

const EXPORT_PAGE_SIZE = 1000;
export const TRANSACTION_PAGE_SIZE = 50;
type PageResult<T> = { data: T[] | null; error: { message: string } | null };

const retrieveAllPages = async <T>(
  retrievePage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> => {
  const records: T[] = [];
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await retrievePage(from, from + EXPORT_PAGE_SIZE - 1);
    throwWhenError(error);
    const page = data ?? [];
    records.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) return records;
  }
};

const groupRecordsBy = <T>(records: T[], retrieveKey: (record: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  records.forEach((record) => {
    const key = retrieveKey(record);
    const group = grouped.get(key);
    if (group) group.push(record);
    else grouped.set(key, [record]);
  });
  return grouped;
};

const retrieveAuthenticatedUser = async (): Promise<User> => {
  const { data, error } = await requireSupabase().auth.getUser();
  throwWhenError(error);
  if (!data.user) throw new Error('Your session has expired. Please sign in again.');
  return data.user;
};

export const retrieveProfile = async (): Promise<Profile | null> => {
  const user = await retrieveAuthenticatedUser();
  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  throwWhenError(error);
  return data;
};

export const retrievePreferences = async (): Promise<UserPreferences | null> => {
  const user = await retrieveAuthenticatedUser();
  const { data, error } = await requireSupabase()
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  throwWhenError(error);
  return data;
};

export const updateProfileAndPreferences = async (input: {
  displayName: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  theme: ThemePreference;
}): Promise<void> => {
  const { error } = await requireSupabase().rpc('update_profile_and_preferences', {
    requested_display_name: input.displayName,
    requested_currency_code: input.currencyCode,
    requested_locale: input.locale,
    requested_timezone: input.timezone,
    requested_theme: input.theme,
  });
  throwWhenError(error);
};

export const setupFirstBudget = async (input: {
  displayName: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  theme: ThemePreference;
  templateName: string;
  items: Array<{
    name: string;
    item_type: ItemType;
    category_name: string;
    default_amount: string;
  }>;
}): Promise<BudgetMonth> => {
  const { data, error } = await requireSupabase().rpc('setup_first_budget', {
    requested_display_name: input.displayName,
    requested_currency_code: input.currencyCode,
    requested_locale: input.locale,
    requested_timezone: input.timezone,
    requested_theme: input.theme,
    requested_template_name: input.templateName,
    requested_template_items: input.items,
  });
  throwWhenError(error);
  const month = data?.[0];
  if (!month) throw new Error('Your first month could not be created.');
  return month;
};

export const updateLastLocation = async (
  route: string,
  lastBudgetMonthId?: string,
): Promise<void> => {
  const user = await retrieveAuthenticatedUser();
  const safeRoute =
    route.startsWith('/app/') && !route.startsWith('//') ? route : '/app/budget/current';
  const { error } = await requireSupabase()
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      last_route: safeRoute,
      ...(lastBudgetMonthId ? { last_budget_month_id: lastBudgetMonthId } : {}),
    });
  throwWhenError(error);
};

export const searchCategories = async (includeArchived = false): Promise<Category[]> => {
  const client = requireSupabase();
  return retrieveAllPages<Category>((from, to) => {
    let query = client
      .from('categories')
      .select('*')
      .order('item_type')
      .order('sort_order')
      .order('created_at')
      .order('id')
      .range(from, to);
    if (!includeArchived) query = query.is('archived_at', null);
    return query;
  });
};

export const createCategory = async (input: {
  name: string;
  itemType: ItemType;
}): Promise<Category> => {
  const { data, error } = await requireSupabase().rpc('create_category', {
    requested_name: input.name,
    requested_item_type: input.itemType,
  });
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The category could not be created.');
  return data[0];
};

export const updateCategory = async (
  id: string,
  values: Partial<Pick<Category, 'name' | 'sort_order' | 'archived_at'>>,
): Promise<void> => {
  const { error } = await requireSupabase().from('categories').update(values).eq('id', id);
  throwWhenError(error);
};

export const moveCategory = async (id: string, direction: -1 | 1): Promise<void> => {
  const { error } = await requireSupabase().rpc('move_category', {
    requested_category_id: id,
    requested_direction: direction,
  });
  throwWhenError(error);
};

const retrieveTemplateItems = async (templateId: string): Promise<TemplateItem[]> => {
  const client = requireSupabase();
  return retrieveAllPages<TemplateItem>((from, to) =>
    client
      .from('template_items')
      .select('*')
      .eq('template_id', templateId)
      .is('archived_at', null)
      .order('item_type', { ascending: false })
      .order('sort_order')
      .order('created_at')
      .order('id')
      .range(from, to),
  );
};

export const retrieveDefaultTemplate = async (): Promise<TemplateWithItems | null> => {
  const { data, error } = await requireSupabase()
    .from('budget_templates')
    .select('*')
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();
  throwWhenError(error);
  if (!data) return null;
  return { ...data, template_items: await retrieveTemplateItems(data.id) };
};

export const searchTemplates = async (): Promise<TemplateWithItems[]> => {
  const client = requireSupabase();
  const [templates, templateItems] = await Promise.all([
    retrieveAllPages<BudgetTemplate>((from, to) =>
      client
        .from('budget_templates')
        .select('*')
        .is('archived_at', null)
        .order('is_default', { ascending: false })
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
    retrieveAllPages<TemplateItem>((from, to) =>
      client
        .from('template_items')
        .select('*')
        .is('archived_at', null)
        .order('item_type', { ascending: false })
        .order('sort_order')
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
  ]);
  if (!templates.length) return [];
  const itemsByTemplate = groupRecordsBy(templateItems, (item) => item.template_id);
  return templates.map((template) => ({
    ...template,
    template_items: itemsByTemplate.get(template.id) ?? [],
  }));
};

export const createTemplate = async (
  name: string,
  makeDefault = false,
): Promise<BudgetTemplate> => {
  const user = await retrieveAuthenticatedUser();
  const { data, error } = await requireSupabase()
    .from('budget_templates')
    .insert({ user_id: user.id, name, is_default: makeDefault })
    .select('*')
    .single();
  throwWhenError(error);
  if (!data) throw new Error('The template could not be created.');
  return data;
};

export const setDefaultTemplate = async (templateId: string): Promise<void> => {
  const { error } = await requireSupabase().rpc('set_default_template', {
    requested_template_id: templateId,
  });
  throwWhenError(error);
};

export const createTemplateItem = async (input: {
  templateId: string;
  name: string;
  itemType: ItemType;
  amount: string;
  categoryId?: string | null;
}): Promise<TemplateItem> => {
  const { data, error } = await requireSupabase().rpc('create_template_item', {
    requested_template_id: input.templateId,
    requested_name: input.name,
    requested_item_type: input.itemType,
    requested_amount: input.amount,
    requested_category_id: input.categoryId ?? null,
  });
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The template item could not be created.');
  return data[0];
};

export const updateTemplateItem = async (
  id: string,
  values: Partial<
    Pick<TemplateItem, 'name' | 'default_amount' | 'category_id' | 'sort_order' | 'archived_at'>
  >,
): Promise<void> => {
  const { error } = await requireSupabase().from('template_items').update(values).eq('id', id);
  throwWhenError(error);
};

export const moveTemplateItem = async (id: string, direction: -1 | 1): Promise<void> => {
  const { error } = await requireSupabase().rpc('move_template_item', {
    requested_item_id: id,
    requested_direction: direction,
  });
  throwWhenError(error);
};

const retrieveMonthItems = async (monthId: string): Promise<BudgetMonthItem[]> => {
  const client = requireSupabase();
  return retrieveAllPages<BudgetMonthItem>((from, to) =>
    client
      .from('budget_month_items')
      .select('*')
      .eq('budget_month_id', monthId)
      .is('archived_at', null)
      .order('item_type', { ascending: false })
      .order('sort_order')
      .order('created_at')
      .order('id')
      .range(from, to),
  );
};

const retrieveMonthTransactions = async (monthId: string): Promise<BudgetTransaction[]> => {
  const client = requireSupabase();
  return retrieveAllPages<BudgetTransaction>((from, to) =>
    client
      .from('budget_transactions')
      .select('*')
      .eq('budget_month_id', monthId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to),
  );
};

const combineMonth = async (month: BudgetMonth): Promise<BudgetMonthWithItems> => {
  const [items, transactions] = await Promise.all([
    retrieveMonthItems(month.id),
    retrieveMonthTransactions(month.id),
  ]);
  return { ...month, budget_month_items: items, budget_transactions: transactions };
};

export const retrieveMonthByStart = async (
  monthStart: string,
): Promise<BudgetMonthWithItems | null> => {
  const { data, error } = await requireSupabase()
    .from('budget_months')
    .select('*')
    .eq('month_start', monthStart)
    .maybeSingle();
  throwWhenError(error);
  return data ? combineMonth(data) : null;
};

export const retrieveMonthById = async (id: string): Promise<BudgetMonthWithItems | null> => {
  const { data, error } = await requireSupabase()
    .from('budget_months')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  throwWhenError(error);
  return data ? combineMonth(data) : null;
};

export const searchMonths = async (): Promise<MonthSummary[]> => {
  const { data, error } = await requireSupabase().rpc('retrieve_budget_month_summaries');
  throwWhenError(error);
  return (data ?? []).map(({ actual_income, actual_expenses, actual_remaining, ...month }) => ({
    ...month,
    actualIncome: actual_income,
    actualExpenses: actual_expenses,
    actualRemaining: actual_remaining,
  }));
};

export interface MonthExportRange {
  fromMonth?: string;
  toMonth?: string;
}

export const retrieveMonthsForExport = async (
  range: MonthExportRange = {},
): Promise<BudgetMonthWithItems[]> => {
  const client = requireSupabase();
  const [months, monthItems, transactions] = await Promise.all([
    retrieveAllPages<BudgetMonth>((from, to) => {
      let query = client.from('budget_months').select('*').order('month_start').range(from, to);
      if (range.fromMonth) query = query.gte('month_start', range.fromMonth);
      if (range.toMonth) query = query.lte('month_start', range.toMonth);
      return query;
    }),
    retrieveAllPages<BudgetMonthItem>((from, to) =>
      client
        .from('budget_month_items')
        .select('*')
        .is('archived_at', null)
        .order('item_type', { ascending: false })
        .order('sort_order')
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
    retrieveAllPages<BudgetTransaction>((from, to) => {
      let query = client
        .from('budget_transactions')
        .select('*')
        .order('transaction_date')
        .order('created_at')
        .order('id')
        .range(from, to);
      if (range.fromMonth) query = query.gte('transaction_date', range.fromMonth);
      if (range.toMonth) query = query.lt('transaction_date', adjacentMonthStart(range.toMonth, 1));
      return query;
    }),
  ]);
  if (!months.length) return [];
  const itemsByMonth = groupRecordsBy(monthItems, (item) => item.budget_month_id);
  const transactionsByMonth = groupRecordsBy(transactions, (entry) => entry.budget_month_id);
  return months.map((month) => ({
    ...month,
    budget_month_items: itemsByMonth.get(month.id) ?? [],
    budget_transactions: transactionsByMonth.get(month.id) ?? [],
  }));
};

export const createMonthFromTemplate = async (
  monthStart: string,
  templateId: string,
): Promise<BudgetMonthWithItems> => {
  const { data, error } = await requireSupabase().rpc('create_month_from_template', {
    requested_month_start: monthStart,
    requested_template_id: templateId,
  });
  throwWhenError(error);
  const month = data?.[0];
  if (!month) throw new Error('The month could not be created.');
  return combineMonth(month);
};

export const updateMonthItemAmount = async (id: string, amount: string): Promise<void> => {
  const { error } = await requireSupabase()
    .from('budget_month_items')
    .update({ amount })
    .eq('id', id);
  throwWhenError(error);
};

export const updateMonthItem = async (
  id: string,
  values: Partial<
    Pick<
      BudgetMonthItem,
      'name_snapshot' | 'category_id' | 'amount' | 'is_disabled' | 'archived_at'
    >
  >,
): Promise<void> => {
  const { error } = await requireSupabase().from('budget_month_items').update(values).eq('id', id);
  throwWhenError(error);
};

export const createMonthItem = async (input: {
  monthId: string;
  name: string;
  itemType: ItemType;
  amount: string;
  categoryId?: string | null;
}): Promise<BudgetMonthItem> => {
  const { data, error } = await requireSupabase().rpc('create_month_item', {
    requested_month_id: input.monthId,
    requested_name: input.name,
    requested_item_type: input.itemType,
    requested_amount: input.amount,
    requested_category_id: input.categoryId ?? null,
  });
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The month item could not be created.');
  return data[0];
};

export const searchFinancialAccounts = async (
  includeArchived = false,
): Promise<FinancialAccountWithBalance[]> => {
  const { data, error } = await requireSupabase().rpc('retrieve_financial_accounts', {
    requested_include_archived: includeArchived,
  });
  throwWhenError(error);
  return data ?? [];
};

export const createFinancialAccount = async (input: {
  name: string;
  accountType: FinancialAccountType;
  currencyCode: string;
  openingBalanceMinor: number;
}): Promise<FinancialAccount> => {
  const { data, error } = await requireSupabase().rpc('create_financial_account', {
    requested_name: input.name,
    requested_account_type: input.accountType,
    requested_currency_code: input.currencyCode,
    requested_opening_balance_minor: input.openingBalanceMinor,
  });
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The account could not be created.');
  return data[0];
};

export const updateFinancialAccount = async (
  account: FinancialAccount,
  archived: boolean,
): Promise<FinancialAccount> => {
  const { data, error } = await requireSupabase().rpc('update_financial_account', {
    requested_account_id: account.id,
    requested_name: account.name,
    requested_account_type: account.account_type,
    requested_currency_code: account.currency_code,
    requested_opening_balance_minor: account.opening_balance_minor,
    requested_archived: archived,
  });
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The account could not be updated.');
  return data[0];
};

export interface BudgetTransactionInput {
  budgetMonthId: string;
  transactionDate: string;
  description: string;
  amountMinor: number;
  transactionType: ItemType;
  isRefund: boolean;
  accountId: string | null;
  budgetMonthItemId: string | null;
  categoryId: string | null;
  notes: string;
  status: TransactionStatus;
}

const transactionRpcArguments = (input: BudgetTransactionInput) => ({
  requested_budget_month_id: input.budgetMonthId,
  requested_transaction_date: input.transactionDate,
  requested_description: input.description,
  requested_amount_minor: input.amountMinor,
  requested_transaction_type: input.transactionType,
  requested_is_refund: input.isRefund,
  requested_account_id: input.accountId,
  requested_budget_month_item_id: input.budgetMonthItemId,
  requested_category_id: input.categoryId,
  requested_notes: input.notes,
  requested_status: input.status,
});

export const createBudgetTransaction = async (
  input: BudgetTransactionInput,
): Promise<BudgetTransaction> => {
  const { data, error } = await requireSupabase().rpc(
    'create_budget_transaction',
    transactionRpcArguments(input),
  );
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The transaction could not be created.');
  return data[0];
};

export const updateBudgetTransaction = async (
  id: string,
  input: BudgetTransactionInput,
): Promise<BudgetTransaction> => {
  const { data, error } = await requireSupabase().rpc('update_budget_transaction', {
    requested_transaction_id: id,
    ...transactionRpcArguments(input),
  });
  throwWhenError(error);
  if (!data?.[0]) throw new Error('The transaction could not be updated.');
  return data[0];
};

export const deleteBudgetTransaction = async (id: string): Promise<void> => {
  const { error } = await requireSupabase().rpc('delete_budget_transaction', {
    requested_transaction_id: id,
  });
  throwWhenError(error);
};

export const searchBudgetTransactions = async (
  page: number,
): Promise<{ records: BudgetTransaction[]; total: number }> => {
  const from = page * TRANSACTION_PAGE_SIZE;
  const { data, error, count } = await requireSupabase()
    .from('budget_transactions')
    .select('*', { count: 'exact' })
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, from + TRANSACTION_PAGE_SIZE - 1);
  throwWhenError(error);
  return { records: data ?? [], total: count ?? 0 };
};

export const exportAllData = async (range: MonthExportRange = {}) => {
  const client = requireSupabase();
  const [
    profile,
    preferences,
    categories,
    templates,
    templateItems,
    budgetMonths,
    financialAccounts,
    transactions,
  ] = await Promise.all([
    retrieveProfile(),
    retrievePreferences(),
    retrieveAllPages<Category>((from, to) =>
      client.from('categories').select('*').order('created_at').order('id').range(from, to),
    ),
    retrieveAllPages<BudgetTemplate>((from, to) =>
      client.from('budget_templates').select('*').order('created_at').order('id').range(from, to),
    ),
    retrieveAllPages<TemplateItem>((from, to) =>
      client.from('template_items').select('*').order('created_at').order('id').range(from, to),
    ),
    retrieveAllPages<BudgetMonth>((from, to) => {
      let query = client.from('budget_months').select('*').order('month_start').range(from, to);
      if (range.fromMonth) query = query.gte('month_start', range.fromMonth);
      if (range.toMonth) query = query.lte('month_start', range.toMonth);
      return query;
    }),
    retrieveAllPages<FinancialAccount>((from, to) =>
      client.from('financial_accounts').select('*').order('created_at').order('id').range(from, to),
    ),
    retrieveAllPages<BudgetTransaction>((from, to) => {
      let query = client
        .from('budget_transactions')
        .select('*')
        .order('transaction_date')
        .order('created_at')
        .order('id')
        .range(from, to);
      if (range.fromMonth) query = query.gte('transaction_date', range.fromMonth);
      if (range.toMonth) query = query.lt('transaction_date', adjacentMonthStart(range.toMonth, 1));
      return query;
    }),
  ]);
  const monthItems = await retrieveAllPages<BudgetMonthItem>((from, to) =>
    client.from('budget_month_items').select('*').order('created_at').order('id').range(from, to),
  );
  const itemsByTemplate = groupRecordsBy(templateItems, (item) => item.template_id);
  const itemsByMonth = groupRecordsBy(monthItems, (item) => item.budget_month_id);
  const transactionsByMonth = groupRecordsBy(transactions, (entry) => entry.budget_month_id);
  return {
    exported_at: new Date().toISOString(),
    schema_version: 3,
    range: {
      from_month: range.fromMonth ?? null,
      to_month: range.toMonth ?? null,
    },
    profile,
    preferences,
    categories,
    financial_accounts: financialAccounts,
    templates: templates.map((template) => ({
      ...template,
      template_items: itemsByTemplate.get(template.id) ?? [],
    })),
    budget_months: budgetMonths.map((month) => {
      const budgetMonthItems = itemsByMonth.get(month.id) ?? [];
      const budgetTransactions = transactionsByMonth.get(month.id) ?? [];
      return {
        ...month,
        budget_month_items: budgetMonthItems,
        budget_transactions: budgetTransactions,
        planned_versus_actual: calculateBudgetProgress(budgetMonthItems, budgetTransactions),
      };
    }),
  };
};

export const requestAccountDeletion = async (): Promise<void> => {
  const { error } = await requireSupabase().rpc('delete_own_account');
  throwWhenError(error);
};
