import { describe, expect, it } from 'vitest';
import type { BudgetTransaction, PaymentScheduleOccurrence } from '../../shared/types/domain';
import {
  calculateCashFlowProjection,
  addMinorUnitsExact,
  currentDateInTimeZone,
  findUncertainOccurrenceMatches,
  generateOccurrenceDates,
} from './cashFlow';

const occurrence = (
  values: Partial<PaymentScheduleOccurrence> = {},
): PaymentScheduleOccurrence => ({
  id: 'occurrence',
  user_id: 'user',
  schedule_id: 'schedule',
  budget_month_id: 'month',
  budget_month_item_id: null,
  category_id: null,
  due_date: '2028-02-29',
  name_snapshot: 'Rent',
  item_type: 'expense',
  amount_minor: 50000,
  amount_is_approximate: false,
  status: 'expected',
  matched_transaction_id: null,
  confirmed_at: null,
  created_at: '',
  updated_at: '',
  ...values,
});

const transaction = (values: Partial<BudgetTransaction> = {}): BudgetTransaction => ({
  id: 'transaction',
  user_id: 'user',
  budget_month_id: 'month',
  budget_month_item_id: null,
  category_id: null,
  account_id: null,
  transaction_date: '2028-02-29',
  description: 'Rent',
  amount_minor: 50000,
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
  ...values,
});

describe('schedule recurrence', () => {
  it('resolves calendar dates in the profile timezone at a UTC boundary', () => {
    const instant = new Date('2026-12-31T22:30:00Z');
    expect(currentDateInTimeZone('Africa/Johannesburg', instant)).toBe('2027-01-01');
    expect(currentDateInTimeZone('America/New_York', instant)).toBe('2026-12-31');
  });

  it('clamps monthly occurrences to leap-year and month ends', () => {
    expect(
      generateOccurrenceDates({
        startDate: '2028-01-31',
        endDate: '2028-04-30',
        recurrence: 'monthly',
      }),
    ).toEqual(['2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30']);
  });

  it('supports weekly, fortnightly, and selected weekdays without local-time conversion', () => {
    expect(
      generateOccurrenceDates({
        startDate: '2026-09-01',
        endDate: '2026-09-15',
        recurrence: 'fortnightly',
      }),
    ).toEqual(['2026-09-01', '2026-09-15']);
    expect(
      generateOccurrenceDates({
        startDate: '2026-09-01',
        endDate: '2026-09-07',
        recurrence: 'selected_days',
        selectedDays: [1, 5],
      }),
    ).toEqual(['2026-09-04', '2026-09-07']);
  });
});

describe('cash-flow projection', () => {
  it('uses integer minor units and excludes matched forecasts', () => {
    const result = calculateCashFlowProjection({
      fromDate: '2028-02-28',
      toDate: '2028-02-29',
      openingBalanceMinor: 100000,
      transactions: [transaction()],
      occurrences: [occurrence({ matched_transaction_id: 'transaction', status: 'paid' })],
    });
    expect(result.days.at(-1)?.balanceMinor).toBe(50000);
    expect(result.lowestBalanceMinor).toBe(50000);
  });

  it('keeps forecasts distinct and detects candidates without auto-confirming', () => {
    const result = calculateCashFlowProjection({
      fromDate: '2028-02-29',
      toDate: '2028-02-29',
      openingBalanceMinor: 40000,
      transactions: [],
      occurrences: [occurrence()],
    });
    expect(result.days[0]).toMatchObject({
      postedMinor: 0,
      forecastMinor: -50000,
      balanceMinor: -10000,
    });
    expect(findUncertainOccurrenceMatches(occurrence(), [transaction()])).toHaveLength(1);
  });

  it('treats overdue expectations as due today and rejects unsafe totals', () => {
    const result = calculateCashFlowProjection({
      fromDate: '2028-03-01',
      toDate: '2028-03-01',
      openingBalanceMinor: 60000,
      transactions: [],
      occurrences: [occurrence({ due_date: '2028-02-20' })],
    });
    expect(result.days[0].balanceMinor).toBe(10000);
    expect(() => addMinorUnitsExact(Number.MAX_SAFE_INTEGER, 1)).toThrow('too large');
  });
});
