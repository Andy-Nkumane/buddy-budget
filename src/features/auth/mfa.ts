import type { Factor } from '@supabase/supabase-js';
import { requireSupabase } from '../../data/supabase/client';

export type MfaAssurance = {
  currentLevel: string | null;
  nextLevel: string | null;
};

export type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export type RecoveryCodesStatus = { id: string; total: number; remaining: number };
export type GeneratedRecoveryCodes = RecoveryCodesStatus & { codes: string[] };

export const MFA_FRIENDLY_NAME_MAX_LENGTH = 48;

export const validateMfaFriendlyName = (value: string): string | null => {
  const trimmedValue = value.trim();
  if (!trimmedValue) return 'Enter a name for this authenticator.';
  if (/\p{Cc}|\p{Cf}/u.test(trimmedValue))
    return 'Use a name without control or invisible formatting characters.';
  if ([...trimmedValue].length > MFA_FRIENDLY_NAME_MAX_LENGTH)
    return `Use ${MFA_FRIENDLY_NAME_MAX_LENGTH} characters or fewer.`;
  return null;
};

export const getTotpFactorDisplayName = (
  factor: Pick<Factor<'totp', 'verified'>, 'friendly_name' | 'created_at'>,
): string => {
  if (factor.friendly_name?.trim()) return factor.friendly_name.trim();
  const createdDate = factor.created_at?.slice(0, 10);
  return createdDate ? `Authenticator added ${createdDate}` : 'Unnamed authenticator';
};

export const retrieveMfaAssurance = async (): Promise<MfaAssurance> => {
  const { data, error } = await requireSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) throw new Error('Your security level could not be verified.');
  return data;
};

export const retrieveTotpFactors = async (): Promise<Factor<'totp', 'verified'>[]> => {
  const { data, error } = await requireSupabase().auth.mfa.listFactors();
  if (error || !data) throw new Error('Your authenticator apps could not be loaded.');
  return data.totp;
};

export const createTotpEnrollment = async (friendlyName: string): Promise<TotpEnrollment> => {
  const nameError = validateMfaFriendlyName(friendlyName);
  if (nameError) throw new Error(nameError);
  const client = requireSupabase();
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: friendlyName.trim(),
  });
  if (error?.code === 'mfa_factor_name_conflict')
    throw new Error('That name is already in use. Choose a different authenticator name.');
  if (error || !data) throw new Error('Authenticator setup could not be started.');
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
};

export const verifyTotpFactor = async (factorId: string, code: string): Promise<void> => {
  const { error } = await requireSupabase().auth.mfa.challengeAndVerify({ factorId, code });
  if (error)
    throw new Error('That verification code could not be confirmed. Check it and try again.');
};

const recoveryCodesUnavailable =
  'Recovery codes are not available in this environment. Keep a second authenticator and contact the test administrator if every authenticator is lost.';

const recoveryCodesEnabled =
  import.meta.env.DEV || import.meta.env.VITE_MFA_RECOVERY_CODES_ENABLED === 'true';

const requireRecoveryCodesEnabled = () => {
  if (!recoveryCodesEnabled) throw new Error(recoveryCodesUnavailable);
};

export const retrieveRecoveryCodesStatus = async (): Promise<RecoveryCodesStatus | null> => {
  requireRecoveryCodesEnabled();
  try {
    const { data, error } = await requireSupabase().auth.mfa.recoveryCodes.getStatus();
    if (error?.code === 'mfa_factor_not_found') return null;
    if (error || !data) throw new Error(recoveryCodesUnavailable);
    return { id: data.id, total: data.total, remaining: data.remaining };
  } catch (error) {
    if (error instanceof Error && error.message.includes('experimental'))
      throw new Error(recoveryCodesUnavailable, { cause: error });
    throw error;
  }
};

export const generateRecoveryCodes = async (): Promise<GeneratedRecoveryCodes> => {
  requireRecoveryCodesEnabled();
  const { data, error } = await requireSupabase().auth.mfa.recoveryCodes.generate();
  if (error || !data) throw new Error(recoveryCodesUnavailable);
  return { id: data.id, total: data.total, remaining: data.total, codes: data.codes };
};

export const regenerateRecoveryCodes = async (): Promise<GeneratedRecoveryCodes> => {
  requireRecoveryCodesEnabled();
  const { data, error } = await requireSupabase().auth.mfa.recoveryCodes.regenerate();
  if (error?.code === 'insufficient_aal')
    throw new Error('Verify with an authenticator before replacing recovery codes.');
  if (error || !data) throw new Error('Recovery codes could not be replaced. Try again later.');
  return { id: data.id, total: data.total, remaining: data.total, codes: data.codes };
};

export const verifyRecoveryCode = async (code: string): Promise<void> => {
  requireRecoveryCodesEnabled();
  const { error } = await requireSupabase().auth.mfa.recoveryCodes.verify({ code });
  if (error?.status === 429)
    throw new Error('Too many attempts. Wait before trying another recovery code.');
  if (error) throw new Error('That recovery code is invalid, expired, or has already been used.');
};

export const deleteTotpFactor = async (factorId: string): Promise<void> => {
  const { error } = await requireSupabase().auth.mfa.unenroll({ factorId });
  if (error?.code === 'mfa_factor_not_found')
    throw new Error('This authenticator is no longer available. Refresh and try again.');
  if (error) throw new Error('The authenticator app could not be removed.');
};

export const refreshMfaSessionAssurance = async (): Promise<MfaAssurance> => {
  const client = requireSupabase();
  const { error } = await client.auth.refreshSession();
  if (error) {
    await client.auth.signOut({ scope: 'local' });
    throw new Error('The authenticator was removed, but your session ended. Sign in again.');
  }
  return retrieveMfaAssurance();
};
