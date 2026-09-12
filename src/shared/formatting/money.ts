import type { BudgetMonthItem } from '../types/domain';

export const formatMoney = (value: number, currencyCode = 'ZAR', locale = 'en-ZA'): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const calculateTotals = (items: BudgetMonthItem[]) => {
  const activeItems = items.filter((item) => item.archived_at === null && !item.is_disabled);
  const income = activeItems
    .filter((item) => item.item_type === 'income')
    .reduce((total, item) => total + Number(item.amount), 0);
  const expenses = activeItems
    .filter((item) => item.item_type === 'expense')
    .reduce((total, item) => total + Number(item.amount), 0);
  const remaining = income - expenses;
  const savingsRate = income > 0 ? (remaining / income) * 100 : null;
  return { income, expenses, remaining, savingsRate };
};

export const formatMonth = (monthStart: string, locale = 'en-ZA'): string =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${monthStart}T00:00:00Z`),
  );

export const currentMonthStart = (): string => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

export const adjacentMonthStart = (monthStart: string, offset: number): string => {
  const [year, month] = monthStart.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
};
