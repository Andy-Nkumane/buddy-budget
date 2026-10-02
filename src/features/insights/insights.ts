import { adjacentMonthStart, currentMonthStart } from '../../shared/formatting/money';
import type { InsightCategoryMetric, InsightMonthlyMetric } from '../../shared/types/domain';

export type InsightRangePreset = 'last3' | 'last6' | 'last12' | 'ytd' | 'custom';

export const resolveInsightRange = (
  preset: InsightRangePreset,
  customFrom: string,
  customTo: string,
  currentMonth = currentMonthStart(),
) => {
  const toMonth = currentMonth;
  if (preset === 'custom') {
    return {
      fromMonth: customFrom ? `${customFrom}-01` : '',
      toMonth: customTo ? `${customTo}-01` : '',
    };
  }
  if (preset === 'ytd') return { fromMonth: `${currentMonth.slice(0, 4)}-01-01`, toMonth };
  const monthCount = preset === 'last3' ? 3 : preset === 'last12' ? 12 : 6;
  return { fromMonth: adjacentMonthStart(currentMonth, -(monthCount - 1)), toMonth };
};

export const findRepeatedOverspending = (categories: InsightCategoryMetric[]) =>
  categories
    .filter((category) => category.item_type === 'expense' && category.overspent_months >= 2)
    .sort(
      (left, right) =>
        right.overspent_months - left.overspent_months ||
        right.variance_minor - left.variance_minor,
    );

export const selectVarianceAction = (
  months: InsightMonthlyMetric[],
  categories: InsightCategoryMetric[],
): string => {
  const repeated = findRepeatedOverspending(categories)[0];
  if (repeated) {
    return `Review ${repeated.category_name}: it exceeded plan in ${repeated.overspent_months} months.`;
  }
  const latest = months.at(-1);
  if (!latest) return 'Record a budget month and posted transactions to unlock an action.';
  if (latest.actual_expenses_minor > latest.planned_expenses_minor) {
    return 'Review the latest month’s largest unplanned expense before changing next month’s plan.';
  }
  if (latest.actual_income_minor < latest.planned_income_minor) {
    return 'Confirm expected income dates and reduce commitments until the shortfall is resolved.';
  }
  return 'Keep the current plan and review again after the next posted transaction.';
};

export const describeSavingsTrend = (months: InsightMonthlyMetric[]): string => {
  const available = months.filter((month) => month.savings_rate_basis_points !== null);
  if (available.length < 2)
    return 'Insufficient data: at least two months with positive income are needed.';
  const first = available[0].savings_rate_basis_points ?? 0;
  const latest = available.at(-1)?.savings_rate_basis_points ?? 0;
  if (latest === first) return 'The savings rate is unchanged across the available period.';
  return `The savings rate is ${latest > first ? 'up' : 'down'} ${Math.abs(latest - first) / 100} percentage points from the first comparable month.`;
};
