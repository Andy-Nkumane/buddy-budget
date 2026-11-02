import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { MilestoneNotice } from './MilestoneNotice';

describe('MilestoneNotice', () => {
  beforeEach(() => sessionStorage.clear());

  it('provides useful non-financial feedback and can be dismissed', async () => {
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_budget');
    render(
      <MemoryRouter>
        <MilestoneNotice />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('complementary', { name: 'Completed milestone' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Add a transaction' })).toHaveAttribute(
      'href',
      '/app/transactions',
    );
    expect(screen.queryByText(/ZAR|\$|amount/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss milestone' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('shows a pending milestone when React Strict Mode checks the component', async () => {
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_budget');
    render(
      <StrictMode>
        <MemoryRouter>
          <MilestoneNotice />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByRole('complementary', { name: 'Completed milestone' })).toBeVisible();
    expect(sessionStorage.getItem('buddy-budget:pending-milestone')).toBeNull();
  });

  it('does not use an assertive live region or blocking dialog', async () => {
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_month_close');
    render(
      <MemoryRouter>
        <MilestoneNotice />
      </MemoryRouter>,
    );
    await screen.findByRole('complementary', { name: 'Completed milestone' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps long feedback, the next action, and dismissal in a predictable order', async () => {
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_categorisation');
    render(
      <MemoryRouter>
        <MilestoneNotice />
      </MemoryRouter>,
    );

    const notice = await screen.findByRole('complementary', { name: 'Completed milestone' });
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(notice).toHaveTextContent('Your first transaction is organised');
    expect(notice).toHaveTextContent(
      'Categorised activity makes your planned-versus-actual view easier to trust.',
    );
    const action = screen.getByRole('link', { name: 'Review your budget' });
    const dismiss = screen.getByRole('button', { name: 'Dismiss milestone' });
    expect(action).toHaveClass('milestone-notice__action');
    expect(dismiss).toHaveClass('milestone-notice__dismiss');
    expect(action.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
