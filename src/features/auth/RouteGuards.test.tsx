import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { retrievePreferences } from '../../data/repositories/budgetRepository';
import {
  RedirectAuthenticated,
  RequireAuthentication,
  RequireIncompleteOnboarding,
} from './RouteGuards';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/repositories/budgetRepository', () => ({ retrievePreferences: vi.fn() }));

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

describe('RequireIncompleteOnboarding', () => {
  it('keeps a completed user out of onboarding', async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-a' } } as ReturnType<typeof useAuth>['session'],
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    vi.mocked(retrievePreferences).mockResolvedValue({
      onboarding_completed_at: '2026-10-11T10:00:00Z',
    } as Awaited<ReturnType<typeof retrievePreferences>>);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route element={<RequireIncompleteOnboarding />}>
              <Route path="/onboarding" element={<div>Onboarding</div>} />
            </Route>
            <Route path="/app" element={<div>Budget dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Budget dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
  });
});

describe('RedirectAuthenticated', () => {
  it('waits for session restoration before rendering a public page', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: null,
      loading: true,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/auth/sign-in']}>
        <Routes>
          <Route element={<RedirectAuthenticated />}>
            <Route path="/auth/sign-in" element={<div>Sign in page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Restoring your session…')).toBeInTheDocument();
    expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
  });

  it('redirects a restored session to the app', () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-a' } } as ReturnType<typeof useAuth>['session'],
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RedirectAuthenticated />}>
            <Route path="/" element={<div>Landing page</div>} />
          </Route>
          <Route path="/app" element={<div>Budget dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Budget dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Landing page')).not.toBeInTheDocument();
  });
});
