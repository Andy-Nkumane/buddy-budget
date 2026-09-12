import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  createMonthFromTemplate,
  retrieveDefaultTemplate,
  retrieveMonthByStart,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart } from '../../shared/formatting/money';

export const useEnsureCurrentMonth = (): void => {
  const attempted = useRef(false);
  const queryClient = useQueryClient();
  const monthStart = currentMonthStart();
  const monthKey = ['month', monthStart];
  const month = useQuery({ queryKey: monthKey, queryFn: () => retrieveMonthByStart(monthStart) });
  const template = useQuery({ queryKey: ['default-template'], queryFn: retrieveDefaultTemplate });
  const create = useMutation({
    mutationFn: (templateId: string) => createMonthFromTemplate(monthStart, templateId),
    onSuccess: (created) => queryClient.setQueryData(monthKey, created),
  });

  useEffect(() => {
    if (month.data !== null || !template.data || attempted.current) return;
    attempted.current = true;
    create.mutate(template.data.id);
  }, [create, month.data, template.data]);
};
