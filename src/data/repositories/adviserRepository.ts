import type { AdviserData, AdviserGrant, AdviserSection } from '../../shared/types/domain';
import { requireSupabase } from '../supabase/client';

const throwWhenError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

const createToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
};

const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
};

export const createAdviserGrant = async (input: {
  email: string;
  dateFrom: string;
  dateTo: string;
  sections: AdviserSection[];
  startsAt: string;
  expiresAt: string;
  allowExport: boolean;
  renewedFromId?: string;
}) => {
  const token = createToken();
  const { data, error } = await requireSupabase().rpc('create_adviser_grant', {
    requested_email: input.email,
    requested_token_hash: await hashToken(token),
    requested_date_from: input.dateFrom,
    requested_date_to: input.dateTo,
    requested_sections: input.sections,
    requested_starts_at: input.startsAt,
    requested_expires_at: input.expiresAt,
    requested_allow_export: input.allowExport,
    requested_renewed_from_id: input.renewedFromId ?? null,
  });
  throwWhenError(error);
  return { id: data, token };
};

export const retrieveAdviserGrants = async (): Promise<AdviserGrant[]> => {
  const { data, error } = await requireSupabase().rpc('retrieve_adviser_grants');
  throwWhenError(error);
  return data ?? [];
};

export const respondToAdviserGrant = async (token: string, accept: boolean): Promise<string> => {
  const { data, error } = await requireSupabase().rpc('respond_to_adviser_grant', {
    requested_token: token,
    requested_accept: accept,
  });
  throwWhenError(error);
  if (!data) throw new Error('The adviser invitation could not be processed.');
  return data;
};

export const revokeAdviserGrant = async (id: string): Promise<void> => {
  const { error } = await requireSupabase().rpc('revoke_adviser_grant', {
    requested_grant_id: id,
  });
  throwWhenError(error);
};

export const retrieveAdviserData = async (id: string): Promise<AdviserData> => {
  const { data, error } = await requireSupabase().rpc('retrieve_adviser_data', {
    requested_grant_id: id,
  });
  throwWhenError(error);
  return data as AdviserData;
};
