import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesPage } from './RulesPage';

const repository = vi.hoisted(() => ({
  searchCategorisationRules: vi.fn(),
  retrieveCategorisationSuggestions: vi.fn(),
  searchCategories: vi.fn(),
  searchTemplates: vi.fn(),
  searchBudgetTransactions: vi.fn(),
  processCategorisationRules: vi.fn(),
  deleteCategorisationRule: vi.fn(),
  dismissCategorisationSuggestion: vi.fn(),
  moveCategorisationRule: vi.fn(),
  upsertCategorisationRule: vi.fn(),
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
        <RulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('RulesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.searchCategorisationRules.mockResolvedValue([]);
    repository.retrieveCategorisationSuggestions.mockResolvedValue([]);
    repository.searchCategories.mockResolvedValue([]);
    repository.searchTemplates.mockResolvedValue([]);
    repository.searchBudgetTransactions.mockResolvedValue({ records: [], total: 0 });
  });

  it('shows an empty state and a no-change dry run without mutating data', async () => {
    renderPage();
    expect(await screen.findByText('No categorisation rules yet')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Test rules' }));
    expect(await screen.findByRole('dialog', { name: 'Rule dry run' })).toBeVisible();
    expect(screen.getByText('No matching changes.')).toBeVisible();
    expect(repository.processCategorisationRules).not.toHaveBeenCalled();
  });

  it('surfaces retrieval errors', async () => {
    repository.searchCategorisationRules.mockRejectedValue(new Error('Rules unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Rules unavailable');
  });

  it('shows winning rules and proposed fields from a dry run', async () => {
    repository.searchBudgetTransactions.mockResolvedValue({
      records: [{ id: 'transaction-id' }],
      total: 1,
    });
    repository.processCategorisationRules.mockResolvedValue({
      dry_run: true,
      selected_count: 1,
      changed_count: 1,
      changes: [
        {
          transaction_id: 'transaction-id',
          winning_rules: ['category:rule-a'],
          category_id: { before: null, after: 'category-id' },
        },
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Test rules' }));
    expect(await screen.findByText('Winning rules: category:rule-a')).toBeVisible();
    expect(screen.getByText('category_id')).toBeVisible();
  });
});
