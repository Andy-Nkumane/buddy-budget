import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  retrieveHouseholdContext,
  switchHousehold,
} from '../../data/repositories/householdRepository';
import { HouseholdProvider, useHousehold } from './HouseholdProvider';

vi.mock('./AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'user-a' } } }) }));
vi.mock('../../data/repositories/householdRepository', () => ({
  retrieveHouseholdContext: vi.fn(),
  switchHousehold: vi.fn(),
}));

const context = (active: string) => ({
  active_household_id: active,
  households: [
    { id: 'household-a', name: 'A', role: 'owner' as const, created_at: '2026-01-01' },
    { id: 'household-b', name: 'B', role: 'editor' as const, created_at: '2026-01-01' },
  ],
  members: [],
  invitations: [],
  activity: [],
});

const Probe = () => {
  const household = useHousehold();
  return (
    <button onClick={() => void household.switchHousehold('household-b').catch(() => undefined)}>
      {household.activeHouseholdId ?? 'loading'}
    </button>
  );
};

describe('HouseholdProvider', () => {
  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('clears cached financial data before switching households', async () => {
    window.localStorage.setItem('buddy-budget-active-household', 'household-a');
    vi.mocked(retrieveHouseholdContext)
      .mockResolvedValueOnce(context('household-a'))
      .mockResolvedValueOnce(context('household-b'));
    vi.mocked(switchHousehold).mockResolvedValue();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['user', 'user-a', 'household', 'household-a', 'months'], ['private-a']);
    render(
      <QueryClientProvider client={client}>
        <HouseholdProvider>
          <Probe />
        </HouseholdProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'household-a' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'household-a' }));
    await waitFor(() => expect(switchHousehold).toHaveBeenCalledWith('household-b'));
    expect(
      client.getQueryData(['user', 'user-a', 'household', 'household-a', 'months']),
    ).toBeUndefined();
    expect(window.localStorage.getItem('buddy-budget-active-household')).toBe('household-b');
  });

  it('restores the previous cache scope when switching fails', async () => {
    window.localStorage.setItem('buddy-budget-active-household', 'household-a');
    vi.mocked(retrieveHouseholdContext)
      .mockResolvedValueOnce(context('household-a'))
      .mockResolvedValueOnce(context('household-a'));
    vi.mocked(switchHousehold).mockRejectedValueOnce(new Error('Access revoked'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <HouseholdProvider>
          <Probe />
        </HouseholdProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('button', { name: 'household-a' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'household-a' }));
    await waitFor(() =>
      expect(window.localStorage.getItem('buddy-budget-active-household')).toBe('household-a'),
    );
    expect(await screen.findByRole('button', { name: 'household-a' })).toBeVisible();
  });
});
