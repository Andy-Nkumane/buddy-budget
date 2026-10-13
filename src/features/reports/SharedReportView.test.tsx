import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SharedReportView } from './SharedReportView';
import type { SharedReportSnapshot } from './sharedReport';

const snapshot: SharedReportSnapshot = {
  version: 1,
  title: 'Shared Buddy Budget report',
  rangeLabel: 'October 2026',
  snapshotAt: '2026-10-10T10:00:00Z',
  locale: 'en-ZA',
  selection: {
    totals: true,
    categories: true,
    transactions: false,
    transactionNames: false,
    notes: false,
    goals: false,
  },
  omitted: ['transaction details', 'notes', 'goal data'],
  months: [
    {
      monthStart: '2026-10-01',
      currencyCode: 'ZAR',
      totals: {
        plannedIncomeMinor: 100000,
        plannedExpenseMinor: 50000,
        actualIncomeMinor: 100000,
        actualExpenseMinor: 45000,
        remainingMinor: 55000,
      },
      categories: [{ name: 'Food', itemType: 'expense', plannedMinor: 50000, actualMinor: 45000 }],
    },
  ],
};

describe('SharedReportView', () => {
  it('labels the frozen snapshot and omitted information without transaction UI', () => {
    render(<SharedReportView snapshot={snapshot} />);
    expect(screen.getByRole('heading', { name: 'Shared Buddy Budget report' })).toBeInTheDocument();
    expect(screen.getByText(/Later budget changes are not included/)).toBeInTheDocument();
    expect(screen.getByText(/Omitted: transaction details, notes, goal data/)).toBeInTheDocument();
    expect(screen.queryByText('Approved transaction details')).not.toBeInTheDocument();
  });
});
