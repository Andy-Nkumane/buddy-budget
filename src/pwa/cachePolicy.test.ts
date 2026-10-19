import { describe, expect, it } from 'vitest';
import {
  pwaNavigationFallbackDenylist,
  pwaPrecachePatterns,
  pwaRuntimeCaching,
} from './cachePolicy';

describe('COMP-023 PWA cache policy', () => {
  it('precaches only public application assets and has no private runtime cache', () => {
    expect(pwaRuntimeCaching).toEqual([]);
    expect(pwaPrecachePatterns.join(',')).not.toMatch(/json|csv|pdf/i);
  });

  it.each([
    '/auth/v1/token',
    '/rest/v1/budget_transactions',
    '/functions/v1/weekly-checkin',
    '/storage/v1/object/private/report.pdf',
    '/exports/account.json',
  ])('denies the navigation fallback for private network path %s', (path) => {
    expect(pwaNavigationFallbackDenylist.some((pattern) => pattern.test(path))).toBe(true);
  });
});
