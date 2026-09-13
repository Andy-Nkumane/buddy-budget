import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  createMonthFromTemplate,
  retrieveDefaultTemplate,
  retrieveMonthByStart,
  retrieveProfile,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart } from '../../shared/formatting/money';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';

export const useEnsureCurrentMonth = (): void => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const attemptedMonthStart = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const monthStart = currentMonthStart(profile.data?.timezone);
  const monthKey = queryKeys.month(userId, monthStart);
  const month = useQuery({
    queryKey: monthKey,
    queryFn: () => retrieveMonthByStart(monthStart),
    enabled: profile.isSuccess,
  });
  const template = useQuery({
    queryKey: queryKeys.defaultTemplate(userId),
    queryFn: retrieveDefaultTemplate,
  });
  const create = useMutation({
    mutationFn: (templateId: string) => createMonthFromTemplate(monthStart, templateId),
    onSuccess: (created) => queryClient.setQueryData(monthKey, created),
  });

  useEffect(() => {
    if (
      !profile.isSuccess ||
      month.data !== null ||
      !template.data ||
      attemptedMonthStart.current === monthStart
    )
      return;
    attemptedMonthStart.current = monthStart;
    create.mutate(template.data.id);
  }, [create, month.data, monthStart, profile.isSuccess, template.data]);
};
