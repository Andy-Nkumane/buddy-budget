import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOnboardingDraft,
  createSetupKey,
  retrieveOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingDraft,
} from './onboardingState';

const userId = '10000000-0000-4000-8000-000000000001';
const draft = (): OnboardingDraft => ({
  version: 1,
  userId,
  updatedAt: new Date().toISOString(),
  setupKey: createSetupKey(),
  path: 'blank',
  step: 2,
  displayName: '',
  currencyCode: 'ZAR',
  locale: 'en-ZA',
  timezone: 'Africa/Johannesburg',
  templateName: 'My monthly plan',
  items: [],
});

describe('onboarding progress storage', () => {
  beforeEach(() => localStorage.clear());

  it('resumes only the authenticated user draft', () => {
    const value = draft();
    saveOnboardingDraft(localStorage, value);
    expect(retrieveOnboardingDraft(localStorage, userId)).toEqual(value);
    expect(
      retrieveOnboardingDraft(localStorage, '20000000-0000-4000-8000-000000000002'),
    ).toBeNull();
  });

  it('removes completed progress', () => {
    saveOnboardingDraft(localStorage, draft());
    clearOnboardingDraft(localStorage, userId);
    expect(retrieveOnboardingDraft(localStorage, userId)).toBeNull();
  });

  it('keeps onboarding usable when browser storage is unavailable', () => {
    const unavailableStorage = {
      setItem: () => {
        throw new DOMException('Storage unavailable');
      },
      removeItem: () => {
        throw new DOMException('Storage unavailable');
      },
    };

    expect(() => saveOnboardingDraft(unavailableStorage, draft())).not.toThrow();
    expect(() => clearOnboardingDraft(unavailableStorage, userId)).not.toThrow();
  });
});
