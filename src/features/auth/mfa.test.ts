import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireSupabase } from '../../data/supabase/client';
import {
  createTotpEnrollment,
  deleteTotpFactor,
  generateRecoveryCodes,
  getTotpFactorDisplayName,
  refreshMfaSessionAssurance,
  retrieveRecoveryCodesStatus,
  validateMfaFriendlyName,
  verifyRecoveryCode,
  verifyTotpFactor,
} from './mfa';

vi.mock('../../data/supabase/client', () => ({ requireSupabase: vi.fn() }));

const enroll = vi.fn();
const challengeAndVerify = vi.fn();
const unenroll = vi.fn();
const refreshSession = vi.fn();
const signOut = vi.fn();
const getAuthenticatorAssuranceLevel = vi.fn();
const getRecoveryCodesStatus = vi.fn();
const generateRecoveryCodeSet = vi.fn();
const verifyRecoveryCodeAtProvider = vi.fn();

describe('AUTH-002 MFA provider boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSupabase).mockReturnValue({
      auth: {
        refreshSession,
        signOut,
        mfa: {
          enroll,
          challengeAndVerify,
          unenroll,
          getAuthenticatorAssuranceLevel,
          recoveryCodes: {
            getStatus: getRecoveryCodesStatus,
            generate: generateRecoveryCodeSet,
            verify: verifyRecoveryCodeAtProvider,
          },
        },
      },
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

  it('maps a stale factor removal without exposing provider diagnostics', async () => {
    unenroll.mockResolvedValue({
      error: { code: 'mfa_factor_not_found', message: 'Provider diagnostic' },
    });

    await expect(deleteTotpFactor('stale-factor')).rejects.toThrow(
      'This authenticator is no longer available. Refresh and try again.',
    );
  });

  it('uses the factor ID only at the provider unenrollment boundary', async () => {
    unenroll.mockResolvedValue({ data: {}, error: null });

    await expect(deleteTotpFactor('selected-factor')).resolves.toBeUndefined();
    expect(unenroll).toHaveBeenCalledWith({ factorId: 'selected-factor' });
  });

  it('refreshes the session before returning updated assurance', async () => {
    refreshSession.mockResolvedValue({ data: { session: {} }, error: null });
    getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });

    await expect(refreshMfaSessionAssurance()).resolves.toEqual({
      currentLevel: 'aal1',
      nextLevel: 'aal1',
    });
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledOnce();
  });

  it('signs out locally when assurance cannot be refreshed after removal', async () => {
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'Provider refresh diagnostic' },
    });
    signOut.mockResolvedValue({ error: null });

    await expect(refreshMfaSessionAssurance()).rejects.toThrow(
      'The authenticator was removed, but your session ended. Sign in again.',
    );
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('returns only recovery-code status from normal account APIs', async () => {
    getRecoveryCodesStatus.mockResolvedValue({
      data: { id: 'recovery-factor', type: 'recovery_code', total: 8, remaining: 7 },
      error: null,
    });

    await expect(retrieveRecoveryCodesStatus()).resolves.toEqual({
      id: 'recovery-factor',
      total: 8,
      remaining: 7,
    });
  });

  it('returns generated plaintext once without persisting or transforming it', async () => {
    generateRecoveryCodeSet.mockResolvedValue({
      data: {
        id: 'recovery-factor',
        type: 'recovery_code',
        total: 2,
        codes: ['SYNTHETIC-ONE', 'SYNTHETIC-TWO'],
      },
      error: null,
    });

    await expect(generateRecoveryCodes()).resolves.toEqual({
      id: 'recovery-factor',
      total: 2,
      remaining: 2,
      codes: ['SYNTHETIC-ONE', 'SYNTHETIC-TWO'],
    });
  });

  it('keeps invalid, used, and provider recovery-code failures generic', async () => {
    verifyRecoveryCodeAtProvider.mockResolvedValue({
      data: null,
      error: { code: 'mfa_verification_failed', message: 'Provider diagnostic' },
    });

    await expect(verifyRecoveryCode('used-code')).rejects.toThrow(
      'That recovery code is invalid, expired, or has already been used.',
    );
    expect(verifyRecoveryCodeAtProvider).toHaveBeenCalledWith({ code: 'used-code' });
  });
});
