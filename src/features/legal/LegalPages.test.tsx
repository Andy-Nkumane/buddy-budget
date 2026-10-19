import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ContactPage } from './ContactPage';
import { FinancialDisclaimerPage } from './FinancialDisclaimerPage';
import { TermsPage } from './TermsPage';

const renderPage = (page: ReactNode) => render(<MemoryRouter>{page}</MemoryRouter>);

describe('COMP-002 public legal pages', () => {
  it('presents draft terms without a blanket liability waiver', () => {
    renderPage(<TermsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Use' })).toBeVisible();
    expect(screen.getByText(/not effective or approved terms yet/i)).toBeVisible();
    expect(screen.getByText(/nothing in these draft terms excludes or restricts/i)).toBeVisible();
    expect(screen.getByText(/calling the project experimental or free/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });

  it('tells testers to verify calculations and avoid sensitive test data', () => {
    renderPage(<FinancialDisclaimerPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Financial Information Disclaimer' }),
    ).toBeVisible();
    expect(screen.getByText(/results may be inaccurate/i)).toBeVisible();
    expect(screen.getByText(/verify important values and dates/i)).toBeVisible();
    expect(screen.getByText(/avoid real sensitive financial/i)).toBeVisible();
    expect(screen.getByText(/does not exclude or reduce rights/i)).toBeVisible();
  });

  it('does not invent an owner contact channel', () => {
    renderPage(<ContactPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Contact' })).toBeVisible();
    expect(screen.getByText(/no official Buddy Budget operator/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Information Regulator' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'National Consumer Commission' })).toBeVisible();
  });
});
