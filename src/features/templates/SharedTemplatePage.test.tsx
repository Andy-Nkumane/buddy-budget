import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SharedTemplatePage } from './SharedTemplatePage';

const repository = vi.hoisted(() => ({
  retrieve: vi.fn(),
  copy: vi.fn(),
}));

vi.mock('../../app/providers/AuthProvider', () => ({
  useAuth: () => ({ session: null, loading: false }),
}));

vi.mock('../../data/repositories/budgetRepository', () => ({
  retrievePublicSharedTemplate: repository.retrieve,
  copySharedTemplate: repository.copy,
}));

describe('SharedTemplatePage', () => {
  it('shows a redacted customizable preview and continues anonymously to registration', async () => {
    repository.retrieve.mockResolvedValue({
      expires_at: '2026-10-19T00:00:00Z',
      snapshot: {
        schemaVersion: 1,
        name: 'Simple home',
        version: 2,
        includesAmounts: false,
        items: [
          {
            key: 'item-1',
            name: 'Rent',
            itemType: 'expense',
            categoryName: 'Housing',
            sortOrder: 0,
          },
        ],
      },
    });
    window.location.hash = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ';
    render(
      <MemoryRouter initialEntries={['/template']}>
        <Routes>
          <Route path="/template" element={<SharedTemplatePage />} />
          <Route path="/auth/register" element={<p>Register now</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Simple home' })).toBeVisible();
    expect(screen.getByText(/kept their amounts private/)).toBeVisible();
    expect(screen.getByLabelText('Monthly amount')).toHaveValue('0.00');
    fireEvent.click(screen.getByRole('button', { name: 'Create account to copy' }));
    expect(await screen.findByText('Register now')).toBeVisible();
  });
});
