import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSupabase } from '../../data/supabase/client';
import {
  createTotpEnrollment,
  getTotpFactorDisplayName,
  validateMfaFriendlyName,
  verifyTotpFactor,
} from './mfa';

vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const enroll = vi.fn();
const challengeAndVerify = vi.fn();

describe('AUTH-002 MFA provider boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSupabase).mockReturnValue({
      auth: { mfa: { enroll, challengeAndVerify } },
    } as never);
  });

  it('passes the normalized user-approved name to the provider', async () => {
    enroll.mockResolvedValue({
      data: { id: 'new-factor', totp: { qr_code: 'data:image/svg+xml,qr', secret: 'TESTKEY' } },
      error: null,
    });

    await expect(createTotpEnrollment('  Personal phone  ')).resolves.toEqual({
      factorId: 'new-factor',
      qrCode: 'data:image/svg+xml,qr',
      secret: 'TESTKEY',
    });
    expect(enroll).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: 'Personal phone',
    });
  });

  it('rejects invalid names before calling the provider', async () => {
    await expect(createTotpEnrollment('   ')).rejects.toThrow('Enter a name');
    await expect(createTotpEnrollment('Unsafe\u0000name')).rejects.toThrow('control or invisible');
    await expect(createTotpEnrollment('a'.repeat(49))).rejects.toThrow('48 characters or fewer');
    expect(enroll).not.toHaveBeenCalled();
  });

  it('keeps Unicode and internal whitespace without silently rewriting it', () => {
    expect(validateMfaFriendlyName('  Téléphone personnel  ')).toBeNull();
    expect(validateMfaFriendlyName('Work  password manager')).toBeNull();
  });

  it('maps a provider name conflict to a safe actionable message', async () => {
    enroll.mockResolvedValue({
      data: null,
      error: { code: 'mfa_factor_name_conflict', message: 'Provider diagnostic' },
    });

    await expect(createTotpEnrollment('Personal phone')).rejects.toThrow(
      'That name is already in use. Choose a different authenticator name.',
    );
  });

  it('uses a stable neutral display fallback for a legacy unnamed factor', () => {
    expect(
      getTotpFactorDisplayName({
        friendly_name: undefined,
        created_at: '2026-10-24T00:00:00.000Z',
      }),
    ).toBe('Authenticator added 2026-10-24');
  });

  it('does not expose provider verification diagnostics', async () => {
    challengeAndVerify.mockResolvedValue({
      error: { code: 'mfa_verification_failed', message: 'Provider diagnostic' },
    });

    await expect(verifyTotpFactor('factor-id', '000000')).rejects.toThrow(
      'That verification code could not be confirmed. Check it and try again.',
    );
  });
});
