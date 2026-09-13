import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import { setupFirstBudget } from '../../data/repositories/budgetRepository';
import type { UserPreferences } from '../../shared/types/domain';
import { OnboardingPage } from './OnboardingPage';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/repositories/budgetRepository', () => ({
  setupFirstBudget: vi.fn(),
}));

describe('OnboardingPage', () => {
  it('caches completed preferences before navigating to the new month', async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-id' } } as ReturnType<typeof useAuth>['session'],
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    vi.mocked(setupFirstBudget).mockResolvedValue({
      month_start: '2026-09-01',
    } as Awaited<ReturnType<typeof setupFirstBudget>>);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/app/budget/:monthStart" element={<span>Budget opened</span>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'What happens most months?' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'Create your first month' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /create my month/i }));

    expect(await screen.findByText('Budget opened')).toBeVisible();
    await waitFor(() => expect(setupFirstBudget).toHaveBeenCalledOnce());
    const cachedPreferences = queryClient.getQueryData<UserPreferences>(
      queryKeys.preferences('user-id'),
    );
    expect(cachedPreferences).toMatchObject({
      user_id: 'user-id',
      theme: 'system',
    });
    expect(typeof cachedPreferences?.onboarding_completed_at).toBe('string');
  });
});
