import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BudgetMonthItem } from '../../shared/types/domain';
import { updateMonthItemAmount } from '../../data/repositories/budgetRepository';
import { BudgetRow } from './BudgetRow';

vi.mock('../../data/repositories/budgetRepository', () => ({
  updateMonthItem: vi.fn().mockResolvedValue(undefined),
  updateMonthItemAmount: vi.fn().mockResolvedValue(undefined),
}));

const item: BudgetMonthItem = {
  id: 'item-id',
  budget_month_id: 'month-id',
  user_id: 'user-id',
  source_template_item_id: null,
  category_id: null,
  item_type: 'expense',
  name_snapshot: 'Groceries',
  category_snapshot: 'Food',
  default_amount_snapshot: '100.00',
  amount: '100.00',
  is_disabled: false,
  sort_order: 0,
  archived_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('BudgetRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => vi.useRealTimers());

  it('debounces amount changes and announces a successful save', async () => {
    render(
      <BudgetRow
        item={item}
        currencyCode="ZAR"
        locale="en-ZA"
        readOnly={false}
        progress={{ planned: 100, actual: 25, variance: -75, remaining: 75 }}
        onArchive={vi.fn()}
        onToggleDisabled={vi.fn()}
        onChanged={vi.fn()}
        onDraft={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Groceries planned amount'), {
      target: { value: '125.5' },
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    expect(updateMonthItemAmount).toHaveBeenCalledWith('item-id', '125.50');
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('keeps an invalid draft and reports it as unsaved', async () => {
    render(
      <BudgetRow
        item={item}
        currencyCode="ZAR"
        locale="en-ZA"
        readOnly={false}
        progress={{ planned: 100, actual: 25, variance: -75, remaining: 75 }}
        onArchive={vi.fn()}
        onToggleDisabled={vi.fn()}
        onChanged={vi.fn()}
        onDraft={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Groceries planned amount'), {
      target: { value: '12.345' },
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
      await Promise.resolve();
    });
    expect(screen.getByText('Not saved')).toBeInTheDocument();
    expect(screen.getByText(/no more than two decimals/i)).toBeInTheDocument();
  });

  it('keeps a paused amount disabled and offers to resume it', () => {
    const onToggleDisabled = vi.fn();
    render(
      <BudgetRow
        item={{ ...item, is_disabled: true }}
        currencyCode="ZAR"
        locale="en-ZA"
        readOnly={false}
        progress={{ planned: 0, actual: 25, variance: 25, remaining: -25 }}
        onArchive={vi.fn()}
        onToggleDisabled={onToggleDisabled}
        onChanged={vi.fn()}
        onDraft={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Groceries planned amount')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Groceries' }));
    expect(onToggleDisabled).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-id' }));
  });

  it('disables the amount and hides editing actions for a read-only month', () => {
    render(
      <BudgetRow
        item={item}
        currencyCode="ZAR"
        locale="en-ZA"
        readOnly
        progress={{ planned: 100, actual: 25, variance: -75, remaining: 75 }}
        onArchive={vi.fn()}
        onToggleDisabled={vi.fn()}
        onChanged={vi.fn()}
        onDraft={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Groceries planned amount')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Pause Groceries' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename Groceries' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive Groceries' })).not.toBeInTheDocument();
  });
});
