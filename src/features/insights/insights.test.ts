import { describe, expect, it } from 'vitest';
import type { InsightCategoryMetric, InsightMonthlyMetric } from '../../shared/types/domain';
import {
  describeSavingsTrend,
  findRepeatedOverspending,
  resolveInsightRange,
  selectVarianceAction,
} from './insights';

const month = (
  monthStart: string,
  savingsRate: number | null,
  plannedExpenses = 10000,
  actualExpenses = 9000,
): InsightMonthlyMetric => ({
  month_start: monthStart,
  currency_code: 'ZAR',
  planned_income_minor: 20000,
  planned_expenses_minor: plannedExpenses,
  actual_income_minor: 20000,
  actual_expenses_minor: actualExpenses,
  income_variance_minor: 0,
  expense_variance_minor: actualExpenses - plannedExpenses,
  savings_minor: 20000 - actualExpenses,
  savings_rate_basis_points: savingsRate,
  adjustment_income_minor: 0,
  adjustment_expenses_minor: 0,
});

const category = (overspentMonths: number): InsightCategoryMetric => ({
  category_id: 'category-id',
  category_name: 'Dining',
  item_type: 'expense',
  currency_code: 'ZAR',
  planned_minor: 10000,
  actual_minor: 14000,
  variance_minor: 4000,
  average_actual_minor: 7000,
  months_with_data: 2,
  overspent_months: overspentMonths,
});

describe('budget insight decisions', () => {
  it('resolves deterministic bounded month presets', () => {
    expect(resolveInsightRange('last3', '', '', '2026-09-01')).toEqual({
      fromMonth: '2026-07-01',
      toMonth: '2026-09-01',
    });
    expect(resolveInsightRange('ytd', '', '', '2026-09-01')).toEqual({
      fromMonth: '2026-01-01',
      toMonth: '2026-09-01',
    });
  });

  it('distinguishes insufficient savings data from a zero rate', () => {
    expect(describeSavingsTrend([month('2026-08-01', 0)])).toMatch('Insufficient data');
    expect(describeSavingsTrend([month('2026-08-01', 0), month('2026-09-01', 500)])).toMatch(
      'up 5 percentage points',
    );
  });

  it('prioritises repeated category overspending for the recommended action', () => {
    expect(findRepeatedOverspending([category(2)])).toHaveLength(1);
    expect(selectVarianceAction([month('2026-09-01', 500)], [category(2)])).toBe(
      'Review Dining: it exceeded plan in 2 months.',
    );
  });
});
