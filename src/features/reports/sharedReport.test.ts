import { describe, expect, it } from 'vitest';
import type { BudgetMonthWithItems, Profile } from '../../shared/types/domain';
import { createSharedReportSnapshot, defaultSharedReportSelection } from './sharedReport';

const profile = { locale: 'en-ZA' } as Profile;
const month = {
  id: 'month-1',
  month_start: '2026-10-01',
  currency_code: 'ZAR',
  notes: 'Private month note',
  budget_month_items: [
    {
      id: 'item-1',
      item_type: 'expense',
      category_snapshot: 'Food',
      amount: '100.00',
      is_disabled: false,
      archived_at: null,
    },
  ],
  budget_transactions: [
    {
      id: 'transaction-1',
      transaction_date: '2026-10-03',
      transaction_type: 'expense',
      description: 'Private merchant',
      category_snapshot: 'Food',
      amount_minor: 2500,
      is_refund: false,
      status: 'posted',
      notes: 'Private note',
      budget_month_item_id: 'item-1',
    },
  ],
  goal_month_recommendations: [
    {
      id: 'goal-1',
      name_snapshot: 'Emergency fund',
      goal_type: 'savings',
      recommended_amount_minor: 5000,
      priority: 2,
    },
  ],
} as BudgetMonthWithItems;

describe('shared report privacy scope', () => {
  it('defaults to aggregates and omits transaction, note, and goal fields', () => {
    const snapshot = createSharedReportSnapshot(
      [month],
      profile,
      'October 2026',
      defaultSharedReportSelection,
      '2026-10-10T10:00:00Z',
    );
    expect(snapshot.months[0].totals).toBeDefined();
    expect(snapshot.months[0].categories).toEqual([
      { name: 'Food', itemType: 'expense', plannedMinor: 10000, actualMinor: 2500 },
    ]);
    expect(snapshot.months[0]).not.toHaveProperty('transactions');
    expect(snapshot.months[0]).not.toHaveProperty('notes');
    expect(snapshot.months[0]).not.toHaveProperty('goals');
    expect(JSON.stringify(snapshot)).not.toContain('Private merchant');
  });

  it('includes only explicitly approved transaction fields', () => {
    const snapshot = createSharedReportSnapshot(
      [month],
      profile,
      'October 2026',
      { ...defaultSharedReportSelection, transactions: true },
      '2026-10-10T10:00:00Z',
    );
    expect(snapshot.months[0].transactions?.[0]).toEqual({
      date: '2026-10-03',
      type: 'expense',
      amountMinor: 2500,
      category: 'Food',
    });
  });

  it('is immutable after underlying data changes', () => {
    const snapshot = createSharedReportSnapshot(
      [month],
      profile,
      'October 2026',
      defaultSharedReportSelection,
      '2026-10-10T10:00:00Z',
    );
    month.budget_transactions[0].amount_minor = 9999;
    expect(snapshot.months[0].categories?.[0].actualMinor).toBe(2500);
  });
});
