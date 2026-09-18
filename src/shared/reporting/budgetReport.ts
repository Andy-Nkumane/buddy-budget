import {
  calculateBudgetProgress,
  formatMoney,
  minorUnitsToMoney,
  moneyToMinorUnits,
} from '../formatting/money';
import type { BudgetMonthWithItems, BudgetTransaction, ItemType } from '../types/domain';

export interface ReportCurrencyTotals {
  currency: string;
  plannedIncome: number;
  actualIncome: number;
  plannedExpenses: number;
  actualExpenses: number;
  available: number;
}

export const calculateReportTotalsByCurrency = (
  months: BudgetMonthWithItems[],
): ReportCurrencyTotals[] => {
  const totalsByCurrency = new Map<string, Omit<ReportCurrencyTotals, 'currency'>>();
  months.forEach((month) => {
    const progress = calculateBudgetProgress(month.budget_month_items, month.budget_transactions);
    const aggregate = totalsByCurrency.get(month.currency_code) ?? {
      plannedIncome: 0,
      actualIncome: 0,
      plannedExpenses: 0,
      actualExpenses: 0,
      available: 0,
    };
    aggregate.plannedIncome = minorUnitsToMoney(
      moneyToMinorUnits(aggregate.plannedIncome) + moneyToMinorUnits(progress.planned.income),
    );
    aggregate.actualIncome = minorUnitsToMoney(
      moneyToMinorUnits(aggregate.actualIncome) + moneyToMinorUnits(progress.actual.income),
    );
    aggregate.plannedExpenses = minorUnitsToMoney(
      moneyToMinorUnits(aggregate.plannedExpenses) + moneyToMinorUnits(progress.planned.expenses),
    );
    aggregate.actualExpenses = minorUnitsToMoney(
      moneyToMinorUnits(aggregate.actualExpenses) + moneyToMinorUnits(progress.actual.expenses),
    );
    aggregate.available = minorUnitsToMoney(
      moneyToMinorUnits(aggregate.available) + moneyToMinorUnits(progress.available),
    );
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
  `${(itemType === 'income') === amount >= 0 ? '+' : '-'} ${formatMoney(
    Math.abs(amount),
    currency,
    locale,
  )}`;

export const formatSignedTransactionAmount = (
  transaction: BudgetTransaction,
  currency: string,
  locale: string,
): string => {
  const positiveCashFlow =
    (transaction.transaction_type === 'income' && !transaction.is_refund) ||
    (transaction.transaction_type === 'expense' && transaction.is_refund);
  return `${positiveCashFlow ? '+' : '-'} ${formatMoney(
    transaction.amount_minor / 100,
    currency,
    locale,
  )}`;
};
