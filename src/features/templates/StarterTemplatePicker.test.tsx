import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StarterTemplate } from '../../shared/types/domain';
import { StarterTemplatePicker, type StarterTemplateSelection } from './StarterTemplatePicker';

const { fixtures } = vi.hoisted(() => ({
  fixtures: [
    {
      id: 'student',
      version: 1,
      name: 'Student',
      audience: 'For study periods',
      description: 'A simple structure.',
      template_name: 'Student budget',
      sort_order: 0,
      is_active: true,
      created_at: '2026-10-09T00:00:00Z',
      items: [
        {
          starter_template_id: 'student',
          starter_template_version: 1,
          item_key: 'income',
          item_type: 'income',
          name: 'Income or support',
          category_name: 'Earnings',
          default_amount: 0 as unknown as string,
          sort_order: 0,
        },
        {
          starter_template_id: 'student',
          starter_template_version: 1,
          item_key: 'housing',
          item_type: 'expense',
          name: 'Housing',
          category_name: 'Housing',
          default_amount: 0 as unknown as string,
          sort_order: 0,
        },
      ],
    },
  ] as StarterTemplate[],
}));

vi.mock('../../data/repositories/budgetRepository', () => ({
  retrieveStarterTemplates: vi.fn().mockResolvedValue(fixtures),
}));

const renderPicker = (onSubmit = vi.fn<(selection: StarterTemplateSelection) => void>()) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <StarterTemplatePicker
        currency="ZAR"
        locale="en-ZA"
        submitLabel="Use this starting point"
        onSubmit={onSubmit}
      />
    </QueryClientProvider>,
  );
  return onSubmit;
};

describe('StarterTemplatePicker', () => {
  it('previews categories and submits only included customized items', async () => {
    const onSubmit = renderPicker();
    expect(await screen.findByRole('heading', { name: 'Student preview' })).toBeVisible();
    expect(screen.getByText('Earnings · income')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Income or support monthly amount'), {
      target: { value: '1250.50' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Housing/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this starting point' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'student',
        version: 1,
        templateName: 'Student budget',
        items: [expect.objectContaining({ itemKey: 'income', amount: '1250.50' })],
      }),
    );
  });

  it('keeps one idempotency key across a retry', async () => {
    const onSubmit = renderPicker();
    const submit = await screen.findByRole('button', { name: 'Use this starting point' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onSubmit.mock.calls[0][0].copyKey).toBe(onSubmit.mock.calls[1][0].copyKey);
  });
});
