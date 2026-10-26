import { describe, expect, it } from 'vitest';
import {
  getAuthErrorMessage,
  getNewPasswordErrorMessage,
  getRegistrationErrorMessage,
} from './authErrors';

describe('AUTH-006 password error mapping', () => {
  it('maps provider weak-password rejection for registration and reset', () => {
    const providerError = { code: 'weak_password', reasons: ['pwned'] };

    expect(getRegistrationErrorMessage(providerError, false)).toMatch(/known data breach/i);
    expect(getNewPasswordErrorMessage('password-reset', providerError)).toMatch(
      /known data breach/i,
    );
  });

  it('does not mislabel another weak-password reason as a known breach', () => {
    const providerError = { code: 'weak_password', reasons: ['length'] };

    expect(getRegistrationErrorMessage(providerError, false)).not.toMatch(/known data breach/i);
    expect(getNewPasswordErrorMessage('password-reset', providerError)).not.toMatch(
      /known data breach/i,
    );
  });

  it('uses a safe generic message when provider screening is unavailable', () => {
    const providerError = { code: 'unexpected_failure' };

    expect(getRegistrationErrorMessage(providerError, false)).not.toContain('unexpected_failure');
    expect(getNewPasswordErrorMessage('password-reset', providerError)).not.toContain(
      'unexpected_failure',
    );
  });

  it('only reveals a duplicate account in local development', () => {
    const providerError = { code: 'user_already_exists' };

    expect(getRegistrationErrorMessage(providerError, true)).toMatch(/already exists.*localhost/i);
    expect(getRegistrationErrorMessage(providerError, false)).not.toMatch(/already exists/i);
  });

  it.each([
    { code: 'over_request_rate_limit' },
    { code: 'over_email_send_rate_limit' },
    { status: 429 },
  ])('gives safe retry guidance for provider throttling: $code$status', (providerError) => {
    const message = getAuthErrorMessage('sign-in', providerError);

    expect(message).toMatch(/too many attempts/i);
    expect(message).toMatch(/wait/i);
    expect(message).not.toContain(providerError.code ?? '429');
  });
});
