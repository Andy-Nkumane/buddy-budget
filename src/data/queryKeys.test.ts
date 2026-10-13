import { afterEach, describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('household query isolation', () => {
  afterEach(() => window.localStorage.clear());

  it('includes the active household in every financial query root', () => {
    window.localStorage.setItem('buddy-budget-active-household', 'household-a');
    expect(queryKeys.categories('user-a')).toContain('household-a');
    expect(queryKeys.months('user-a')).toContain('household-a');
    window.localStorage.setItem('buddy-budget-active-household', 'household-b');
    expect(queryKeys.categories('user-a')).toContain('household-b');
    expect(queryKeys.categories('user-a')).not.toContain('household-a');
  });
});
