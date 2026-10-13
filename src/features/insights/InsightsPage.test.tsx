import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InsightsPage } from './InsightsPage';

const repository = vi.hoisted(() => ({
  retrieveBudgetInsights: vi.fn(),
  retrieveProfile: vi.fn(),
  searchCategories: vi.fn(),
}));

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-id' } } }),
}));
vi.mock('../../data/repositories/budgetRepository', () => repository);

const renderPage = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InsightsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('InsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.retrieveProfile.mockResolvedValue({ locale: 'en-ZA' });
    repository.searchCategories.mockResolvedValue([
      { id: 'category-id', name: 'Dining', item_type: 'expense' },
      { id: 'income-category-id', name: 'Salary', item_type: 'income' },
    ]);
    repository.retrieveBudgetInsights.mockResolvedValue({
      definitions_version: 1,
      from_month: '2026-07-01',
      to_month: '2026-09-01',
      category_id: null,
      month_count: 1,
      currencies: ['ZAR'],
      monthly: [
        {
          month_start: '2026-09-01',
          currency_code: 'ZAR',
          planned_income_minor: 100000,
          planned_expenses_minor: 60000,
          actual_income_minor: 100000,
          actual_expenses_minor: 65000,
          income_variance_minor: 0,
          expense_variance_minor: 5000,
          savings_minor: 35000,
          savings_rate_basis_points: 3500,
          adjustment_income_minor: 0,
          adjustment_expenses_minor: 0,
        },
      ],
      categories: [],
      recurring_changes: [],
      largest_discretionary: [],
      income_stability: [
        {
          currency_code: 'ZAR',
          months_observed: 1,
          months_with_income: 1,
          average_income_minor: 100000,
          minimum_income_minor: 100000,
          maximum_income_minor: 100000,
          range_basis_points: null,
        },
      ],
      goals: [],
    });
  });

  it('provides a table alternative, explanations, and insufficient-data status', async () => {
    renderPage();
    expect(await screen.findByRole('table', { name: /Monthly planned and actual/ })).toBeVisible();
    expect(screen.getByText(/Early signal: only 1 month/)).toBeVisible();
    expect(screen.getByText(/This deterministic recommendation/)).toBeVisible();
    expect(screen.getAllByText(/Action:/).length).toBeGreaterThan(0);
  });

  it('applies category and date filters together', async () => {
    renderPage();
    await screen.findByRole('table', { name: /Monthly planned and actual/ });
    fireEvent.click(screen.getByLabelText('Dining (expense)'));
    fireEvent.click(screen.getByLabelText('Salary (income)'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(repository.retrieveBudgetInsights).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryIds: ['category-id', 'income-category-id'] }),
    );
  });
});
