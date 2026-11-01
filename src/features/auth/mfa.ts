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
