import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { MilestoneNotice } from './MilestoneNotice';

describe('MilestoneNotice', () => {
  beforeEach(() => sessionStorage.clear());

  it('provides useful non-financial feedback and can be dismissed', () => {
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_budget');
    render(
      <MemoryRouter>
        <MilestoneNotice />
      </MemoryRouter>,
    );
    expect(screen.getByRole('complementary', { name: 'Completed milestone' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add a transaction' })).toHaveAttribute(
      'href',
      '/app/transactions',
    );
    expect(screen.queryByText(/ZAR|\$|amount/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss milestone' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('does not use an assertive live region or blocking dialog', () => {
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_month_close');
    render(
      <MemoryRouter>
        <MilestoneNotice />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
