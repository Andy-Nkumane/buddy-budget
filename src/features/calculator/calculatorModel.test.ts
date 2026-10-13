import { describe, expect, it } from 'vitest';
import { calculateCalculatorTotals, createCalculatorRows } from './calculatorModel';

describe('public calculator totals', () => {
  it('uses exact minor units for decimals and negative results', () => {
    const rows = createCalculatorRows();
    rows[0].amount = '1000.10';
    rows[1].amount = '900.05';
    rows[2].amount = '200.15';
    expect(calculateCalculatorTotals(rows)).toEqual({
      incomeMinor: 100010,
      expenseMinor: 110020,
      remainingMinor: -10010,
      savingsRate: -10.00899910008999,
    });
  });

  it('distinguishes zero income from a zero savings rate', () => {
    expect(calculateCalculatorTotals(createCalculatorRows()).savingsRate).toBeNull();
  });
});
