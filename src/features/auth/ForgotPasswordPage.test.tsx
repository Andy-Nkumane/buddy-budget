import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSupabase } from '../../data/supabase/client';
import { ForgotPasswordPage } from './ForgotPasswordPage';

vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const resetPasswordForEmail = vi.fn();

describe('AUTH-006 ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSupabase).mockReturnValue({ auth: { resetPasswordForEmail } } as never);
  });

  it.each([
    ['provider success', null],
    ['unknown account response', { code: 'user_not_found', message: 'Provider diagnostic' }],
    ['provider rate limit', { code: 'over_email_send_rate_limit', status: 429 }],
  ])('returns the same neutral completion state for %s', async (_scenario, error) => {
    resetPasswordForEmail.mockResolvedValue({ error });
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'tester@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.getByText(/if an account exists/i)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/provider diagnostic/i)).not.toBeInTheDocument();
  });

  it('keeps the neutral completion state when the provider request throws', async () => {
    resetPasswordForEmail.mockRejectedValue(new Error('Network diagnostic'));
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'tester@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeVisible();
    expect(screen.queryByText(/network diagnostic/i)).not.toBeInTheDocument();
  });
});
