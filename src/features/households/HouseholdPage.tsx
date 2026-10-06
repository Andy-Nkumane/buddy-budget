import { useState } from 'react';
import { Check, Copy, MailPlus, ShieldCheck, UserMinus } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { useHousehold } from '../../app/providers/HouseholdProvider';
import {
  createHouseholdInvitation,
  manageHouseholdMember,
  revokeHouseholdInvitation,
  updateHouseholdName,
} from '../../data/repositories/householdRepository';
import type { HouseholdRole } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';

const HouseholdNameForm = ({
  name,
  refresh,
  reportError,
}: {
  name: string;
  refresh: () => Promise<void>;
  reportError: (message: string | null) => void;
}) => {
  const [householdName, setHouseholdName] = useState(name);
  const [saving, setSaving] = useState(false);

  const rename = async () => {
    reportError(null);
    setSaving(true);
    try {
      await updateHouseholdName(householdName);
      await refresh();
    } catch (renameError) {
      reportError(
        renameError instanceof Error ? renameError.message : 'The name could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings-card household-name" aria-labelledby="household-name-title">
      <div>
        <h2 id="household-name-title">Household name</h2>
        <p>Use a recognisable name so members can distinguish this budget in the switcher.</p>
      </div>
      <div className="household-name__controls">
        <FormField
          label="Name"
          value={householdName}
          maxLength={80}
          onChange={(event) => setHouseholdName(event.target.value)}
        />
        <Button
          loading={saving}
          disabled={!householdName.trim() || householdName.trim() === name}
          onClick={() => void rename()}
        >
          Save name
        </Button>
      </div>
    </section>
  );
};

export const HouseholdPage = () => {
  const { session } = useAuth();
  const household = useHousehold();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<HouseholdRole, 'owner'>>('editor');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = household.context?.households.find(
    (entry) => entry.id === household.context?.active_household_id,
  );
  const isOwner = active?.role === 'owner';

  if (household.loading) return <LoadingState label="Loading household…" />;
  if (household.error || !household.context)
    return (
      <ErrorState message={household.error?.message ?? 'Household details are unavailable.'} />
    );

  const invite = async () => {
    setError(null);
    setWorking(true);
    try {
      const created = await createHouseholdInvitation(email, role);
      setInviteUrl(
        `${window.location.origin}${import.meta.env.BASE_URL}app/household/invite?token=${encodeURIComponent(created.invitation_token)}`,
      );
      setCopied(false);
      setEmail('');
      await household.refresh();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'The invitation failed.');
    } finally {
      setWorking(false);
    }
  };

  const copyInvitation = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError('The link could not be copied. Select and copy it manually.');
    }
  };

  const manage = async (
    action: 'leave' | 'remove' | 'role' | 'transfer',
    userId: string,
    nextRole?: HouseholdRole,
  ) => {
    if (
      action === 'transfer' &&
      !window.confirm('Transfer household ownership? You will become an editor.')
    )
      return;
    if (action === 'remove' && !window.confirm('Remove this person from the household now?'))
      return;
    setError(null);
    setWorking(true);
    try {
      await manageHouseholdMember(action, userId, nextRole);
      await household.refresh();
    } catch (manageError) {
      setError(
        manageError instanceof Error ? manageError.message : 'The member could not be updated.',
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="page household-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Plan together</p>
          <h1>{active?.name ?? 'Household'}</h1>
          <p>Your role is {active?.role}. Permissions are enforced for every database request.</p>
        </div>
      </header>
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {isOwner && (
        <HouseholdNameForm
          key={active.id}
          name={active.name}
          refresh={household.refresh}
          reportError={setError}
        />
      )}
      {isOwner && (
        <section className="settings-card household-invite" aria-labelledby="invite-title">
          <div>
            <h2 id="invite-title">Invite a partner</h2>
            <p>Invitations expire after seven days and work once for the verified email address.</p>
          </div>
          <div className="household-invite__fields">
            <FormField
              label="Email address"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <SelectField
              label="Role"
              value={role}
              onChange={(event) => setRole(event.target.value as Exclude<HouseholdRole, 'owner'>)}
            >
              <option value="editor">Editor — can update budgets</option>
              <option value="viewer">Viewer — read only</option>
            </SelectField>
          </div>
          <Button
            icon={<MailPlus size={18} />}
            loading={working}
            disabled={!email.trim()}
            onClick={() => void invite()}
          >
            Create invitation
          </Button>
          {inviteUrl && (
            <div className="inline-alert" role="status">
              <span>Send this private, single-use link to the invited person.</span>
              <code className="household-invite__link">{inviteUrl}</code>
              <Button
                variant="secondary"
                icon={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={() => void copyInvitation()}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <span aria-live="polite">{copied ? 'Invitation link copied to clipboard.' : ''}</span>
            </div>
          )}
        </section>
      )}
      <section className="settings-card" aria-labelledby="members-title">
        <h2 id="members-title">Members</h2>
        <div className="household-member-list">
          {household.context.members.map((member) => (
            <article className="household-member" key={member.user_id}>
              <div>
                <strong>{member.display_name}</strong>
                <small>{member.role}</small>
              </div>
              {isOwner && member.role !== 'owner' && (
                <div className="household-member__actions">
                  <select
                    aria-label={`Role for ${member.display_name}`}
                    value={member.role}
                    disabled={working}
                    onChange={(event) =>
                      void manage('role', member.user_id, event.target.value as HouseholdRole)
                    }
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button
                    variant="ghost"
                    onClick={() => void manage('transfer', member.user_id)}
                    disabled={working}
                  >
                    Transfer ownership
                  </Button>
                  <Button
                    variant="danger"
                    icon={<UserMinus size={16} />}
                    onClick={() => void manage('remove', member.user_id)}
                    disabled={working}
                  >
                    Remove
                  </Button>
                </div>
              )}
              {!isOwner && member.user_id === session?.user.id && (
                <Button
                  variant="secondary"
                  onClick={() => void manage('leave', member.user_id)}
                  disabled={working}
                >
                  Leave household
                </Button>
              )}
            </article>
          ))}
        </div>
      </section>
      {isOwner && household.context.invitations.length > 0 && (
        <section className="settings-card">
          <h2>Pending invitations</h2>
          {household.context.invitations.map((invitation) => (
            <div className="household-member" key={invitation.id}>
              <div>
                <strong>{invitation.email}</strong>
                <small>
                  {invitation.role} · expires {new Date(invitation.expires_at).toLocaleDateString()}
                </small>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  void revokeHouseholdInvitation(invitation.id)
                    .then(household.refresh)
                    .catch((reason: Error) => setError(reason.message))
                }
              >
                Revoke
              </Button>
            </div>
          ))}
        </section>
      )}
      <section className="settings-card">
        <h2>
          <ShieldCheck size={20} /> Recent household activity
        </h2>
        {household.context.activity.length ? (
          <ol className="household-activity">
            {household.context.activity.map((entry) => (
              <li key={entry.id}>
                <strong>
                  {household.context?.members.find(
                    (member) => member.user_id === entry.actor_user_id,
                  )?.display_name ?? 'Former member'}
                </strong>{' '}
                {entry.action} {entry.entity_type.replaceAll('_', ' ')}
                <time dateTime={entry.created_at}>
                  {new Date(entry.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">No shared changes yet.</p>
        )}
      </section>
    </section>
  );
};
