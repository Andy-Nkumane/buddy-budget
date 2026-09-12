import { calculateTotals, formatMoney } from '../formatting/money';
import type { BudgetMonthWithItems, ItemType } from '../types/domain';

export interface ReportCurrencyTotals {
  currency: string;
  income: number;
  expenses: number;
  remaining: number;
}

export const calculateReportTotalsByCurrency = (
  months: BudgetMonthWithItems[],
): ReportCurrencyTotals[] => {
  const totalsByCurrency = new Map<string, Omit<ReportCurrencyTotals, 'currency'>>();
  months.forEach((month) => {
    const totals = calculateTotals(month.budget_month_items);
    const aggregate = totalsByCurrency.get(month.currency_code) ?? {
      income: 0,
      expenses: 0,
      remaining: 0,
    };
    aggregate.income += totals.income;
    aggregate.expenses += totals.expenses;
    aggregate.remaining += totals.remaining;
    totalsByCurrency.set(month.currency_code, aggregate);
  });
  return Array.from(totalsByCurrency, ([currency, totals]) => ({ currency, ...totals }));
};

export const formatSignedReportAmount = (
  amount: number,
  itemType: ItemType,
  currency: string,
  locale: string,
): string =>
  `${itemType === 'income' ? '+' : '-'} ${formatMoney(Math.abs(amount), currency, locale)}`;
