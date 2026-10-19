import { describe, expect, it } from 'vitest';
import { resolvePagesRoute } from './pagesRoute';

describe('resolvePagesRoute', () => {
  it('restores legal routes beneath a GitHub Pages repository base path', () => {
    expect(resolvePagesRoute('?/terms', '', '/buddy-budget/')).toBe('/buddy-budget/terms');
    expect(resolvePagesRoute('?/disclaimer&source=test', '#results', '/buddy-budget/')).toBe(
      '/buddy-budget/disclaimer?source=test#results',
    );
  });

  it('ignores ordinary query strings', () => {
    expect(resolvePagesRoute('?source=test', '', '/buddy-budget/')).toBeNull();
  });
});
