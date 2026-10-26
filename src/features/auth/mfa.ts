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

export const createTotpEnrollment = async (): Promise<TotpEnrollment> => {
  const client = requireSupabase();
  const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError || !factorData) throw new Error('Authenticator setup could not be started.');
  const totpCount = factorData.all.filter((factor) => factor.factor_type === 'totp').length;
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator app ${totpCount + 1}`,
  });
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
  if (error) throw new Error('The authenticator app could not be removed.');
};
