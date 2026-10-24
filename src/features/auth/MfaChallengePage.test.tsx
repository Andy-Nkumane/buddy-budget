import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MfaChallengePage } from './MfaChallengePage';
import { retrieveMfaAssurance, retrieveTotpFactors, verifyTotpFactor } from './mfa';
import { useAuth } from '../../app/providers/AuthProvider';

vi.mock('./mfa', () => ({
  retrieveMfaAssurance: vi.fn(),
  retrieveTotpFactors: vi.fn(),
  verifyTotpFactor: vi.fn(),
}));
vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));

const signOut = vi.fn();

const factor = {
  id: 'factor-id',
  factor_type: 'totp' as const,
  status: 'verified' as const,
  friendly_name: 'Budget authenticator',
  created_at: '2026-10-24T00:00:00.000Z',
  updated_at: '2026-10-24T00:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/auth/mfa', state: { from: '/app/settings' } }]}>
      <Routes>
        <Route path="/auth/mfa" element={<MfaChallengePage />} />
        <Route path="/app/settings" element={<p>Account settings</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('AUTH-002 MfaChallengePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(retrieveMfaAssurance).mockResolvedValue({
      currentLevel: 'aal1',
      nextLevel: 'aal2',
    });
    vi.mocked(retrieveTotpFactors).mockResolvedValue([factor]);
    vi.mocked(verifyTotpFactor).mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue({
      session: {} as never,
      loading: false,
      sessionMessage: null,
      signOut,
    });
    signOut.mockResolvedValue(undefined);
  });

  it('validates the code and keeps provider failures generic', async () => {
    vi.mocked(verifyTotpFactor).mockRejectedValue(
      new Error('That verification code could not be confirmed. Check it and try again.'),
    );
    renderPage();

    const input = await screen.findByLabelText('Six-digit code');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/six-digit code/i);

    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be confirmed/i);
    expect(input).toHaveValue('');
  });

  it('returns to the requested app route after successful verification', async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText('Six-digit code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));

    await waitFor(() => expect(screen.getByText('Account settings')).toBeVisible());
    expect(verifyTotpFactor).toHaveBeenCalledWith('factor-id', '123456');
  });

  it('lets a user safely leave a session when the authenticator is unavailable', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'local' }));
  });
});
