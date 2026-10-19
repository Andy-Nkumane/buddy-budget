import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HelpPage } from './HelpPage';

describe('HelpPage', () => {
  it('organises guidance into labelled, navigable sections', () => {
    render(<HelpPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'How Buddy Budget works' })).toBeVisible();

    const navigation = screen.getByRole('navigation', { name: 'How it works sections' });
    expect(within(navigation).getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '#get-started',
    );
    expect(
      within(navigation).getByRole('link', { name: 'Share, export, and protect your data' }),
    ).toHaveAttribute('href', '#share-and-protect');

    expect(screen.getByRole('heading', { name: 'Build and use a monthly budget' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Install and use the app' })).toBeVisible();
  });
});
