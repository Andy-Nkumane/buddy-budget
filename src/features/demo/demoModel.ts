export type DemoItemType = 'income' | 'expense';

export type DemoPlanItem = {
  id: string;
  name: string;
  categoryName: string;
  itemType: DemoItemType;
  plannedMinor: number;
};

export type DemoTransaction = {
  id: string;
  description: string;
  itemId: string;
  itemType: DemoItemType;
  amountMinor: number;
};

export type DemoState = {
  items: DemoPlanItem[];
  transactions: DemoTransaction[];
};

export type DemoStarterPlan = {
  version: 1;
  expiresAt: string;
  currencyCode: string;
  locale?: string;
  templateName: string;
  items: Array<{
    name: string;
    categoryName: string;
    itemType: DemoItemType;
    amountMinor: number;
  }>;
};

export const DEMO_STARTER_PLAN_KEY = 'buddy-budget-approved-demo-plan';
const MAX_STARTER_ITEMS = 20;
const STARTER_LIFETIME_MS = 24 * 60 * 60 * 1000;
const MAX_STARTER_AMOUNT_MINOR = 99_999_999_999_999;

const isSupportedLocale = (value: string) => {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
};

export const createDemoState = (): DemoState => ({
  items: [
    {
      id: 'salary',
      name: 'Salary',
      categoryName: 'Earnings',
      itemType: 'income',
      plannedMinor: 4_500_000,
    },
    {
      id: 'rent',
      name: 'Rent',
      categoryName: 'Housing',
      itemType: 'expense',
      plannedMinor: 1_450_000,
    },
    {
      id: 'groceries',
      name: 'Groceries',
      categoryName: 'Groceries',
      itemType: 'expense',
      plannedMinor: 520_000,
    },
    {
      id: 'transport',
      name: 'Transport',
      categoryName: 'Transport',
      itemType: 'expense',
      plannedMinor: 280_000,
    },
    {
      id: 'entertainment',
      name: 'Entertainment',
      categoryName: 'Entertainment',
      itemType: 'expense',
      plannedMinor: 200_000,
    },
  ],
  transactions: [
    {
      id: 'sample-salary',
      description: 'Monthly salary',
      itemId: 'salary',
      itemType: 'income',
      amountMinor: 4_500_000,
    },
    {
      id: 'sample-rent',
      description: 'Rent payment',
      itemId: 'rent',
      itemType: 'expense',
      amountMinor: 1_450_000,
    },
    {
      id: 'sample-groceries',
      description: 'Groceries so far',
      itemId: 'groceries',
      itemType: 'expense',
      amountMinor: 418_500,
    },
    {
      id: 'sample-transport',
      description: 'Transport so far',
      itemId: 'transport',
      itemType: 'expense',
      amountMinor: 196_000,
    },
  ],
});

export const parseDemoMoney = (value: string): number | null => {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : null;
};

export const calculateDemoTotals = (state: DemoState) => {
  const plannedIncomeMinor = state.items
    .filter((item) => item.itemType === 'income')
    .reduce((total, item) => total + item.plannedMinor, 0);
  const plannedExpenseMinor = state.items
    .filter((item) => item.itemType === 'expense')
    .reduce((total, item) => total + item.plannedMinor, 0);
  const actualIncomeMinor = state.transactions
    .filter((transaction) => transaction.itemType === 'income')
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  const actualExpenseMinor = state.transactions
    .filter((transaction) => transaction.itemType === 'expense')
    .reduce((total, transaction) => total + transaction.amountMinor, 0);
  return {
    plannedIncomeMinor,
    plannedExpenseMinor,
    actualIncomeMinor,
    actualExpenseMinor,
    plannedRemainingMinor: plannedIncomeMinor - plannedExpenseMinor,
    actualRemainingMinor: actualIncomeMinor - actualExpenseMinor,
  };
};

export const createStarterPlan = (items: DemoPlanItem[], now = new Date()): DemoStarterPlan => ({
  version: 1,
  expiresAt: new Date(now.getTime() + STARTER_LIFETIME_MS).toISOString(),
  currencyCode: 'ZAR',
  templateName: 'My monthly plan',
  items: items.map(({ name, categoryName, itemType, plannedMinor }) => ({
    name,
    categoryName,
    itemType,
    amountMinor: plannedMinor,
  })),
});

const isStarterPlan = (value: unknown, now: Date): value is DemoStarterPlan => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DemoStarterPlan>;
  return (
    candidate.version === 1 &&
    typeof candidate.currencyCode === 'string' &&
    /^[A-Z]{3}$/.test(candidate.currencyCode) &&
    (candidate.locale === undefined ||
      (typeof candidate.locale === 'string' &&
        candidate.locale.length >= 2 &&
        candidate.locale.length <= 35 &&
        isSupportedLocale(candidate.locale))) &&
    typeof candidate.templateName === 'string' &&
    candidate.templateName.trim().length > 0 &&
    candidate.templateName.length <= 80 &&
    typeof candidate.expiresAt === 'string' &&
    Date.parse(candidate.expiresAt) > now.getTime() &&
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.length <= MAX_STARTER_ITEMS &&
    candidate.items.every(
      (item) =>
        item &&
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        item.name.length <= 100 &&
        typeof item.categoryName === 'string' &&
        item.categoryName.trim().length > 0 &&
        item.categoryName.length <= 80 &&
        (item.itemType === 'income' || item.itemType === 'expense') &&
        Number.isSafeInteger(item.amountMinor) &&
        item.amountMinor >= 0 &&
        item.amountMinor <= MAX_STARTER_AMOUNT_MINOR,
    )
  );
};

export const saveApprovedStarterPlan = (
  storage: Pick<Storage, 'setItem'>,
  items: DemoPlanItem[],
  now = new Date(),
): void => {
  storage.setItem(DEMO_STARTER_PLAN_KEY, JSON.stringify(createStarterPlan(items, now)));
};

export const saveApprovedLocalPlan = (
  storage: Pick<Storage, 'setItem'>,
  plan: Pick<DemoStarterPlan, 'currencyCode' | 'locale' | 'templateName' | 'items'>,
  now = new Date(),
): void => {
  storage.setItem(
    DEMO_STARTER_PLAN_KEY,
    JSON.stringify({
      ...plan,
      version: 1,
      expiresAt: new Date(now.getTime() + STARTER_LIFETIME_MS).toISOString(),
    } satisfies DemoStarterPlan),
  );
};

export const retrieveApprovedStarterPlan = (
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  now = new Date(),
): DemoStarterPlan | null => {
  try {
    const stored = storage.getItem(DEMO_STARTER_PLAN_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (isStarterPlan(parsed, now)) return parsed;
  } catch {
    return null;
  }
  try {
    storage.removeItem(DEMO_STARTER_PLAN_KEY);
  } catch {
    return null;
  }
  return null;
};

export const clearApprovedStarterPlan = (storage: Pick<Storage, 'removeItem'>): void => {
  try {
    storage.removeItem(DEMO_STARTER_PLAN_KEY);
  } catch {
    // Successful onboarding must not be reported as failed when storage cleanup is blocked.
  }
};
