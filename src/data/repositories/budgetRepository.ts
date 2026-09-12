import type { User } from '@supabase/supabase-js';
import { calculateTotals } from '../../shared/formatting/money';
import type {
  BudgetMonth,
  BudgetMonthItem,
  BudgetMonthWithItems,
  BudgetTemplate,
  Category,
  ItemType,
  MonthSummary,
  Profile,
  TemplateItem,
  TemplateWithItems,
  ThemePreference,
  UserPreferences,
} from '../../shared/types/domain';
import { requireSupabase } from '../supabase/client';

const throwWhenError = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
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
  const user = await retrieveAuthenticatedUser();
  const client = requireSupabase();
  const profileResult = await client.from('profiles').upsert({
    user_id: user.id,
    display_name: input.displayName || null,
    currency_code: input.currencyCode,
    locale: input.locale,
    timezone: input.timezone,
    updated_at: new Date().toISOString(),
  });
  throwWhenError(profileResult.error);
  const preferencesResult = await client.from('user_preferences').upsert({
    user_id: user.id,
    theme: input.theme,
    updated_at: new Date().toISOString(),
  });
  throwWhenError(preferencesResult.error);
};

export const completeOnboarding = async (): Promise<void> => {
  const user = await retrieveAuthenticatedUser();
  const { error } = await requireSupabase().from('user_preferences').upsert({
    user_id: user.id,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
      updated_at: new Date().toISOString(),
    });
  throwWhenError(error);
};

export const searchCategories = async (includeArchived = false): Promise<Category[]> => {
  let query = requireSupabase()
    .from('categories')
    .select('*')
    .order('item_type')
    .order('sort_order');
  if (!includeArchived) query = query.is('archived_at', null);
  const { data, error } = await query;
  throwWhenError(error);
  return data ?? [];
};

export const createCategory = async (input: {
  name: string;
  itemType: ItemType;
}): Promise<Category> => {
  const user = await retrieveAuthenticatedUser();
  const categories = await searchCategories(true);
  const nextOrder = categories.filter((category) => category.item_type === input.itemType).length;
  const { data, error } = await requireSupabase()
    .from('categories')
    .insert({
      user_id: user.id,
      name: input.name,
      item_type: input.itemType,
      sort_order: nextOrder,
    })
    .select('*')
    .single();
  throwWhenError(error);
  if (!data) throw new Error('The category could not be created.');
  return data;
};

export const updateCategory = async (
  id: string,
  values: Partial<Pick<Category, 'name' | 'sort_order' | 'archived_at'>>,
): Promise<void> => {
  const { error } = await requireSupabase()
    .from('categories')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwWhenError(error);
};

const retrieveTemplateItems = async (templateId: string): Promise<TemplateItem[]> => {
  const { data, error } = await requireSupabase()
    .from('template_items')
    .select('*')
    .eq('template_id', templateId)
    .is('archived_at', null)
    .order('item_type', { ascending: false })
    .order('sort_order');
  throwWhenError(error);
  return data ?? [];
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
  const { data, error } = await requireSupabase()
    .from('budget_templates')
    .select('*')
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('created_at');
  throwWhenError(error);
  return Promise.all(
    (data ?? []).map(async (template) => ({
      ...template,
      template_items: await retrieveTemplateItems(template.id),
    })),
  );
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

export const updateTemplate = async (
  id: string,
  values: Partial<Pick<BudgetTemplate, 'name' | 'archived_at'>>,
): Promise<void> => {
  const { error } = await requireSupabase()
    .from('budget_templates')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwWhenError(error);
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
  const user = await retrieveAuthenticatedUser();
  const existing = await retrieveTemplateItems(input.templateId);
  const { data, error } = await requireSupabase()
    .from('template_items')
    .insert({
      template_id: input.templateId,
      user_id: user.id,
      name: input.name,
      item_type: input.itemType,
      default_amount: input.amount,
      category_id: input.categoryId ?? null,
      sort_order: existing.filter((item) => item.item_type === input.itemType).length,
    })
    .select('*')
    .single();
  throwWhenError(error);
  if (!data) throw new Error('The template item could not be created.');
  return data;
};

export const updateTemplateItem = async (
  id: string,
  values: Partial<
    Pick<TemplateItem, 'name' | 'default_amount' | 'category_id' | 'sort_order' | 'archived_at'>
  >,
): Promise<void> => {
  const { error } = await requireSupabase()
    .from('template_items')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwWhenError(error);
};

const retrieveMonthItems = async (monthId: string): Promise<BudgetMonthItem[]> => {
  const { data, error } = await requireSupabase()
    .from('budget_month_items')
    .select('*')
    .eq('budget_month_id', monthId)
    .is('archived_at', null)
    .order('item_type', { ascending: false })
    .order('sort_order');
  throwWhenError(error);
  return data ?? [];
};

const combineMonth = async (month: BudgetMonth): Promise<BudgetMonthWithItems> => ({
  ...month,
  budget_month_items: await retrieveMonthItems(month.id),
});

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
  const { data, error } = await requireSupabase()
    .from('budget_months')
    .select('*')
    .order('month_start', { ascending: false });
  throwWhenError(error);
  return Promise.all(
    (data ?? []).map(async (month) => ({
      ...month,
      ...calculateTotals(await retrieveMonthItems(month.id)),
    })),
  );
};

export interface MonthExportRange {
  fromMonth?: string;
  toMonth?: string;
}

export const retrieveMonthsForExport = async (
  range: MonthExportRange = {},
): Promise<BudgetMonthWithItems[]> => {
  let query = requireSupabase().from('budget_months').select('*').order('month_start');
  if (range.fromMonth) query = query.gte('month_start', range.fromMonth);
  if (range.toMonth) query = query.lte('month_start', range.toMonth);
  const { data, error } = await query;
  throwWhenError(error);
  return Promise.all((data ?? []).map(combineMonth));
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
    .update({ amount, updated_at: new Date().toISOString() })
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
  const { error } = await requireSupabase()
    .from('budget_month_items')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id);
  throwWhenError(error);
};

export const createMonthItem = async (input: {
  monthId: string;
  name: string;
  itemType: ItemType;
  amount: string;
  categoryId?: string | null;
}): Promise<BudgetMonthItem> => {
  const user = await retrieveAuthenticatedUser();
  const items = await retrieveMonthItems(input.monthId);
  const category = input.categoryId
    ? (await searchCategories(true)).find((candidate) => candidate.id === input.categoryId)
    : null;
  const { data, error } = await requireSupabase()
    .from('budget_month_items')
    .insert({
      budget_month_id: input.monthId,
      user_id: user.id,
      source_template_item_id: null,
      category_id: input.categoryId ?? null,
      item_type: input.itemType,
      name_snapshot: input.name,
      category_snapshot: category?.name ?? null,
      default_amount_snapshot: input.amount,
      amount: input.amount,
      sort_order: items.filter((item) => item.item_type === input.itemType).length,
    })
    .select('*')
    .single();
  throwWhenError(error);
  if (!data) throw new Error('The month item could not be created.');
  return data;
};

export const exportAllData = async (range: MonthExportRange = {}) => {
  const [profile, preferences, categories, templates, budgetMonths] = await Promise.all([
    retrieveProfile(),
    retrievePreferences(),
    searchCategories(true),
    searchTemplates(),
    retrieveMonthsForExport(range),
  ]);
  return {
    exported_at: new Date().toISOString(),
    schema_version: 1,
    range: {
      from_month: range.fromMonth ?? null,
      to_month: range.toMonth ?? null,
    },
    profile,
    preferences,
    categories,
    templates,
    budget_months: budgetMonths,
  };
};

export const requestAccountDeletion = async (): Promise<void> => {
  const { error } = await requireSupabase().rpc('delete_own_account');
  throwWhenError(error);
};
