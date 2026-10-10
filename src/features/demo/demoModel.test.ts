import { describe, expect, it } from 'vitest';
import {
  calculateDemoTotals,
  clearApprovedStarterPlan,
  createDemoState,
  DEMO_STARTER_PLAN_KEY,
  retrieveApprovedStarterPlan,
  saveApprovedLocalPlan,
  saveApprovedStarterPlan,
} from './demoModel';

describe('demo model', () => {
  it('creates isolated deterministic state and exact totals', () => {
    const first = createDemoState();
    const second = createDemoState();
    first.items[0].plannedMinor = 1;
    expect(second.items[0].plannedMinor).toBe(4_500_000);
    expect(calculateDemoTotals(second)).toEqual({
      plannedIncomeMinor: 4_500_000,
      plannedExpenseMinor: 2_450_000,
      actualIncomeMinor: 4_500_000,
      actualExpenseMinor: 2_064_500,
      plannedRemainingMinor: 2_050_000,
      actualRemainingMinor: 2_435_500,
    });
  });

  it('reset returns the original fictional state', () => {
    const changed = createDemoState();
    changed.items.pop();
    changed.transactions.push({
      id: 'visitor',
      description: 'Visitor sample',
      itemId: 'rent',
      itemType: 'expense',
      amountMinor: 100,
    });
    expect(createDemoState()).toEqual(createDemoState());
    expect(createDemoState()).not.toEqual(changed);
  });

  it('stores only the approved plan and never demo transactions', () => {
    const state = createDemoState();
    saveApprovedStarterPlan(localStorage, state.items, new Date('2026-10-08T10:00:00Z'));
    const raw = localStorage.getItem(DEMO_STARTER_PLAN_KEY) ?? '';
    const plan = retrieveApprovedStarterPlan(localStorage, new Date('2026-10-08T11:00:00Z'));
    expect(raw).not.toContain('transactions');
    expect(raw).not.toContain('Rent payment');
    expect(plan?.items).toHaveLength(state.items.length);
    expect(plan?.items[0]).toEqual({
      name: 'Salary',
      categoryName: 'Earnings',
      itemType: 'income',
      amountMinor: 4_500_000,
    });
  });

  it('expires and consumes the starter handoff predictably', () => {
    const state = createDemoState();
    saveApprovedStarterPlan(localStorage, state.items, new Date('2026-10-08T10:00:00Z'));
    expect(retrieveApprovedStarterPlan(localStorage, new Date('2026-10-10T10:00:00Z'))).toBeNull();
    saveApprovedStarterPlan(localStorage, state.items);
    clearApprovedStarterPlan(localStorage);
    expect(localStorage.getItem(DEMO_STARTER_PLAN_KEY)).toBeNull();
  });

  it('preserves an explicitly approved calculator currency and locale', () => {
    saveApprovedLocalPlan(localStorage, {
      currencyCode: 'USD',
      locale: 'en-US',
      templateName: 'My monthly plan',
      items: [
        {
          name: 'Income',
          categoryName: 'Earnings',
          itemType: 'income',
          amountMinor: 100_000,
        },
      ],
    });
    expect(retrieveApprovedStarterPlan(localStorage)).toMatchObject({
      currencyCode: 'USD',
      locale: 'en-US',
    });
  });
});
