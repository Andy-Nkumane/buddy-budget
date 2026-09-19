import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { BudgetMonth } from '../../../shared/types/domain';
import { CsvImportFlow } from './CsvImportFlow';

Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: {
      digest: (_algorithm: string, data: ArrayBuffer) => {
        const source = new Uint8Array(data);
        return Promise.resolve(
          Uint8Array.from({ length: 32 }, (_, index) => source[index % source.length] ?? index)
            .buffer,
        );
      },
    },
  },
  configurable: true,
});

const { searchExistingTransactionFingerprints, importBudgetTransactions } = vi.hoisted(() => ({
  searchExistingTransactionFingerprints: vi.fn(() => Promise.resolve(new Set<string>())),
  importBudgetTransactions: vi.fn(() =>
    Promise.resolve({
      batch_id: 'batch-id',
      accepted_count: 1,
      duplicate_count: 0,
      invalid_count: 0,
      excluded_count: 0,
      was_existing: false,
    }),
  ),
}));

vi.mock('../../../data/repositories/budgetRepository', () => ({
  searchExistingTransactionFingerprints,
  importBudgetTransactions,
  searchCategorisationRules: vi.fn(() => Promise.resolve([])),
  retrieveMonthById: vi.fn(() =>
    Promise.resolve({ ...month, budget_month_items: [], budget_transactions: [] }),
  ),
}));

const renderFlow = (onComplete = vi.fn(() => Promise.resolve())) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CsvImportFlow
        userId="user-id"
        months={[month]}
        accounts={[]}
        onComplete={onComplete}
        onCancel={vi.fn()}
      />
    </QueryClientProvider>,
  );
  return onComplete;
};

const month: BudgetMonth = {
  id: 'month-id',
  user_id: 'user-id',
  source_template_id: null,
  month_start: '2026-09-01',
  currency_code: 'ZAR',
  status: 'active',
  notes: null,
  last_opened_at: '2026-09-01T00:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('CsvImportFlow', () => {
  it('maps, previews, and explicitly confirms valid local rows', async () => {
    const onComplete = vi.fn(() => Promise.resolve());
    renderFlow(onComplete);
    expect(screen.getByText('Your statement stays on this device.')).toBeInTheDocument();
    fireEvent.change(document.getElementById('csv-statement')!, {
      target: {
        files: [new File(['Date,Description,Amount\n2026-09-02,Coffee,-25.50'], 'safe.csv')],
      },
    });
    await screen.findByRole('button', { name: 'Review transactions' });
    expect(importBudgetTransactions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review transactions' }));
    await screen.findByText('1 ready');
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    const previewTable = screen.getByRole('table');
    expect([...previewTable.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
      'Include',
      'Line',
      'Date',
      'Description',
      'Amount',
      'Status',
      'Rules',
    ]);
    expect(
      [...previewTable.querySelectorAll('tbody tr:first-child td')].map((cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(['', '2', '2026-09-02', 'Coffee', '−25.50', 'valid', 'No change']);
    expect(importBudgetTransactions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 transactions' }));
    await waitFor(() => expect(importBudgetTransactions).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith('month-id', '1 transaction imported.');
  });

  it('shows invalid rows and prevents confirmation', async () => {
    renderFlow();
    fireEvent.change(document.getElementById('csv-statement')!, {
      target: { files: [new File(['Date,Description,Amount\nnot-a-date,Coffee,-25'], 'bad.csv')] },
    });
    await screen.findByRole('button', { name: 'Review transactions' });
    fireEvent.click(screen.getByRole('button', { name: 'Review transactions' }));
    await screen.findByText('Date is invalid for the selected format.');
    expect(screen.getByRole('button', { name: 'Import 0 transactions' })).toBeDisabled();
  });
});
