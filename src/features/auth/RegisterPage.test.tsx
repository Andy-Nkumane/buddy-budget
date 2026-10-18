import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { requireSupabase } from '../../data/supabase/client';
import { RegisterPage } from './RegisterPage';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

type SignUpRequest = {
  email: string;
  password: string;
  options: {
    emailRedirectTo: string;
    data: Record<string, string>;
  };
};

const signUp = vi.fn<(request: SignUpRequest) => Promise<unknown>>();

describe('COMP-001/COMP-002 RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    vi.mocked(requireSupabase).mockReturnValue({ auth: { signUp } } as never);
    signUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('shows collection information before the fields and requires separate acknowledgement', async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    const notice = screen.getByRole('complementary', {
      name: 'Before you create a test account',
    });
    const email = screen.getByLabelText('Email address');
    expect(notice.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    fireEvent.change(email, { target: { value: 'tester@example.test' } });
    fireEvent.change(document.getElementById('password')!, {
      target: { value: 'safe-test-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Acknowledge the testing terms to continue.')).toBeVisible();
    expect(signUp).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(signUp).toHaveBeenCalledOnce());
    const request = signUp.mock.calls[0][0];
    expect(request.email).toBe('tester@example.test');
    expect(request.password).toBe('safe-test-password');
    expect(request.options.emailRedirectTo).toContain('/auth/callback');
    expect(request.options.data.testing_terms_acknowledged_version).toBe('draft-0.1');
    expect(request.options.data.privacy_notice_seen_version).toBe('draft-0.1');
    expect(Number.isNaN(Date.parse(request.options.data.acknowledged_at))).toBe(false);
  });
});
