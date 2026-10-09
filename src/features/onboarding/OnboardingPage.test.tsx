import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import { setupFirstBudget } from '../../data/repositories/budgetRepository';
import type { UserPreferences } from '../../shared/types/domain';
import { OnboardingPage } from './OnboardingPage';
import { createDemoState, DEMO_STARTER_PLAN_KEY, saveApprovedStarterPlan } from '../demo/demoModel';

vi.mock('../../app/providers/AuthProvider', () => ({ useAuth: vi.fn() }));
vi.mock('../../data/repositories/budgetRepository', () => ({
  setupFirstBudget: vi.fn(),
}));

describe('OnboardingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

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

  it('uses an approved starter plan once and clears it only after successful setup', async () => {
    vi.mocked(useAuth).mockReturnValue({
      session: { user: { id: 'user-id' } } as ReturnType<typeof useAuth>['session'],
      loading: false,
      sessionMessage: null,
      signOut: vi.fn(),
    });
    vi.mocked(setupFirstBudget).mockResolvedValue({
      month_start: '2026-10-01',
    } as Awaited<ReturnType<typeof setupFirstBudget>>);
    const demo = createDemoState();
    demo.items[2].plannedMinor = 600_000;
    saveApprovedStarterPlan(localStorage, demo.items);
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
    expect(await screen.findByText(/approved demo plan is ready/i)).toBeVisible();
    expect(screen.getByDisplayValue('6000.00')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByRole('heading', { name: 'Create your first month' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /create my month/i }));

    await waitFor(() => expect(setupFirstBudget).toHaveBeenCalledOnce());
    expect(vi.mocked(setupFirstBudget).mock.calls[0][0].items).toContainEqual({
      name: 'Groceries',
      item_type: 'expense',
      category_name: 'Groceries',
      default_amount: '6000.00',
    });
    expect(localStorage.getItem(DEMO_STARTER_PLAN_KEY)).toBeNull();
  });
});
