import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdviserPage } from './AdviserPage';

const repository = vi.hoisted(() => ({
  retrieveGrants: vi.fn(),
  retrieveData: vi.fn(),
  respond: vi.fn(),
}));

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));
vi.mock('../../data/repositories/adviserRepository', () => ({
  retrieveAdviserGrants: repository.retrieveGrants,
  retrieveAdviserData: repository.retrieveData,
  respondToAdviserGrant: repository.respond,
}));

const grant = {
  id: 'grant-1',
  householdId: 'household-1',
  householdName: 'Client household',
  adviserEmail: 'adviser@example.com',
  dateFrom: '2026-01-01',
  dateTo: '2026-10-31',
  sections: ['summary', 'categories', 'transactions', 'schedules', 'goals'],
  allowExport: false,
  startsAt: '2020-10-01T00:00:00Z',
  expiresAt: '2099-10-19T00:00:00Z',
  acceptedAt: '2026-10-12T00:00:00Z',
  declinedAt: null,
  revokedAt: null,
  createdAt: '2026-10-12T00:00:00Z',
  lastAccessedAt: null,
  accessCount: 0,
  events: [],
  isOwner: false,
};

describe('AdviserPage', () => {
  it('clearly presents scoped read-only data without export permission', async () => {
    repository.retrieveGrants.mockResolvedValue([grant]);
    repository.retrieveData.mockResolvedValue({
      grantId: 'grant-1',
      householdId: 'household-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-10-31',
      sections: ['summary', 'categories', 'transactions', 'schedules', 'goals'],
      allowExport: false,
      expiresAt: '2099-10-19T00:00:00Z',
      currencyCode: 'ZAR',
      summary: [
        {
          monthStart: '2026-10-01',
          currencyCode: 'ZAR',
          plannedIncomeMinor: 3_000_000,
          actualIncomeMinor: 2_400_000,
          plannedExpensesMinor: 1_350_000,
          actualExpensesMinor: 0,
        },
      ],
      categories: [{ name: 'Transport', type: 'expense', actualMinor: 125_000 }],
      transactions: [
        {
          date: '2026-10-12',
          description: 'Train pass',
          type: 'expense',
          category: 'Transport',
          status: 'posted',
          amountMinor: 125_000,
        },
      ],
      schedules: [
        {
          name: 'Salary',
          type: 'income',
          recurrence: 'monthly',
          nextOccurrence: '2026-10-25',
          approximate: false,
          amountMinor: 3_000_000,
        },
      ],
      goals: [
        {
          name: 'Car',
          type: 'sinking_fund',
          status: 'active',
          targetDate: '2028-12-12',
          targetAmountMinor: 40_000_000,
          currentBalanceMinor: 0,
        },
      ],
    });
    render(
      <MemoryRouter initialEntries={['/app/adviser']}>
        <AdviserPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Buddy Budget adviser mode')).toBeVisible();
    expect(screen.getByText(/cannot edit, add, delete, reshare, or export/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'View report' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.queryByText('View audit history')).not.toBeInTheDocument();
    expect(screen.queryByText('October 2026')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View report' }));
    expect(await screen.findByText('October 2026')).toBeVisible();
    expect(screen.queryByText('Your adviser grants')).not.toBeInTheDocument();
    expect(screen.getAllByText(/30.000,00|30,000.00/).length).toBeGreaterThan(0);
    expect(screen.getByText('Train pass')).toBeVisible();
    expect(screen.getByText('Fixed')).toBeVisible();
    expect(screen.getByText('Sinking fund')).toBeVisible();
    expect(screen.getByText('12 Dec 2028')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Download approved JSON' }),
    ).not.toBeInTheDocument();
  });
});
