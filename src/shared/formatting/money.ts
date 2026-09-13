import type { BudgetMonthItem } from '../types/domain';

export const formatMoney = (value: number, currencyCode = 'ZAR', locale = 'en-ZA'): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const moneyToMinorUnits = (value: string | number): number => {
  const normalized = String(value).trim().replace(/,/g, '');
  const match = /^(-?)(\d+)(?:\.(\d{0,2}))?$/.exec(normalized);
  if (!match) throw new Error('Invalid monetary amount.');
  const minorUnits = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return match[1] === '-' ? -minorUnits : minorUnits;
};

export const minorUnitsToMoney = (value: number): number => value / 100;

export const calculateTotals = (items: BudgetMonthItem[]) => {
  const activeItems = items.filter((item) => item.archived_at === null && !item.is_disabled);
  const incomeMinorUnits = activeItems
    .filter((item) => item.item_type === 'income')
    .reduce((total, item) => total + moneyToMinorUnits(item.amount), 0);
  const expenseMinorUnits = activeItems
    .filter((item) => item.item_type === 'expense')
    .reduce((total, item) => total + moneyToMinorUnits(item.amount), 0);
  const income = minorUnitsToMoney(incomeMinorUnits);
  const expenses = minorUnitsToMoney(expenseMinorUnits);
  const remaining = minorUnitsToMoney(incomeMinorUnits - expenseMinorUnits);
  const savingsRate = income > 0 ? (remaining / income) * 100 : null;
  return { income, expenses, remaining, savingsRate };
};

export const formatMonth = (monthStart: string, locale = 'en-ZA'): string =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${monthStart}T00:00:00Z`),
  );

export const currentMonthStart = (timeZone?: string, date = new Date()): string => {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
      }).formatToParts(date);
      const year = parts.find((part) => part.type === 'year')?.value;
      const month = parts.find((part) => part.type === 'month')?.value;
      if (year && month) return `${year}-${month}-01`;
    } catch {
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
    }
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

export const adjacentMonthStart = (monthStart: string, offset: number): string => {
  const [year, month] = monthStart.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

export const isMonthReadOnly = (monthStart: string, current = currentMonthStart()): boolean =>
  monthStart < adjacentMonthStart(current, -1);
