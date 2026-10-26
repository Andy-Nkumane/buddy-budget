import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { requireSupabase } from '../../data/supabase/client';
import { ChangePasswordForm } from './ChangePasswordForm';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const updateUser = vi.fn();
const signOut = vi.fn();

const renderForm = () =>
  render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<ChangePasswordForm />} />
        <Route path="/auth/sign-in" element={<p>Sign in again</p>} />
      </Routes>
    </MemoryRouter>,
  );

const submitValidChange = () => {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'current password value' },
  });
  fireEvent.change(screen.getByLabelText(/^New password/), {
    target: { value: 'a different sufficiently long password' },
  });
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'a different sufficiently long password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
};

describe('AUTH-007 ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      loading: false,
      sessionMessage: null,
      signOut,
    });
    vi.mocked(requireSupabase).mockReturnValue({ auth: { updateUser } } as never);
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue(undefined);
  });

  it('verifies the current password at Supabase and globally signs out after changing it', async () => {
    renderForm();
    submitValidChange();

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({
        current_password: 'current password value',
        password: 'a different sufficiently long password',
      }),
    );
    expect(signOut).toHaveBeenCalledWith();
    expect(await screen.findByText('Sign in again')).toBeVisible();
  });

  it('keeps provider diagnostics private when the current password is rejected', async () => {
    updateUser.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Provider diagnostic' },
    });
    renderForm();
    submitValidChange();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be changed/i);
    expect(screen.queryByText(/provider diagnostic/i)).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('accurately reports a session-revocation failure after the password changed', async () => {
    signOut.mockRejectedValue(new Error('Provider diagnostic'));
    renderForm();
    submitValidChange();

    expect(await screen.findByRole('alert')).toHaveTextContent(/password was updated/i);
    expect(screen.queryByText(/provider diagnostic/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change password' })).not.toBeInTheDocument();
  });
});
