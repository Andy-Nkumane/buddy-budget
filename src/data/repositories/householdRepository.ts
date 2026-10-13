import type { HouseholdContext, HouseholdRole } from '../../shared/types/domain';
import { requireSupabase } from '../supabase/client';

const throwWhenError = (error: { message: string } | null): void => {
  if (error) throw new Error(error.message);
};

export const retrieveHouseholdContext = async (): Promise<HouseholdContext> => {
  const { data, error } = await requireSupabase().rpc('retrieve_household_context');
  throwWhenError(error);
  if (!data?.active_household_id) throw new Error('No household is available for this account.');
  return data;
};

export const switchHousehold = async (householdId: string): Promise<void> => {
  const { error } = await requireSupabase().rpc('switch_household', {
    requested_household_id: householdId,
  });
  throwWhenError(error);
};

export const updateHouseholdName = async (name: string): Promise<void> => {
  const { error } = await requireSupabase().rpc('update_household_name', {
    requested_name: name,
  });
  throwWhenError(error);
};

export const createHouseholdInvitation = async (email: string, role: HouseholdRole) => {
  const { data, error } = await requireSupabase().rpc('create_household_invitation', {
    requested_email: email,
    requested_role: role,
  });
  throwWhenError(error);
  const invitation = data?.[0];
  if (!invitation) throw new Error('The invitation could not be created.');
  return invitation;
};

export const respondToHouseholdInvitation = async (token: string, accept: boolean) => {
  const { data, error } = await requireSupabase().rpc('respond_to_household_invitation', {
    requested_token: token,
    requested_accept: accept,
  });
  throwWhenError(error);
  return data;
};

export const revokeHouseholdInvitation = async (invitationId: string): Promise<void> => {
  const { error } = await requireSupabase().rpc('revoke_household_invitation', {
    requested_invitation_id: invitationId,
  });
  throwWhenError(error);
};

export const manageHouseholdMember = async (
  action: 'leave' | 'remove' | 'role' | 'transfer',
  userId: string,
  role?: HouseholdRole,
): Promise<void> => {
  const { error } = await requireSupabase().rpc('manage_household_member', {
    requested_action: action,
    requested_user_id: userId,
    requested_role: role ?? null,
  });
  throwWhenError(error);
};
