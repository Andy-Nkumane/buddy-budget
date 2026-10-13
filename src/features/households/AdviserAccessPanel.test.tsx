import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AdviserAccessPanel, AdviserReportLinks } from './AdviserAccessPanel';

const repository = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock('../../data/repositories/adviserRepository', () => ({
  createAdviserGrant: repository.create,
  retrieveAdviserGrants: repository.retrieve,
  revokeAdviserGrant: repository.revoke,
}));

describe('AdviserAccessPanel', () => {
  beforeEach(() => {
    repository.retrieve.mockResolvedValue([]);
    repository.create.mockResolvedValue({ id: 'grant-1', token: 'private-token' });
  });

  it('defaults to short, minimum-scope access without export', async () => {
    render(
      <MemoryRouter>
        <AdviserAccessPanel />
      </MemoryRouter>,
    );
    expect(screen.getByRole('checkbox', { name: 'Monthly summary' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Transaction details' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Allow scoped JSON export/ })).not.toBeChecked();
    fireEvent.change(screen.getByLabelText('Adviser email'), {
      target: { value: 'adviser@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create adviser invitation' }));
    await waitFor(() =>
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'adviser@example.com',
          sections: ['summary'],
          allowExport: false,
        }),
      ),
    );
  });

  it('shows the scoped report link on an owner grant card', async () => {
    repository.retrieve.mockResolvedValue([
      {
        id: 'grant-1',
        adviserEmail: 'adviser@example.com',
        dateFrom: '2026-01-01',
        dateTo: '2026-10-31',
        sections: ['summary'],
        allowExport: false,
        startsAt: '2026-10-01T00:00:00Z',
        expiresAt: '2026-10-20T00:00:00Z',
        acceptedAt: '2026-10-02T00:00:00Z',
        declinedAt: null,
        revokedAt: null,
        lastAccessedAt: null,
        accessCount: 0,
        events: [],
        isOwner: true,
      },
    ]);
    render(
      <MemoryRouter>
        <AdviserAccessPanel />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'View report' })).toBeVisible();
  });

  it('shows advisers a report link without owner controls', async () => {
    repository.retrieve.mockResolvedValue([
      {
        id: 'grant-2',
        householdName: 'Client household',
        adviserEmail: 'adviser@example.com',
        dateFrom: '2026-01-01',
        dateTo: '2026-10-31',
        sections: ['summary'],
        allowExport: false,
        startsAt: '2020-01-01T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
        acceptedAt: '2026-10-02T00:00:00Z',
        declinedAt: null,
        revokedAt: null,
        lastAccessedAt: null,
        accessCount: 0,
        events: [],
        isOwner: false,
      },
    ]);
    render(
      <MemoryRouter>
        <AdviserReportLinks />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('button', { name: 'View report' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Renew' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    expect(screen.queryByText('View audit history')).not.toBeInTheDocument();
  });
});
