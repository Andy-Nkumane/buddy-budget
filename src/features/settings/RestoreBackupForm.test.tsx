import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reauthenticateForRestore, restoreBackup } from '../../data/repositories/budgetRepository';
import { RestoreBackupForm } from './RestoreBackupForm';

vi.mock('../../data/repositories/budgetRepository', () => ({
  reauthenticateForRestore: vi.fn(),
  restoreBackup: vi.fn(),
}));

const validBackup = {
  schema_version: 11,
  exported_at: '2026-10-02T00:00:00.000Z',
  range: { from_month: null, to_month: null },
  profile: { currency_code: 'ZAR' },
  preferences: {},
  categories: [],
  financial_accounts: [],
  transaction_import_batches: [],
  transaction_categorisation_rules: [],
  categorisation_suggestion_dismissals: [],
  payment_schedules: [],
  payment_schedule_occurrences: [],
  financial_goals: [],
  goal_contributions: [],
  goal_month_recommendations: [],
  budget_month_lifecycle: [],
  month_close_summaries: [],
  month_adjustments: [],
  month_lifecycle_events: [],
  templates: [],
  budget_months: [],
};

describe('RestoreBackupForm', () => {
  it('validates locally and requires stronger replacement confirmation', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RestoreBackupForm onComplete={vi.fn()} />
      </QueryClientProvider>,
    );
    const file = new File([JSON.stringify(validBackup)], 'backup.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('Buddy Budget JSON backup'), {
      target: { files: [file] },
    });
    expect(await screen.findByRole('heading', { name: 'Validated backup' })).toBeVisible();
    fireEvent.click(screen.getByLabelText(/Replace all my data/));
    expect(screen.getByRole('button', { name: 'Replace with validated backup' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'password' } });
    fireEvent.change(screen.getByLabelText('Type REPLACE MY DATA to confirm'), {
      target: { value: 'REPLACE MY DATA' },
    });
    expect(screen.getByRole('button', { name: 'Replace with validated backup' })).toBeEnabled();
  });

  it('shows a replacement error beside the submit button', async () => {
    vi.mocked(reauthenticateForRestore).mockRejectedValueOnce(new Error('Incorrect password'));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RestoreBackupForm onComplete={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText('Buddy Budget JSON backup'), {
      target: {
        files: [
          new File([JSON.stringify(validBackup)], 'backup.json', { type: 'application/json' }),
        ],
      },
    });
    expect(await screen.findByRole('heading', { name: 'Validated backup' })).toBeVisible();
    fireEvent.click(screen.getByLabelText(/Replace all my data/));
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('Type REPLACE MY DATA to confirm'), {
      target: { value: 'REPLACE MY DATA' },
    });
    const submitButton = screen.getByRole('button', { name: 'Replace with validated backup' });
    fireEvent.click(submitButton);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Incorrect password');
    expect(alert.parentElement).toContainElement(submitButton);
    expect(restoreBackup).not.toHaveBeenCalled();
  });
});
