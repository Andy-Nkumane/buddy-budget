import { calculateBudgetProgress, moneyToMinorUnits } from '../../shared/formatting/money';
import type { BudgetMonthWithItems } from '../../shared/types/domain';

export const buildMonthCloseChecklist = (month: BudgetMonthWithItems) => {
  const progress = calculateBudgetProgress(month.budget_month_items, month.budget_transactions);
  const uncategorisedCount = month.budget_transactions.filter(
    (entry) => entry.status === 'posted' && entry.category_id === null,
  ).length;
  const unmatchedScheduleCount = (month.payment_schedule_occurrences ?? []).filter(
    (entry) => entry.status === 'expected' && entry.matched_transaction_id === null,
  ).length;
  const contributionsByGoal = new Map<string, number>();
  (month.goal_contributions ?? []).forEach((entry) =>
    contributionsByGoal.set(
      entry.goal_id,
      (contributionsByGoal.get(entry.goal_id) ?? 0) + entry.amount_minor,
    ),
  );
  const incompleteGoalCount = (month.goal_month_recommendations ?? []).filter(
    (entry) => (contributionsByGoal.get(entry.goal_id) ?? 0) < entry.recommended_amount_minor,
  ).length;
  return { progress, uncategorisedCount, unmatchedScheduleCount, incompleteGoalCount };
};

export const parseAdjustmentAmount = (value: string): number => {
  const minor = moneyToMinorUnits(value);
  if (minor <= 0) throw new Error('Enter an amount greater than zero.');
  return minor;
};
