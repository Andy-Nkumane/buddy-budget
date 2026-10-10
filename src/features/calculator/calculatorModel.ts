import { calculatePlannedMinorTotals } from '../../shared/formatting/money';
import { parseMoney } from '../../shared/validation/schemas';

export type CalculatorItemType = 'income' | 'expense';

export type CalculatorRow = {
  id: string;
  name: string;
  categoryName: string;
  itemType: CalculatorItemType;
  amount: string;
};

export const createCalculatorRows = (): CalculatorRow[] => [
  { id: 'income-1', name: 'Income', categoryName: 'Earnings', itemType: 'income', amount: '0.00' },
  {
    id: 'expense-1',
    name: 'Housing',
    categoryName: 'Housing',
    itemType: 'expense',
    amount: '0.00',
  },
  {
    id: 'expense-2',
    name: 'Groceries',
    categoryName: 'Groceries',
    itemType: 'expense',
    amount: '0.00',
  },
];

export const calculateCalculatorTotals = (rows: CalculatorRow[]) => {
  const totals = calculatePlannedMinorTotals(
    rows
      .filter((row) => parseMoney(row.amount) !== null)
      .map((row) => ({ item_type: row.itemType, amount: row.amount })),
  );
  return {
    incomeMinor: totals.incomeMinorUnits,
    expenseMinor: totals.expenseMinorUnits,
    remainingMinor: totals.remainingMinorUnits,
    savingsRate: totals.savingsRate,
  };
};

export const isCalculatorRowValid = (row: CalculatorRow) =>
  row.name.trim().length > 0 &&
  row.name.trim().length <= 100 &&
  row.categoryName.trim().length > 0 &&
  row.categoryName.trim().length <= 80 &&
  parseMoney(row.amount) !== null;
