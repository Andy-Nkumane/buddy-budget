import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../shared/types/domain';
import { ShareReportForm } from './ShareReportForm';

const repository = vi.hoisted(() => ({
  retrieveSharedReports: vi.fn(),
  retrieveMonthsForExport: vi.fn(),
  createSharedReport: vi.fn(),
  revokeSharedReport: vi.fn(),
}));

vi.mock('../../data/repositories/budgetRepository', () => repository);

const profile = {
  locale: 'en-ZA',
  currency_code: 'ZAR',
} as Profile;

describe('ShareReportForm', () => {
  beforeEach(() => {
    repository.retrieveSharedReports.mockResolvedValue([]);
  });

  it('starts with aggregate-only privacy defaults', () => {
    render(<ShareReportForm profile={profile} onComplete={vi.fn()} />);
    expect(screen.getByLabelText('Monthly totals')).toBeChecked();
    expect(screen.getByLabelText('Aggregated categories')).toBeChecked();
    expect(screen.getByLabelText('Transaction-level details')).not.toBeChecked();
    expect(screen.getByLabelText('Transaction names or descriptions')).toBeDisabled();
    expect(screen.getByLabelText('Notes')).not.toBeChecked();
    expect(screen.getByLabelText('Goal data')).not.toBeChecked();
  });

  it('enables names only after transaction details are explicitly selected', () => {
    render(<ShareReportForm profile={profile} onComplete={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Transaction-level details'));
    expect(screen.getByLabelText('Transaction names or descriptions')).toBeEnabled();
    expect(screen.getByLabelText('Transaction names or descriptions')).not.toBeChecked();
  });
});
