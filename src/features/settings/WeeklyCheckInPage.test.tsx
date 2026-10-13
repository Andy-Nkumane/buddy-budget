import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyCheckInPage } from './WeeklyCheckInPage';

const repository = vi.hoisted(() => ({
  retrieveProfile: vi.fn(),
  retrieveWeeklyCheckInPreferences: vi.fn(),
  searchNotificationDeliveries: vi.fn(),
  updateWeeklyCheckInPreferences: vi.fn(),
  previewWeeklyCheckIn: vi.fn(),
  sendTestWeeklyCheckIn: vi.fn(),
}));

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-id' } } }),
}));
vi.mock('../../data/repositories/budgetRepository', () => repository);

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WeeklyCheckInPage />
    </QueryClientProvider>,
  );
};

describe('WeeklyCheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.retrieveProfile.mockResolvedValue({ timezone: 'Africa/Johannesburg' });
    repository.retrieveWeeklyCheckInPreferences.mockResolvedValue(null);
    repository.searchNotificationDeliveries.mockResolvedValue([]);
  });

  it('defaults to opted out and prevents test sends', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Weekly budget check-in' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /Enable weekly check-ins/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Send in-app test' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send email test' })).toBeDisabled();
  });

  it('saves an explicit opt-in and previews the deterministic action', async () => {
    repository.updateWeeklyCheckInPreferences.mockResolvedValue({});
    repository.previewWeeklyCheckIn.mockResolvedValue({
      recommendation: {
        title: 'Categorise recent activity',
        body: '2 transactions need attention.',
        actionPath: '/app/transactions',
      },
      exceededItems: [],
      approachingItems: [],
      uncategorisedCount: 2,
      upcomingObligations: [],
      goals: [],
      position: {},
    });
    renderPage();
    fireEvent.click(await screen.findByRole('checkbox', { name: /Enable weekly check-ins/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() =>
      expect(repository.updateWeeklyCheckInPreferences).toHaveBeenCalledWith(
        expect.objectContaining({ optedIn: true, inAppEnabled: true }),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(
      await screen.findByRole('heading', { name: 'Categorise recent activity' }),
    ).toBeVisible();
  });

  it('shows test-send failures without claiming success', async () => {
    repository.retrieveWeeklyCheckInPreferences.mockResolvedValue({
      opted_in: true,
      weekday: 1,
      delivery_time: '18:00:00',
      timezone: 'Africa/Johannesburg',
      in_app_enabled: true,
      email_enabled: false,
      email_detail_enabled: false,
      paused: false,
    });
    repository.sendTestWeeklyCheckIn.mockRejectedValue(new Error('Provider unavailable'));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Send in-app test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider unavailable');
  });
});
