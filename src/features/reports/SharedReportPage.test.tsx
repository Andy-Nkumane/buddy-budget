import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { retrievePublicSharedReport } from '../../data/repositories/budgetRepository';
import { SharedReportPage } from './SharedReportPage';

vi.mock('../../data/repositories/budgetRepository', () => ({
  retrievePublicSharedReport: vi.fn(),
}));

const snapshot = {
  version: 1 as const,
  title: 'Shared Buddy Budget report',
  rangeLabel: 'October 2026',
  snapshotAt: '2026-10-10T10:00:00Z',
  locale: 'en-ZA',
  selection: {
    totals: true,
    categories: false,
    transactions: false,
    transactionNames: false,
    notes: false,
    goals: false,
  },
  omitted: [],
  months: [],
};

describe('SharedReportPage', () => {
  it('opens a passwordless report without showing an access-code form', async () => {
    window.location.hash = 'a'.repeat(43);
    vi.mocked(retrievePublicSharedReport).mockResolvedValue({
      snapshot,
      expires_at: '2026-10-17T10:00:00Z',
      remaining_views: null,
    });

    render(<SharedReportPage />);

    expect(await screen.findByRole('heading', { name: snapshot.title })).toBeInTheDocument();
    expect(screen.queryByLabelText('Access code')).not.toBeInTheDocument();
  });

  it('asks for a code only when the server confirms one is required', async () => {
    window.location.hash = 'b'.repeat(43);
    vi.mocked(retrievePublicSharedReport).mockResolvedValue({ accessCodeRequired: true });

    render(<SharedReportPage />);

    await waitFor(() => expect(screen.getByLabelText('Access code')).toBeInTheDocument());
  });
});
