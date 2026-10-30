import { describe, expect, it } from 'vitest';
import type { FinancialGoal, GoalContribution } from '../../shared/types/domain';
import { calculateGoalProgress } from './goalCalculations';

const goal = (overrides: Partial<FinancialGoal> = {}): FinancialGoal => ({
  id: 'goal',
  user_id: 'user',
  name: 'Emergency fund',
  goal_type: 'savings',
  target_amount_minor: 100_000,
  target_date: '2027-01-31',
  starting_balance_minor: 20_000,
  desired_monthly_contribution_minor: 10_000,
  desired_contribution_minor: 10_000,
  contribution_frequency: 'monthly',
  contribution_start_mode: 'this_month',
  contribution_start_date: '2026-09-01',
  priority: 1,
  status: 'active',
  category_id: null,
  account_id: null,
  created_at: '',
  updated_at: '',
  ...overrides,
});

const contribution = (amount_minor: number): GoalContribution => ({
  id: String(amount_minor),
  user_id: 'user',
  goal_id: 'goal',
  budget_month_id: 'month',
  transaction_id: null,
  goal_name_snapshot: 'Emergency fund',
  contribution_date: '2026-09-10',
  amount_minor,
  notes: null,
  created_at: '',
  updated_at: '',
});

describe('calculateGoalProgress', () => {
  it('adds savings and sinking-fund contributions to the starting balance', () => {
    const result = calculateGoalProgress(goal(), [contribution(15_000)], '2026-09-01');
    expect(result.currentBalanceMinor).toBe(35_000);
    expect(result.remainingMinor).toBe(65_000);
    expect(result.progressPercent).toBe(35);
  });

  it('reduces debt while measuring progress against the payoff target', () => {
    const result = calculateGoalProgress(
      goal({ goal_type: 'debt_paydown', starting_balance_minor: 150_000 }),
      [contribution(25_000)],
      '2026-09-01',
    );
    expect(result.currentBalanceMinor).toBe(125_000);
    expect(result.remainingMinor).toBe(75_000);
    expect(result.progressPercent).toBe(25);
  });

  it('never recommends more than the remaining target', () => {
    const result = calculateGoalProgress(goal(), [contribution(75_000)], '2026-09-01');
    expect(result.remainingMinor).toBe(5_000);
    expect(result.recommendedContributionMinor).toBe(5_000);
  });

  it('derives a contribution from the target date when no preference is set', () => {
    const result = calculateGoalProgress(
      goal({ desired_monthly_contribution_minor: null, desired_contribution_minor: null }),
      [],
      '2026-09-01',
    );
    expect(result.recommendedContributionMinor).toBe(16_000);
    expect(result.requiredContributionMinor).toBe(16_000);
    expect(result.plannedContributionMinor).toBeNull();
    expect(result.onTrack).toBe(true);
  });

  it('does not present an overdue target as an achievable remaining pace', () => {
    const result = calculateGoalProgress(goal({ target_date: '2026-08-31' }), [], '2026-09-01');
    expect(result.requiredContributionMinor).toBeNull();
    expect(result.onTrack).toBe(false);
  });

  it('counts actual weekly and fortnightly occurrences', () => {
    const weekly = calculateGoalProgress(
      goal({
        target_amount_minor: 50_000,
        starting_balance_minor: 0,
        desired_contribution_minor: null,
        desired_monthly_contribution_minor: null,
        contribution_frequency: 'weekly',
        contribution_start_date: '2026-09-01',
        target_date: '2026-09-29',
      }),
      [],
      '2026-09-01',
    );
    const fortnightly = calculateGoalProgress(
      goal({
        target_amount_minor: 30_000,
        starting_balance_minor: 0,
        desired_contribution_minor: null,
        desired_monthly_contribution_minor: null,
        contribution_frequency: 'fortnightly',
        contribution_start_date: '2026-09-01',
        target_date: '2026-09-29',
      }),
      [],
      '2026-09-01',
    );
    expect(weekly.requiredContributionMinor).toBe(10_000);
    expect(fortnightly.requiredContributionMinor).toBe(10_000);
  });

  it('preserves the original monthly anchor after the as-of date passes an occurrence', () => {
    const result = calculateGoalProgress(
      goal({
        target_amount_minor: 20_000,
        starting_balance_minor: 0,
        desired_contribution_minor: 10_000,
        contribution_frequency: 'monthly',
        contribution_start_date: '2026-01-31',
        target_date: '2026-04-30',
      }),
      [],
      '2026-02-01',
    );
    expect(result.requiredContributionMinor).toBe(6_667);
    expect(result.projectedCompletionDate).toBe('2026-03-31');
  });

  it('handles completed and zero-remaining goals exactly', () => {
    const result = calculateGoalProgress(goal(), [contribution(80_000)], '2026-09-01');
    expect(result.remainingMinor).toBe(0);
    expect(result.progressPercent).toBe(100);
    expect(result.projectedCompletionDate).toBe('2026-09-01');
  });
});
