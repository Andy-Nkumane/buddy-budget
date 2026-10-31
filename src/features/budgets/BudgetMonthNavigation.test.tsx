import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BudgetMonthNavigation } from './BudgetMonthNavigation';

const Location = () => <output>{useLocation().pathname}</output>;

describe('BudgetMonthNavigation', () => {
  it('keeps previous, current, next, and month-list navigation available', () => {
    render(
      <MemoryRouter initialEntries={['/app/budget/2026-01-01']}>
        <BudgetMonthNavigation monthStart="2026-01-01" locale="en-ZA" />
        <Location />
        <Routes>
          <Route path="*" element={null} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('navigation', { name: 'Budget month' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'View budget months' })).toHaveAttribute(
      'href',
      '/app/months',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('/app/budget/2025-12-01')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByText('/app/budget/2026-02-01')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'This month' }));
    expect(screen.getByText('/app/budget/current')).toBeVisible();
  });
});
