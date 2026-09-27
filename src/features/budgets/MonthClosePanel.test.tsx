import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BudgetMonthWithItems } from '../../shared/types/domain';
import { MonthClosePanel } from './MonthClosePanel';

vi.mock('../../data/repositories/budgetRepository', () => ({
  closeBudgetMonth: vi.fn(),
  createMonthAdjustment: vi.fn(),
  reopenBudgetMonth: vi.fn(),
}));

const month = {
  id: 'month',
  user_id: 'user',
  source_template_id: null,
  month_start: '2026-09-01',
  currency_code: 'ZAR',
  status: 'active',
  notes: null,
  last_opened_at: '',
  created_at: '',
  updated_at: '',
  budget_month_items: [],
  budget_transactions: [],
  payment_schedule_occurrences: [],
  goal_month_recommendations: [],
  goal_contributions: [],
  lifecycle: null,
  close_summaries: [],
  adjustments: [],
  lifecycle_events: [],
} satisfies BudgetMonthWithItems;

describe('MonthClosePanel', () => {
  it('requires checklist confirmation before closing', () => {
    render(
      <MonthClosePanel
        month={month}
        ageLocked={false}
        currentMonthId={month.id}
        locale="en-ZA"
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close month' }));
    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('Uncategorised transactions')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'Close month' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed these results/ }));
    expect(within(dialog).getByRole('button', { name: 'Close month' })).toBeEnabled();
  });
});
