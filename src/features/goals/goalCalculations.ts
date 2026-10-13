import type { FinancialGoal, GoalContribution } from '../../shared/types/domain';

export interface GoalProgress {
  contributedMinor: number;
  currentBalanceMinor: number;
  remainingMinor: number;
  progressPercent: number;
  recommendedMonthlyMinor: number;
  projectedCompletionDate: string | null;
  onTrack: boolean | null;
}

const addUtcMonths = (date: Date, months: number) => {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return result.toISOString().slice(0, 10);
};

const monthsThroughTarget = (fromDate: string, targetDate: string) => {
  const from = new Date(`${fromDate.slice(0, 7)}-01T00:00:00Z`);
  const target = new Date(`${targetDate.slice(0, 7)}-01T00:00:00Z`);
  return Math.max(
    1,
    (target.getUTCFullYear() - from.getUTCFullYear()) * 12 +
      target.getUTCMonth() -
      from.getUTCMonth() +
      1,
  );
};

export const calculateGoalProgress = (
  goal: FinancialGoal,
  contributions: GoalContribution[],
  asOfDate = new Date().toISOString().slice(0, 10),
): GoalProgress => {
  const contributedMinor = contributions.reduce((total, entry) => total + entry.amount_minor, 0);
  const isDebt = goal.goal_type === 'debt_paydown';
  const currentBalanceMinor = isDebt
    ? Math.max(0, goal.starting_balance_minor - contributedMinor)
    : goal.starting_balance_minor + contributedMinor;
  const achievedMinor = isDebt ? contributedMinor : currentBalanceMinor;
  const remainingMinor = Math.max(0, goal.target_amount_minor - achievedMinor);
  const progressPercent = Math.min(100, (achievedMinor / goal.target_amount_minor) * 100);
  const monthsRemaining = goal.target_date ? monthsThroughTarget(asOfDate, goal.target_date) : null;
  const requiredMonthlyMinor = monthsRemaining ? Math.ceil(remainingMinor / monthsRemaining) : 0;
  const recommendedMonthlyMinor = Math.min(
    remainingMinor,
    goal.desired_monthly_contribution_minor ?? requiredMonthlyMinor,
  );
  const projectedMonths = recommendedMonthlyMinor
    ? Math.ceil(remainingMinor / recommendedMonthlyMinor)
    : null;
  const projectedCompletionDate =
    remainingMinor === 0
      ? asOfDate
      : projectedMonths
        ? addUtcMonths(new Date(`${asOfDate}T00:00:00Z`), projectedMonths - 1)
        : null;
  const onTrack = goal.target_date
    ? remainingMinor === 0 || recommendedMonthlyMinor >= requiredMonthlyMinor
    : null;

  return {
    contributedMinor,
    currentBalanceMinor,
    remainingMinor,
    progressPercent,
    recommendedMonthlyMinor,
    projectedCompletionDate,
    onTrack,
  };
};
