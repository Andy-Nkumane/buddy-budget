import { Check, Copy, Eye, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createAdviserGrant,
  retrieveAdviserGrants,
  revokeAdviserGrant,
} from '../../data/repositories/adviserRepository';
import type { AdviserGrant, AdviserSection } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';

const sectionOptions: Array<{ value: AdviserSection; label: string }> = [
  { value: 'summary', label: 'Monthly summary' },
  { value: 'categories', label: 'Category totals' },
  { value: 'transactions', label: 'Transaction details' },
  { value: 'schedules', label: 'Payment schedules' },
  { value: 'goals', label: 'Goal progress' },
];

const dateOnly = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const localDateTime = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const getRenewalTimes = () => {
  const current = new Date();
  return {
    startsAt: current.toISOString(),
    expiresAt: new Date(current.getTime() + 7 * 86_400_000).toISOString(),
  };
};

export const AdviserReportLinks = () => {
  const navigate = useNavigate();
  const [grants, setGrants] = useState<AdviserGrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void retrieveAdviserGrants()
      .then((retrieved) => {
        const currentTime = Date.now();
        setGrants(
          retrieved.filter(
            (grant) =>
              !grant.isOwner &&
              grant.acceptedAt &&
              !grant.revokedAt &&
              new Date(grant.startsAt).getTime() <= currentTime &&
              new Date(grant.expiresAt).getTime() > currentTime,
          ),
        );
      })
      .catch(() => setError('Adviser reports could not be loaded.'));
  }, []);

  if (!grants.length && !error) return null;
  return (
    <section className="settings-card adviser-report-links" aria-labelledby="adviser-reports-title">
      <div>
        <p className="eyebrow">Read-only adviser access</p>
        <h2 id="adviser-reports-title">Adviser reports</h2>
        <p>Open the household reports that have been shared with you.</p>
      </div>
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {grants.map((grant) => (
        <article className="adviser-report-card" key={grant.id}>
          <div>
            <strong>{grant.householdName}</strong>
            <small>
              {grant.dateFrom} to {grant.dateTo}
            </small>
            <small>Expires {new Date(grant.expiresAt).toLocaleString()}</small>
          </div>
          <Button
            variant="secondary"
            icon={<Eye size={16} />}
            onClick={() => void navigate(`/app/adviser?grant=${grant.id}`)}
          >
            View report
          </Button>
        </article>
      ))}
    </section>
  );
};

export const AdviserAccessPanel = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [email, setEmail] = useState('');
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-01-01`);
  const [dateTo, setDateTo] = useState(dateOnly(now));
  const [startsAt, setStartsAt] = useState(localDateTime(now));
  const [expiresAt, setExpiresAt] = useState(
    localDateTime(new Date(now.getTime() + 7 * 86_400_000)),
  );
  const [sections, setSections] = useState<AdviserSection[]>(['summary']);
  const [allowExport, setAllowExport] = useState(false);
  const [grants, setGrants] = useState<AdviserGrant[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () =>
    setGrants((await retrieveAdviserGrants()).filter((grant) => grant.isOwner));
  useEffect(() => {
    void retrieveAdviserGrants()
      .then((retrieved) => setGrants(retrieved.filter((grant) => grant.isOwner)))
      .catch(() => setError('Adviser grants could not be loaded.'));
  }, []);

  const submit = async (renewedFromId?: string, renewedGrant?: AdviserGrant) => {
    setBusy(true);
    setError(null);
    try {
      const renewalTimes = renewedGrant ? getRenewalTimes() : null;
      const created = await createAdviserGrant({
        email: renewedGrant?.adviserEmail ?? email,
        dateFrom: renewedGrant?.dateFrom ?? dateFrom,
        dateTo: renewedGrant?.dateTo ?? dateTo,
        sections: renewedGrant?.sections ?? sections,
        startsAt: renewalTimes?.startsAt ?? new Date(startsAt).toISOString(),
        expiresAt: renewalTimes?.expiresAt ?? new Date(expiresAt).toISOString(),
        allowExport: renewedGrant?.allowExport ?? allowExport,
        renewedFromId,
      });
      setInviteUrl(
        `${window.location.origin}${import.meta.env.BASE_URL}app/adviser#${created.token}`,
      );
      setCopied(false);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Adviser access could not be created.');
    } finally {
      setBusy(false);
    }
  };

  const renew = (grant: AdviserGrant) => {
    const renewalTimes = getRenewalTimes();
    setEmail(grant.adviserEmail);
    setDateFrom(grant.dateFrom);
    setDateTo(grant.dateTo);
    setSections(grant.sections);
    setAllowExport(grant.allowExport);
    setStartsAt(localDateTime(new Date(renewalTimes.startsAt)));
    setExpiresAt(localDateTime(new Date(renewalTimes.expiresAt)));
    void submit(grant.id, grant);
  };

  return (
    <section className="settings-card adviser-access" aria-labelledby="adviser-access-title">
      <div>
        <p className="eyebrow">Time-limited and read only</p>
        <h2 id="adviser-access-title">Adviser access</h2>
        <p>
          Share only the dates and sections an adviser needs. Seven days and summary-only are the
          defaults.
        </p>
      </div>
      <div className="adviser-access__dates">
        <FormField
          label="Adviser email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormField
          label="Data from"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <FormField
          label="Data to"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
        <FormField
          label="Access starts"
          type="datetime-local"
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
        <FormField
          label="Access expires"
          type="datetime-local"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
      </div>
      <fieldset className="adviser-access__scope">
        <legend>Visible sections</legend>
        {sectionOptions.map((option) => (
          <label className="check-row" key={option.value}>
            <input
              type="checkbox"
              checked={sections.includes(option.value)}
              onChange={(event) =>
                setSections((current) =>
                  event.target.checked
                    ? [...current, option.value]
                    : current.filter((value) => value !== option.value),
                )
              }
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="check-row">
        <input
          type="checkbox"
          checked={allowExport}
          onChange={(event) => setAllowExport(event.target.checked)}
        />
        <span>
          <strong>Allow scoped JSON export</strong>
          <small>Export contains only the selected dates and sections.</small>
        </span>
      </label>
      {allowExport && (
        <div className="inline-alert inline-alert--warning" role="alert">
          The adviser can download and retain the approved data after access expires.
        </div>
      )}
      <Button
        icon={<ShieldCheck size={18} />}
        loading={busy}
        disabled={!email.trim() || !sections.length}
        onClick={() => void submit()}
      >
        Create adviser invitation
      </Button>
      {inviteUrl && (
        <div className="inline-alert" role="status">
          <code>{inviteUrl}</code>
          <Button
            variant="secondary"
            icon={copied ? <Check size={16} /> : <Copy size={16} />}
            onClick={() =>
              void navigator.clipboard
                .writeText(inviteUrl)
                .then(() => setCopied(true))
                .catch(() => setError('Copy failed. Select the link manually.'))
            }
          >
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      )}
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {grants.length > 0 && (
        <div className="adviser-grant-list">
          <h3>Grant history</h3>
          {grants.map((grant) => (
            <article key={grant.id} className="adviser-grant">
              <div>
                <strong>{grant.adviserEmail}</strong>
                <small>
                  {grant.sections.join(', ')} · {grant.dateFrom} to {grant.dateTo}
                </small>
                <small>
                  {grant.lastAccessedAt
                    ? `Last accessed ${new Date(grant.lastAccessedAt).toLocaleString()} · ${grant.accessCount} recorded access day(s)`
                    : 'Not accessed'}
                </small>
                <details className="adviser-grant__audit">
                  <summary>View audit history</summary>
                  <ol>
                    {grant.events.map((event) => (
                      <li key={`${event.action}-${event.createdAt}`}>
                        {event.actor} {event.action} this grant{' '}
                        <time dateTime={event.createdAt}>
                          {new Date(event.createdAt).toLocaleString()}
                        </time>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
              <span>
                {grant.revokedAt
                  ? 'Revoked'
                  : new Date(grant.expiresAt) <= new Date()
                    ? 'Expired'
                    : grant.acceptedAt
                      ? 'Active'
                      : 'Pending'}
              </span>
              <div>
                <Button
                  variant="secondary"
                  icon={<Eye size={16} />}
                  onClick={() => void navigate(`/app/adviser?grant=${grant.id}`)}
                >
                  View report
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => renew(grant)}>
                  Renew
                </Button>
                {!grant.revokedAt && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      void revokeAdviserGrant(grant.id)
                        .then(refresh)
                        .catch((reason: Error) => setError(reason.message))
                    }
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
