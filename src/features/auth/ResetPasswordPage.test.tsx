import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSupabase } from '../../data/supabase/client';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();
let authChangeHandler: ((event: string) => void) | null = null;
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn((handler: (event: string) => void) => {
  authChangeHandler = handler;
  return { data: { subscription: { unsubscribe } } };
});

const renderReset = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('AUTH-007 ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeHandler = null;
    vi.mocked(requireSupabase).mockReturnValue({
      auth: { exchangeCodeForSession, getSession, onAuthStateChange },
    } as never);
  });

  it('does not allow an ordinary existing session to replace a recovery link', async () => {
    renderReset('/auth/reset-password');

    expect(await screen.findByRole('alert')).toHaveTextContent(/reset link is missing or invalid/i);
    expect(getSession).not.toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Update password' })).not.toBeInTheDocument();
  });

  it('does not expose provider details when a recovery code is rejected', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { redirectType: null },
      error: { message: 'PKCE verifier not found in storage' },
    });

    renderReset('/auth/reset-password?code=invalid-code');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be completed/i);
    expect(screen.queryByText(/PKCE verifier/i)).not.toBeInTheDocument();
  });

  it('rejects a valid code that was not issued for password recovery', async () => {
    exchangeCodeForSession.mockImplementation(() => {
      authChangeHandler?.('SIGNED_IN');
      return Promise.resolve({ data: {}, error: null });
    });

    renderReset('/auth/reset-password?code=signup-code');

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be completed/i);
    expect(screen.queryByRole('button', { name: 'Update password' })).not.toBeInTheDocument();
  });

  it('shows the form only after the provider identifies a password-recovery exchange', async () => {
    exchangeCodeForSession.mockImplementation(() => {
      authChangeHandler?.('PASSWORD_RECOVERY');
      return Promise.resolve({ data: {}, error: null });
    });

    renderReset('/auth/reset-password?code=recovery-code');

    expect(await screen.findByRole('button', { name: 'Update password' })).toBeVisible();
  });
});
