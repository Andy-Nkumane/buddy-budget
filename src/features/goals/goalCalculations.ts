import type {
  FinancialGoal,
  GoalContribution,
  GoalContributionFrequency,
} from '../../shared/types/domain';

export interface GoalProgress {
  contributedMinor: number;
  currentBalanceMinor: number;
  remainingMinor: number;
  progressPercent: number;
  requiredContributionMinor: number | null;
  plannedContributionMinor: number | null;
  recommendedContributionMinor: number;
  projectedCompletionDate: string | null;
  onTrack: boolean | null;
}

const parseDate = (value: string) => new Date(`${value}T00:00:00Z`);
const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const addMonthsClamped = (value: string, months: number) => {
  const start = parseDate(value);
  const targetMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  targetMonth.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return formatDate(targetMonth);
};

const occurrenceDate = (startDate: string, frequency: GoalContributionFrequency, index: number) => {
  if (frequency === 'monthly') return addMonthsClamped(startDate, index);
  const days = frequency === 'daily' ? index : frequency === 'weekly' ? index * 7 : index * 14;
  const date = parseDate(startDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
};

export const countGoalOccurrences = (
  startDate: string,
  endDate: string,
  frequency: GoalContributionFrequency,
  fromDate = startDate,
) => {
  if (endDate < startDate) return 0;
  let occurrenceIndex = 0;
  let count = 0;
  let candidate = occurrenceDate(startDate, frequency, occurrenceIndex);
  while (occurrenceIndex < 11_000 && candidate <= endDate) {
    if (candidate >= fromDate) count += 1;
    occurrenceIndex += 1;
    candidate = occurrenceDate(startDate, frequency, occurrenceIndex);
  }
  return count;
};

const nextOccurrenceIndex = (
  startDate: string,
  fromDate: string,
  frequency: GoalContributionFrequency,
) => {
  let index = 0;
  while (index < 11_000 && occurrenceDate(startDate, frequency, index) < fromDate) index += 1;
  return index;
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
  const occurrenceCount = goal.target_date
    ? countGoalOccurrences(
        goal.contribution_start_date,
        goal.target_date,
        goal.contribution_frequency,
        asOfDate,
      )
    : 0;
  const requiredContributionMinor = occurrenceCount
    ? Math.ceil(remainingMinor / occurrenceCount)
    : null;
  const plannedContributionMinor =
    goal.desired_contribution_minor ?? goal.desired_monthly_contribution_minor;
  const recommendedContributionMinor = Math.min(
    remainingMinor,
    plannedContributionMinor ?? requiredContributionMinor ?? 0,
  );
  const projectedOccurrences = plannedContributionMinor
    ? Math.ceil(remainingMinor / plannedContributionMinor)
    : null;
  const projectedCompletionDate =
    remainingMinor === 0
      ? asOfDate
      : projectedOccurrences
        ? occurrenceDate(
            goal.contribution_start_date,
            goal.contribution_frequency,
            nextOccurrenceIndex(
              goal.contribution_start_date,
              asOfDate,
              goal.contribution_frequency,
            ) +
              projectedOccurrences -
              1,
          )
        : null;
  const onTrack = goal.target_date
    ? remainingMinor === 0 ||
      (requiredContributionMinor !== null &&
        recommendedContributionMinor >= requiredContributionMinor)
    : null;

  return {
    contributedMinor,
    currentBalanceMinor,
    remainingMinor,
    progressPercent,
    requiredContributionMinor,
    plannedContributionMinor,
    recommendedContributionMinor,
    projectedCompletionDate,
    onTrack,
  };
};
