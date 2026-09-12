import { describe, expect, it } from 'vitest';
import type { BudgetMonthItem } from '../types/domain';
import { calculateTotals, formatMoney } from './money';

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
});
