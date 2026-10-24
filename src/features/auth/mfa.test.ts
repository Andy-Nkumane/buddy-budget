import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSupabase } from '../../data/supabase/client';
import { createTotpEnrollment, verifyTotpFactor } from './mfa';

vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const listFactors = vi.fn();
const enroll = vi.fn();
const challengeAndVerify = vi.fn();

describe('AUTH-002 MFA provider boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSupabase).mockReturnValue({
      auth: { mfa: { listFactors, enroll, challengeAndVerify } },
    } as never);
  });

  it('uses a distinct provider factor name and returns only enrollment display data', async () => {
    listFactors.mockResolvedValue({
      data: {
        all: [{ factor_type: 'totp' }, { factor_type: 'phone' }],
      },
      error: null,
    });
    enroll.mockResolvedValue({
      data: { id: 'new-factor', totp: { qr_code: 'data:image/svg+xml,qr', secret: 'TESTKEY' } },
      error: null,
    });

    await expect(createTotpEnrollment()).resolves.toEqual({
      factorId: 'new-factor',
      qrCode: 'data:image/svg+xml,qr',
      secret: 'TESTKEY',
    });
    expect(enroll).toHaveBeenCalledWith({
      factorType: 'totp',
      friendlyName: 'Authenticator app 2',
    });
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
