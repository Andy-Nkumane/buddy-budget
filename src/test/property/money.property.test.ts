import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addMinorUnitsExact } from '../../features/schedules/cashFlow';
import { calculatePlannedMinorTotals, moneyToMinorUnits } from '../../shared/formatting/money';

const seed = 13_010_001;
const toDecimal = (minor: number): string => {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
};

describe('exact-money properties', () => {
  it('round-trips bounded safe minor-unit integers through decimal parsing', () => {
    fc.assert(
      fc.property(fc.integer({ min: -99_999_999_999_999, max: 99_999_999_999_999 }), (minor) => {
        expect(moneyToMinorUnits(toDecimal(minor))).toBe(minor);
      }),
      { seed, numRuns: 200 },
    );
  });

  it('aggregates income and expenses independently in exact minor units', () => {
    const item = fc.record({
      item_type: fc.constantFrom<'income' | 'expense'>('income', 'expense'),
      minor: fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
    });
    fc.assert(
      fc.property(fc.array(item, { maxLength: 40 }), (items) => {
        const totals = calculatePlannedMinorTotals(
          items.map(({ item_type, minor }) => ({ item_type, amount: toDecimal(minor) })),
        );
        const income = items
          .filter(({ item_type }) => item_type === 'income')
          .reduce((total, { minor }) => total + minor, 0);
        const expenses = items
          .filter(({ item_type }) => item_type === 'expense')
          .reduce((total, { minor }) => total + minor, 0);
        expect(totals.incomeMinorUnits).toBe(income);
        expect(totals.expenseMinorUnits).toBe(expenses);
        expect(totals.remainingMinorUnits).toBe(income - expenses);
      }),
      { seed: seed + 1, numRuns: 150 },
    );
  });

  it('adds bounded cash-flow values without changing integer semantics', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }),
        fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }),
        (left, right) => {
          expect(addMinorUnitsExact(left, right)).toBe(left + right);
        },
      ),
      { seed: seed + 2, numRuns: 150 },
    );
  });
});
