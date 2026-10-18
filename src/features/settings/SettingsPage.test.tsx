import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'viewer-id' } },
    signOut: vi.fn(),
  }),
}));
vi.mock('../../app/providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    role: 'viewer',
    context: {
      active_household_id: 'household-id',
      households: [{ id: 'household-id', name: 'Shared home', role: 'viewer' }],
    },
  }),
}));
vi.mock('../../data/repositories/budgetRepository', () => ({
  requestAccountDeletion: vi.fn(),
  retrievePreferences: vi.fn().mockResolvedValue({
    user_id: 'viewer-id',
    last_budget_month_id: null,
    last_route: null,
    theme: 'system',
    onboarding_completed_at: '2026-10-17T00:00:00.000Z',
    updated_at: '2026-10-17T00:00:00.000Z',
  }),
  retrieveProfile: vi.fn().mockResolvedValue({
    user_id: 'viewer-id',
    active_household_id: 'household-id',
    display_name: 'Viewer',
    currency_code: 'ZAR',
    locale: 'en-ZA',
    timezone: 'Africa/Johannesburg',
    created_at: '2026-10-17T00:00:00.000Z',
    updated_at: '2026-10-17T00:00:00.000Z',
  }),
  updateProfileAndPreferences: vi.fn(),
}));

describe('SettingsPage', () => {
  it('lets a viewer export readable household data without exposing mutation controls', async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <SettingsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Create export' })).toBeEnabled();
    expect(screen.getByText(/financial records visible in Shared home/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: /Manage rules/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore backup' })).not.toBeInTheDocument();
  });
});
