import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { requireSupabase } from '../../data/supabase/client';
import { SignInPage } from './SignInPage';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const signInWithPassword = vi.fn();

const renderPage = (state?: { passwordChanged: boolean }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/auth/sign-in', state }]}>
      <Routes>
        <Route path="/auth/sign-in" element={<SignInPage />} />
        <Route path="/app" element={<p>Budget dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );

const submitCredentials = () => {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'tester@example.test' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'existing-password' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('AUTH-006 SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    vi.mocked(requireSupabase).mockReturnValue({ auth: { signInWithPassword } } as never);
  });

  it('does not expose credential or provider failure details', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'invalid_credentials', message: 'Provider diagnostic' },
    });
    renderPage();

    submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(/email or password is incorrect/i);
    expect(screen.queryByText(/provider diagnostic/i)).not.toBeInTheDocument();
  });

  it('shows accessible retry guidance when the provider enforces its rate limit', async () => {
    signInWithPassword.mockResolvedValue({
      error: { code: 'over_request_rate_limit', status: 429, message: 'Provider diagnostic' },
    });
    renderPage();

    submitCredentials();

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts.*wait/i);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('allows a legitimate sign-in and routes to the dashboard', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderPage();

    submitCredentials();

    await waitFor(() => expect(screen.getByText('Budget dashboard')).toBeVisible());
  });

  it('confirms a completed password reset without exposing recovery data', () => {
    renderPage({ passwordChanged: true });

    expect(screen.getByRole('status')).toHaveTextContent(/password was updated/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/code|token/i);
  });
});
