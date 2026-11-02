import { describe, expect, it } from 'vitest';
import { resolvePagesRoute } from './pagesRoute';

describe('resolvePagesRoute', () => {
  it('restores legal routes beneath a GitHub Pages repository base path', () => {
    expect(resolvePagesRoute('?/terms', '', '/buddy-budget/')).toBe('/buddy-budget/terms');
    expect(resolvePagesRoute('?/disclaimer&source=test', '#results', '/buddy-budget/')).toBe(
      '/buddy-budget/disclaimer?source=test#results',
    );
  });

  it('normalizes the leading slash produced by an older GitHub Pages fallback', () => {
    expect(resolvePagesRoute('?//auth/reset-password&code=test-code', '', '/buddy-budget/')).toBe(
      '/buddy-budget/auth/reset-password?code=test-code',
    );
  });

  it('preserves callback and reset credentials beneath the production base path', () => {
    expect(
      resolvePagesRoute(
        '?/auth/callback&code=synthetic-callback-code',
        '#callback-fragment',
        '/buddy-budget/',
      ),
    ).toBe('/buddy-budget/auth/callback?code=synthetic-callback-code#callback-fragment');
    expect(
      resolvePagesRoute(
        '?/auth/reset-password&code=synthetic-recovery-code~and~next=review',
        '#reset-fragment',
        '/buddy-budget/',
      ),
    ).toBe(
      '/buddy-budget/auth/reset-password?code=synthetic-recovery-code&next=review#reset-fragment',
    );
  });

  it('ignores ordinary query strings', () => {
    expect(resolvePagesRoute('?source=test', '', '/buddy-budget/')).toBeNull();
  });
});
