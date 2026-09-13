import { describe, expect, it } from 'vitest';
import type { BudgetMonthItem } from '../types/domain';
import { calculateTotals, currentMonthStart, formatMoney, isMonthReadOnly } from './money';

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
