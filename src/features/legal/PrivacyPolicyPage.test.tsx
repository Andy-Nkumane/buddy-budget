import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';
import {
  isPrivacyPolicyPublishable,
  privacyPolicyPublicationDetails,
  retrievePrivacyPolicyPublicationBlockers,
} from './privacyPolicy';

describe('COMP-002 PrivacyPolicyPage', () => {
  it('is publicly readable and covers the required topics', () => {
    render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeVisible();
    expect(screen.getByText(/experimental, non-commercial project/i)).toBeVisible();
    expect(screen.getByRole('heading', { name: /providers, recipients/i })).toBeVisible();
    expect(screen.getByText(/Pages logs visitor IP addresses/i)).toBeVisible();
    expect(screen.getByText(/Frankfurt, Germany and Saint-Ghislain, Belgium/i)).toBeVisible();
    expect(screen.getByText('0.2-draft')).toBeVisible();
    expect(screen.getByRole('heading', { name: /retention, account deletion/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: /your rights and complaints/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: /children and sensitive/i })).toBeVisible();
    expect(screen.getByRole('heading', { name: '8. Security' })).toBeVisible();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow,noarchive',
    );
  });

  it('cannot silently present missing owner details as an effective policy', () => {
    expect(isPrivacyPolicyPublishable()).toBe(false);
    expect(retrievePrivacyPolicyPublicationBlockers()).toHaveLength(
      Object.keys(privacyPolicyPublicationDetails).length + 1,
    );

    render(
      <MemoryRouter>
        <PrivacyPolicyPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Draft — publication blocked')).toBeVisible();
    expect(screen.getByText('Responsible party legal name')).toBeVisible();
    expect(screen.getByText(/has no effective date/i)).toBeVisible();
  });

  it('treats placeholder owner details as publication blockers', () => {
    const placeholderDetails = Object.fromEntries(
      Object.keys(privacyPolicyPublicationDetails).map((key) => [key, 'TODO']),
    ) as Record<keyof typeof privacyPolicyPublicationDetails, string>;

    expect(retrievePrivacyPolicyPublicationBlockers(placeholderDetails)).toHaveLength(
      Object.keys(privacyPolicyPublicationDetails).length + 1,
    );
    expect(isPrivacyPolicyPublishable(placeholderDetails)).toBe(false);
  });
});
