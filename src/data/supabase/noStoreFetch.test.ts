import { afterEach, describe, expect, it, vi } from 'vitest';
import { noStoreFetch } from './noStoreFetch';

describe('COMP-023 noStoreFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prevents HTTP caching while preserving request options', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', request);
    const signal = new AbortController().signal;

    await noStoreFetch('https://project.supabase.co/rest/v1/budget_months', {
      cache: 'force-cache',
      headers: { authorization: 'Bearer test-token' },
      signal,
    });

    expect(request).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/budget_months',
      expect.objectContaining({
        cache: 'no-store',
        headers: { authorization: 'Bearer test-token' },
        signal,
      }),
    );
  });
});
