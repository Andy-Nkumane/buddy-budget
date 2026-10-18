import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccountBrowserState } from './accountSession';

describe('clearAccountBrowserState', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes account-scoped browser data without deleting an approved public starter plan', () => {
    localStorage.setItem('buddy-budget-active-household', 'household-id');
    localStorage.setItem('buddy-budget-onboarding:account-id', '{"step":2}');
    localStorage.setItem('buddybudget-month-month-id', '123');
    localStorage.setItem('buddy-budget-approved-demo-plan', '{"version":1}');
    sessionStorage.setItem('buddy-budget:pending-milestone', 'first_budget');

    clearAccountBrowserState('account-id');

    expect(localStorage.getItem('buddy-budget-active-household')).toBeNull();
    expect(localStorage.getItem('buddy-budget-onboarding:account-id')).toBeNull();
    expect(localStorage.getItem('buddybudget-month-month-id')).toBeNull();
    expect(sessionStorage.getItem('buddy-budget:pending-milestone')).toBeNull();
    expect(localStorage.getItem('buddy-budget-approved-demo-plan')).toBe('{"version":1}');
  });
});
