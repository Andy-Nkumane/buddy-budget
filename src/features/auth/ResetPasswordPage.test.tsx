import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSupabase } from '../../data/supabase/client';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const exchangeCodeForSession = vi.fn();
const getSession = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();
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
        <Route path="/auth/sign-in" element={<p>Sign in again</p>} />
      </Routes>
    </MemoryRouter>,
  );

const fillAndSubmitNewPassword = async () => {
  await screen.findByRole('button', { name: 'Update password' });
  const password = document.querySelector<HTMLInputElement>('input[name="password"]');
  const confirmation = document.querySelector<HTMLInputElement>('input[name="confirmation"]');
  expect(password).not.toBeNull();
  expect(confirmation).not.toBeNull();
  if (!password || !confirmation) throw new Error('Reset password fields were not rendered.');
  fireEvent.change(password, { target: { value: 'a sufficiently long replacement password' } });
  fireEvent.change(confirmation, {
    target: { value: 'a sufficiently long replacement password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
};

describe('AUTH-007 ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authChangeHandler = null;
    vi.mocked(requireSupabase).mockReturnValue({
      auth: { exchangeCodeForSession, getSession, onAuthStateChange, signOut, updateUser },
    } as never);
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
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

  it('updates the password and globally ends existing sessions', async () => {
    exchangeCodeForSession.mockImplementation(() => {
      authChangeHandler?.('PASSWORD_RECOVERY');
      return Promise.resolve({ data: {}, error: null });
    });

    renderReset('/auth/reset-password?code=recovery-code');
    await fillAndSubmitNewPassword();

    await waitFor(() => expect(signOut).toHaveBeenCalledWith());
    expect(updateUser).toHaveBeenCalledWith({
      password: 'a sufficiently long replacement password',
    });
  });

  it('does not falsely report reset failure when session revocation fails', async () => {
    exchangeCodeForSession.mockImplementation(() => {
      authChangeHandler?.('PASSWORD_RECOVERY');
      return Promise.resolve({ data: {}, error: null });
    });
    signOut.mockResolvedValue({ error: { message: 'Provider diagnostic' } });

    renderReset('/auth/reset-password?code=recovery-code');
    await fillAndSubmitNewPassword();

    expect(await screen.findByRole('alert')).toHaveTextContent(/password was updated/i);
    expect(screen.queryByText(/provider diagnostic/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update password' })).not.toBeInTheDocument();
  });
});
