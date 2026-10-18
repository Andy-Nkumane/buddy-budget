import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '../../shared/types/domain';
import { ExportDataForm } from './ExportDataForm';

const repository = vi.hoisted(() => ({
  exportAllData: vi.fn(),
  retrieveBudgetInsights: vi.fn(),
  retrieveMonthsForExport: vi.fn(),
}));
const downloads = vi.hoisted(() => ({
  downloadBudgetReportPdf: vi.fn(),
  downloadJson: vi.fn(),
  downloadMonthsCsv: vi.fn(),
}));

vi.mock('../../data/repositories/budgetRepository', () => repository);
vi.mock('../../shared/utilities/download', () => downloads);
vi.mock('../../shared/milestones/milestones', () => ({
  claimAndAnnounceMilestone: vi.fn().mockResolvedValue(undefined),
}));

const profile: Profile = {
  user_id: 'user-id',
  display_name: 'Tester',
  currency_code: 'ZAR',
  locale: 'en-ZA',
  timezone: 'Africa/Johannesburg',
  created_at: '2026-10-17T00:00:00.000Z',
  updated_at: '2026-10-17T00:00:00.000Z',
};

describe('COMP-006 ExportDataForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.exportAllData.mockResolvedValue({ schema_version: 11 });
  });

  it('explains JSON coverage and creates the requested portable export', async () => {
    const onComplete = vi.fn();
    render(<ExportDataForm profile={profile} onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'json' } });

    expect(screen.getByText(/not a complete legal access response/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    await waitFor(() => expect(repository.exportAllData).toHaveBeenCalledWith({}));
    expect(downloads.downloadJson).toHaveBeenCalledWith(
      'buddybudget-all-months.json',
      expect.objectContaining({ schema_version: 11 }),
    );
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
