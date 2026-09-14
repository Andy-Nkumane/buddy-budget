import { describe, expect, it } from 'vitest';
import type { BudgetMonthItem, BudgetTransaction } from '../types/domain';
import {
  calculateActualTotals,
  calculateBudgetProgress,
  calculateItemProgress,
  calculateTotals,
  currentMonthStart,
  formatMoney,
  isMonthReadOnly,
} from './money';

const item = (item_type: 'income' | 'expense', amount: string): BudgetMonthItem => ({
  id: crypto.randomUUID(),
  budget_month_id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  source_template_item_id: null,
  category_id: null,
  item_type,
  name_snapshot: 'Item',
  category_snapshot: null,
  default_amount_snapshot: amount,
  amount,
  is_disabled: false,
  sort_order: 0,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const transaction = (
  transaction_type: 'income' | 'expense',
  amount_minor: number,
  overrides: Partial<BudgetTransaction> = {},
): BudgetTransaction => ({
  id: crypto.randomUUID(),
  user_id: 'user-id',
  budget_month_id: 'month-id',
  budget_month_item_id: null,
  category_id: null,
  account_id: null,
  transaction_date: '2026-01-01',
  description: 'Entry',
  amount_minor,
  transaction_type,
  is_refund: false,
  notes: null,
  source: 'manual',
  status: 'posted',
  external_fingerprint: null,
  external_reference: null,
  import_batch_id: null,
  category_snapshot: null,
  budget_item_snapshot: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('money calculations', () => {
  it('formats ZAR with the requested locale', () => {
    expect(formatMoney(1234.5, 'ZAR', 'en-ZA')).toContain('1 234,50');
  });

  it('derives income, expenses, remaining, and savings rate', () => {
    expect(calculateTotals([item('income', '1000.00'), item('expense', '250.50')])).toEqual({
      income: 1000,
      expenses: 250.5,
      remaining: 749.5,
      savingsRate: 74.95,
    });
  });

  it('returns no savings rate when income is zero', () => {
    expect(calculateTotals([item('expense', '50.00')]).savingsRate).toBeNull();
  });

  it('represents a negative remaining balance', () => {
    expect(calculateTotals([item('income', '10'), item('expense', '40')]).remaining).toBe(-30);
  });

  it('ignores archived items', () => {
    const archived = { ...item('expense', '100'), archived_at: '2026-01-02T00:00:00Z' };
    expect(calculateTotals([archived]).expenses).toBe(0);
  });

  it('ignores temporarily disabled items', () => {
    const disabled = { ...item('expense', '100'), is_disabled: true };
    expect(calculateTotals([disabled]).expenses).toBe(0);
  });

  it('adds decimal amounts without floating-point drift', () => {
    const amounts = Array.from({ length: 10 }, () => item('income', '0.10'));
    expect(calculateTotals(amounts).income).toBe(1);
  });
});

describe('planned and actual calculations', () => {
  it('counts posted activity exactly and ignores pending or void entries', () => {
    expect(
      calculateActualTotals([
        transaction('income', 100_00),
        transaction('expense', 20_10),
        transaction('expense', 5_00, { status: 'pending' }),
        transaction('income', 1_00, { status: 'void' }),
      ]),
    ).toEqual({ income: 100, expenses: 20.1, remaining: 79.9 });
  });

  it('uses non-negative refund records to reverse expense or income actuals', () => {
    expect(
      calculateActualTotals([
        transaction('expense', 50_00),
        transaction('expense', 10_00, { is_refund: true }),
        transaction('income', 100_00),
        transaction('income', 5_00, { is_refund: true }),
      ]),
    ).toEqual({ income: 95, expenses: 40, remaining: 55 });
  });

  it('keeps actual activity linked to a paused item while removing its plan', () => {
    const paused = { ...item('expense', '100.00'), id: 'paused', is_disabled: true };
    const entry = transaction('expense', 25_00, { budget_month_item_id: paused.id });
    expect(calculateItemProgress(paused, [entry])).toEqual({
      planned: 0,
      actual: 25,
      variance: 25,
      remaining: -25,
    });
    expect(calculateBudgetProgress([paused], [entry]).actual.expenses).toBe(25);
  });

  it('handles zero plans and overspending without floating-point drift', () => {
    const progress = calculateBudgetProgress(
      [item('income', '0.00'), item('expense', '10.00')],
      [transaction('expense', 10_01)],
    );
    expect(progress.expenseVariance).toBe(0.01);
    expect(progress.expenseRemaining).toBe(-0.01);
    expect(progress.available).toBe(-10.01);
  });
});

describe('historical month access', () => {
  it('uses the configured timezone at a calendar-month boundary', () => {
    const boundary = new Date('2026-08-31T13:00:00Z');
    expect(currentMonthStart('Pacific/Auckland', boundary)).toBe('2026-09-01');
    expect(currentMonthStart('America/Los_Angeles', boundary)).toBe('2026-08-01');
  });

  it('falls back to UTC for an invalid legacy timezone', () => {
    expect(currentMonthStart('Invalid/Timezone', new Date('2026-09-01T00:30:00Z'))).toBe(
      '2026-09-01',
    );
  });

  it('keeps the current and previous calendar months editable', () => {
    expect(isMonthReadOnly('2026-09-01', '2026-09-01')).toBe(false);
    expect(isMonthReadOnly('2026-08-01', '2026-09-01')).toBe(false);
  });

  it('locks months that are at least two calendar months old across year boundaries', () => {
    expect(isMonthReadOnly('2026-07-01', '2026-09-01')).toBe(true);
    expect(isMonthReadOnly('2025-11-01', '2026-01-01')).toBe(true);
    expect(isMonthReadOnly('2025-12-01', '2026-01-01')).toBe(false);
    expect(isMonthReadOnly('2026-10-01', '2026-09-01')).toBe(false);
  });
});
