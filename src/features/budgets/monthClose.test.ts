import { describe, expect, it } from 'vitest';
import type { BudgetMonthWithItems, MonthAdjustment } from '../../shared/types/domain';
import { calculateAdjustedActuals } from '../../shared/reporting/budgetReport';
import { buildMonthCloseChecklist } from './monthClose';

const month = {
  id: 'month',
  user_id: 'user',
  source_template_id: null,
  month_start: '2026-07-01',
  currency_code: 'ZAR',
  status: 'active',
  notes: null,
  last_opened_at: '',
  created_at: '',
  updated_at: '',
  budget_month_items: [],
  budget_transactions: [
    {
      id: 'transaction',
      user_id: 'user',
      budget_month_id: 'month',
      budget_month_item_id: null,
      category_id: null,
      account_id: null,
      transaction_date: '2026-07-01',
      description: 'Late',
      amount_minor: 10000,
      transaction_type: 'expense',
      is_refund: false,
      notes: null,
      source: 'manual',
      status: 'posted',
      external_fingerprint: null,
      external_reference: null,
      import_batch_id: null,
      category_snapshot: null,
      budget_item_snapshot: null,
      is_recurring_candidate: false,
      created_at: '',
      updated_at: '',
    },
  ],
} satisfies BudgetMonthWithItems;

const adjustment = (values: Partial<MonthAdjustment>): MonthAdjustment => ({
  id: crypto.randomUUID(),
  user_id: 'user',
  original_budget_month_id: 'month',
  applied_budget_month_id: 'current',
  item_type: 'expense',
  direction: 'increase',
  amount_minor: 500,
  reason: 'Late fee',
  idempotency_key: crypto.randomUUID(),
  created_at: '',
  ...values,
});

describe('month close calculations', () => {
  it('identifies checklist exceptions', () => {
    expect(buildMonthCloseChecklist(month)).toMatchObject({ uncategorisedCount: 1 });
  });

  it('keeps originals separate while applying signed adjustments', () => {
    const result = calculateAdjustedActuals({
      ...month,
      adjustments: [
        adjustment({ item_type: 'expense', direction: 'increase', amount_minor: 500 }),
        adjustment({ item_type: 'income', direction: 'increase', amount_minor: 1000 }),
      ],
    });
    expect(result.original.expenses).toBe(100);
    expect(result.expenses).toBe(105);
    expect(result.income).toBe(10);
    expect(result.remaining).toBe(-95);
  });
});
