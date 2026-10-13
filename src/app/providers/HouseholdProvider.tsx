import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { queryKeys } from '../../data/queryKeys';
import {
  retrieveHouseholdContext,
  switchHousehold as persistHouseholdSwitch,
} from '../../data/repositories/householdRepository';
import type { HouseholdContext, HouseholdRole } from '../../shared/types/domain';
import { useAuth } from './AuthProvider';

interface HouseholdContextValue {
  context: HouseholdContext | null;
  activeHouseholdId: string | null;
  role: HouseholdRole | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  switchHousehold: (householdId: string) => Promise<void>;
}

const HouseholdContextState = createContext<HouseholdContextValue | null>(null);

export const HouseholdProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? '';
  const household = useQuery({
    queryKey: queryKeys.household(userId),
    queryFn: retrieveHouseholdContext,
    enabled: Boolean(userId),
  });

  useEffect(() => {
    const activeId = household.data?.active_household_id;
    if (!activeId || window.localStorage.getItem('buddy-budget-active-household') === activeId)
      return;
    window.localStorage.setItem('buddy-budget-active-household', activeId);
    void queryClient.invalidateQueries({ queryKey: ['user', userId] });
  }, [household.data?.active_household_id, queryClient, userId]);

  const switchHousehold = useCallback(
    async (householdId: string) => {
      if (householdId === household.data?.active_household_id) return;
      const previousHouseholdId = household.data?.active_household_id ?? null;
      const previousScope = ['user', userId, 'household', previousHouseholdId] as const;
      await queryClient.cancelQueries({ queryKey: previousScope });
      try {
        await persistHouseholdSwitch(householdId);
        window.localStorage.setItem('buddy-budget-active-household', householdId);
        queryClient.removeQueries({ queryKey: previousScope });
        const nextContext = await retrieveHouseholdContext();
        queryClient.setQueryData(queryKeys.household(userId), nextContext);
        await queryClient.invalidateQueries({
          queryKey: ['user', userId, 'household', householdId],
        });
      } catch (error) {
        if (previousHouseholdId) {
          window.localStorage.setItem('buddy-budget-active-household', previousHouseholdId);
        } else {
          window.localStorage.removeItem('buddy-budget-active-household');
        }
        const restoredContext = await retrieveHouseholdContext();
        queryClient.setQueryData(queryKeys.household(userId), restoredContext);
        throw error;
      }
    },
    [household.data?.active_household_id, queryClient, userId],
  );

  const context = household.data ?? null;
  const role =
    context?.households.find((entry) => entry.id === context.active_household_id)?.role ?? null;
  const value = useMemo<HouseholdContextValue>(
    () => ({
      context,
      activeHouseholdId: context?.active_household_id ?? null,
      role,
      loading: Boolean(userId) && household.isLoading,
      error: household.error,
      refresh: async () => {
        await household.refetch();
      },
      switchHousehold,
    }),
    [context, household, role, switchHousehold, userId],
  );

  return <HouseholdContextState value={value}>{children}</HouseholdContextState>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useHousehold = () => {
  const value = use(HouseholdContextState);
  if (!value) throw new Error('useHousehold must be used inside HouseholdProvider.');
  return value;
};
