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
    expect(result.recommendedMonthlyMinor).toBe(5_000);
  });

  it('derives a contribution from the target date when no preference is set', () => {
    const result = calculateGoalProgress(
      goal({ desired_monthly_contribution_minor: null }),
      [],
      '2026-09-01',
    );
    expect(result.recommendedMonthlyMinor).toBe(16_000);
    expect(result.onTrack).toBe(true);
  });

  it('handles completed and zero-remaining goals exactly', () => {
    const result = calculateGoalProgress(goal(), [contribution(80_000)], '2026-09-01');
    expect(result.remainingMinor).toBe(0);
    expect(result.progressPercent).toBe(100);
    expect(result.projectedCompletionDate).toBe('2026-09-01');
  });
});
