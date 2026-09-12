import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { RequireAuthentication } from './RouteGuards';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));

describe('RequireAuthentication', () => {
  it('redirects signed-out visitors to sign in', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/app/budget/current']}>
        <Routes>
          <Route element={<RequireAuthentication />}>
            <Route path="/app/budget/current" element={<div>Private budget</div>} />
          </Route>
          <Route path="/auth/sign-in" element={<div>Sign in page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByText('Private budget')).not.toBeInTheDocument();
  });
});
