import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BudgetTransaction, MonthSummary } from '../../shared/types/domain';
import { TransactionRow } from './TransactionRow';

const month = (month_start: string): MonthSummary => ({
  id: 'month-id',
  user_id: 'user-id',
  source_template_id: null,
  month_start,
  currency_code: 'ZAR',
  status: 'active',
  notes: null,
  last_opened_at: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  income: 0,
  expenses: 0,
  remaining: 0,
  actualIncome: 0,
  actualExpenses: 25,
  actualRemaining: -25,
});

const transaction: BudgetTransaction = {
  id: 'transaction-id',
  user_id: 'user-id',
  budget_month_id: 'month-id',
  budget_month_item_id: null,
  category_id: null,
  account_id: null,
  transaction_date: '2026-09-02',
  description: 'Groceries',
  amount_minor: 2500,
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
  created_at: '2026-09-02T00:00:00Z',
  updated_at: '2026-09-02T00:00:00Z',
};

describe('TransactionRow', () => {
  it('offers edit and delete actions for an editable month', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <TransactionRow
        currentMonth="2026-09-01"
        locale="en-ZA"
        month={month('2026-09-01')}
        onDelete={onDelete}
        onEdit={onEdit}
        profileCurrency="ZAR"
        transaction={transaction}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Groceries' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Groceries' }));
    expect(onEdit).toHaveBeenCalledWith(transaction);
    expect(onDelete).toHaveBeenCalledWith(transaction);
  });

  it('shows locked transactions without mutation actions', () => {
    render(
      <TransactionRow
        currentMonth="2026-09-01"
        locale="en-ZA"
        month={month('2026-07-01')}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        profileCurrency="ZAR"
        transaction={{ ...transaction, transaction_date: '2026-07-02' }}
      />,
    );
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Groceries' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Groceries' })).not.toBeInTheDocument();
  });
});
