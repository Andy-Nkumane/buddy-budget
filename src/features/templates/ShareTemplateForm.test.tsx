import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, TemplateWithItems } from '../../shared/types/domain';
import { ShareTemplateForm } from './ShareTemplateForm';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('../../data/repositories/budgetRepository', () => ({
  createSharedTemplateLink: repository.create,
  retrieveSharedTemplateLinks: repository.retrieve,
  revokeSharedTemplateLink: repository.revoke,
}));

const template = {
  id: 'template-1',
  name: 'Simple home',
  template_items: [
    {
      id: 'item-1',
      name: 'Rent',
      category_id: 'category-1',
      default_amount: '1250.00',
    },
  ],
} as TemplateWithItems;

const categories = [{ id: 'category-1', name: 'Housing' }] as Category[];

describe('ShareTemplateForm', () => {
  beforeEach(() => {
    repository.retrieve.mockResolvedValue([]);
    repository.create.mockResolvedValue({
      id: 'link-1',
      token: 'token',
      expiresAt: '2026-10-19T00:00:00Z',
    });
    repository.revoke.mockResolvedValue(undefined);
  });

  it('keeps amounts private by default', async () => {
    render(<ShareTemplateForm template={template} categories={categories} />);
    expect(screen.getByText('Amount hidden')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Publish template snapshot' }));
    await waitFor(() =>
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 'template-1', includeAmounts: false }),
      ),
    );
  });

  it('requires an explicit opt-in and warning before publishing amounts', () => {
    render(<ShareTemplateForm template={template} categories={categories} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Include planned amounts/ }));
    expect(screen.getByText('1250.00')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Anyone with the link can see');
  });
});
