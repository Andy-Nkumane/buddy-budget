import { calculateBudgetProgress, moneyToMinorUnits } from '../../shared/formatting/money';
import type { BudgetMonthWithItems, Profile } from '../../shared/types/domain';

export type SharedReportSelection = {
  totals: boolean;
  categories: boolean;
  transactions: boolean;
  transactionNames: boolean;
  notes: boolean;
  goals: boolean;
};

export type SharedReportSnapshot = {
  version: 1;
  title: string;
  rangeLabel: string;
  snapshotAt: string;
  locale: string;
  selection: SharedReportSelection;
  omitted: string[];
  months: Array<{
    monthStart: string;
    currencyCode: string;
    totals?: {
      plannedIncomeMinor: number;
      plannedExpenseMinor: number;
      actualIncomeMinor: number;
      actualExpenseMinor: number;
      remainingMinor: number;
    };
    categories?: Array<{
      name: string;
      itemType: 'income' | 'expense';
      plannedMinor: number;
      actualMinor: number;
    }>;
    transactions?: Array<{
      date: string;
      type: 'income' | 'expense';
      amountMinor: number;
      name?: string;
      category?: string;
      notes?: string;
    }>;
    notes?: string;
    goals?: Array<{ name: string; type: string; recommendedMinor: number; priority: number }>;
  }>;
};

export const defaultSharedReportSelection: SharedReportSelection = {
  totals: true,
  categories: true,
  transactions: false,
  transactionNames: false,
  notes: false,
  goals: false,
};

export const createSharedReportSnapshot = (
  months: BudgetMonthWithItems[],
  profile: Profile,
  rangeLabel: string,
  selection: SharedReportSelection,
  snapshotAt = new Date().toISOString(),
): SharedReportSnapshot => ({
  version: 1,
  title: 'Shared Buddy Budget report',
  rangeLabel,
  snapshotAt,
  locale: profile.locale,
  selection,
  omitted: [
    ...(!selection.transactions ? ['transaction details'] : []),
    ...(selection.transactions && !selection.transactionNames ? ['transaction names'] : []),
    ...(!selection.notes ? ['notes'] : []),
    ...(!selection.goals ? ['goal data'] : []),
    ...(!selection.categories ? ['category breakdowns'] : []),
    ...(!selection.totals ? ['month totals'] : []),
  ],
  months: months.map((month) => {
    const progress = calculateBudgetProgress(month.budget_month_items, month.budget_transactions);
    const categories = new Map<
      string,
      { name: string; itemType: 'income' | 'expense'; plannedMinor: number; actualMinor: number }
    >();
    if (selection.categories) {
      month.budget_month_items.forEach((item) => {
        const name = item.category_snapshot ?? 'Uncategorised';
        const key = `${item.item_type}:${name}`;
        const current = categories.get(key) ?? {
          name,
          itemType: item.item_type,
          plannedMinor: 0,
          actualMinor: 0,
        };
        if (!item.is_disabled) current.plannedMinor += moneyToMinorUnits(item.amount);
        categories.set(key, current);
      });
      month.budget_transactions
        .filter((transaction) => transaction.status === 'posted')
        .forEach((transaction) => {
          const name = transaction.category_snapshot ?? 'Uncategorised';
          const key = `${transaction.transaction_type}:${name}`;
          const current = categories.get(key) ?? {
            name,
            itemType: transaction.transaction_type,
            plannedMinor: 0,
            actualMinor: 0,
          };
          current.actualMinor += transaction.is_refund
            ? -transaction.amount_minor
            : transaction.amount_minor;
          categories.set(key, current);
        });
    }
    return {
      monthStart: month.month_start,
      currencyCode: month.currency_code,
      ...(selection.totals
        ? {
            totals: {
              plannedIncomeMinor: moneyToMinorUnits(progress.planned.income),
              plannedExpenseMinor: moneyToMinorUnits(progress.planned.expenses),
              actualIncomeMinor: moneyToMinorUnits(progress.actual.income),
              actualExpenseMinor: moneyToMinorUnits(progress.actual.expenses),
              remainingMinor: moneyToMinorUnits(progress.actual.remaining),
            },
          }
        : {}),
      ...(selection.categories ? { categories: [...categories.values()] } : {}),
      ...(selection.transactions
        ? {
            transactions: month.budget_transactions.map((transaction) => ({
              date: transaction.transaction_date,
              type: transaction.transaction_type,
              amountMinor: transaction.is_refund
                ? -transaction.amount_minor
                : transaction.amount_minor,
              ...(selection.transactionNames ? { name: transaction.description } : {}),
              category: transaction.category_snapshot ?? 'Uncategorised',
              ...(selection.notes && transaction.notes ? { notes: transaction.notes } : {}),
            })),
          }
        : {}),
      ...(selection.notes && month.notes ? { notes: month.notes } : {}),
      ...(selection.goals
        ? {
            goals: (month.goal_month_recommendations ?? []).map((goal) => ({
              name: goal.name_snapshot,
              type: goal.goal_type,
              recommendedMinor: goal.recommended_amount_minor,
              priority: goal.priority,
            })),
          }
        : {}),
    };
  }),
});
