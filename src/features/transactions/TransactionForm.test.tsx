import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { retrieveMonthByStart } from '../../data/repositories/budgetRepository';
import type { MonthSummary } from '../../shared/types/domain';
import { TransactionForm } from './TransactionForm';

vi.mock('../../data/repositories/budgetRepository', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../data/repositories/budgetRepository')>();
  return { ...original, retrieveMonthByStart: vi.fn() };
});

const month: MonthSummary = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'user-id',
  source_template_id: null,
  month_start: '2026-09-01',
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
  actualExpenses: 0,
  actualRemaining: 0,
};

describe('TransactionForm', () => {
  it('submits a keyboard-friendly posted expense in integer minor units', async () => {
    vi.mocked(retrieveMonthByStart).mockResolvedValue({
      ...month,
      budget_month_items: [],
      budget_transactions: [],
    });
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <TransactionForm
          accounts={[]}
          categories={[]}
          initialMonthId={month.id}
          months={[month]}
          onSubmit={onSubmit}
          timeZone="Africa/Johannesburg"
          userId="user-id"
        />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '12.34' } });
    fireEvent.change(screen.getByLabelText('Description or merchant'), {
      target: { value: 'Lunch' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add transaction' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMinor: 1234,
          budgetMonthId: month.id,
          description: 'Lunch',
          status: 'posted',
          transactionType: 'expense',
        }),
      ),
    );
  });
});
