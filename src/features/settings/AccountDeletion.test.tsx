import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';

const account = vi.hoisted(() => ({
  reauthenticateWithPassword: vi.fn(),
  requestAccountDeletion: vi.fn(),
  signOut: vi.fn(),
  retrieveTotpFactors: vi.fn(),
  verifyTotpFactor: vi.fn(),
}));

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'owner-id' } },
    signOut: account.signOut,
  }),
}));
vi.mock('../../app/providers/HouseholdProvider', () => ({
  useHousehold: () => ({
    role: 'owner',
    context: {
      active_household_id: 'household-id',
      households: [{ id: 'household-id', name: 'Owner home', role: 'owner' }],
    },
  }),
}));
vi.mock('../../data/repositories/budgetRepository', () => ({
  reauthenticateWithPassword: account.reauthenticateWithPassword,
  requestAccountDeletion: account.requestAccountDeletion,
  retrievePreferences: vi.fn().mockResolvedValue({
    user_id: 'owner-id',
    last_budget_month_id: null,
    last_route: null,
    theme: 'system',
    onboarding_completed_at: '2026-10-18T00:00:00.000Z',
    updated_at: '2026-10-18T00:00:00.000Z',
  }),
  retrieveProfile: vi.fn().mockResolvedValue({
    user_id: 'owner-id',
    active_household_id: 'household-id',
    display_name: 'Owner',
    currency_code: 'ZAR',
    locale: 'en-ZA',
    timezone: 'Africa/Johannesburg',
    created_at: '2026-10-18T00:00:00.000Z',
    updated_at: '2026-10-18T00:00:00.000Z',
  }),
  updateProfileAndPreferences: vi.fn(),
}));
vi.mock('../auth/mfa', () => ({
  retrieveTotpFactors: account.retrieveTotpFactors,
  verifyTotpFactor: account.verifyTotpFactor,
  retrieveMfaAssurance: vi.fn().mockResolvedValue({ currentLevel: 'aal1', nextLevel: 'aal1' }),
  createTotpEnrollment: vi.fn(),
  deleteTotpFactor: vi.fn(),
}));

const renderDeletion = async () => {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <SettingsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
  fireEvent.change(await screen.findByLabelText('Type DELETE to confirm'), {
    target: { value: 'DELETE' },
  });
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'correct horse battery staple' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));
};

describe('COMP-007 account deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.reauthenticateWithPassword.mockResolvedValue(undefined);
    account.requestAccountDeletion.mockResolvedValue(undefined);
    account.signOut.mockResolvedValue(undefined);
    account.retrieveTotpFactors.mockResolvedValue([]);
    account.verifyTotpFactor.mockResolvedValue(undefined);
  });

  it('does not request deletion when recent password verification fails', async () => {
    account.reauthenticateWithPassword.mockRejectedValue(new Error('Invalid login credentials'));

    await renderDeletion();

    expect(await screen.findByRole('alert')).toHaveTextContent(/password could not be verified/i);
    expect(account.requestAccountDeletion).not.toHaveBeenCalled();
  });

  it('does not clear the session or report success when server deletion fails', async () => {
    account.requestAccountDeletion.mockRejectedValue(new Error('Transfer household ownership'));

    await renderDeletion();

    expect(await screen.findByRole('alert')).toHaveTextContent('Transfer household ownership');
    expect(account.signOut).not.toHaveBeenCalled();
  });

  it('does not describe successful deletion as a deletion failure when local cleanup fails', async () => {
    account.signOut.mockRejectedValue(new Error('Local storage unavailable'));

    await renderDeletion();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /account was deleted, but this browser could not clear its local session/i,
    );
    expect(screen.getByRole('button', { name: 'Account deleted' })).toBeDisabled();
    await waitFor(() => expect(account.requestAccountDeletion).toHaveBeenCalledOnce());
  });

  it('verifies an enrolled authenticator after password reauthentication', async () => {
    account.retrieveTotpFactors.mockResolvedValue([
      {
        id: 'factor-id',
        factor_type: 'totp',
        status: 'verified',
        created_at: '2026-10-24T00:00:00.000Z',
        updated_at: '2026-10-24T00:00:00.000Z',
      },
    ]);

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <SettingsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    fireEvent.change(await screen.findByLabelText('Type DELETE to confirm'), {
      target: { value: 'DELETE' },
    });
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'correct horse battery staple' },
    });
    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Permanently delete my account' }));

    await waitFor(() =>
      expect(account.verifyTotpFactor).toHaveBeenCalledWith('factor-id', '123456'),
    );
    expect(account.reauthenticateWithPassword).toHaveBeenCalledBefore(account.verifyTotpFactor);
    await waitFor(() => expect(account.requestAccountDeletion).toHaveBeenCalledOnce());
  });
});
