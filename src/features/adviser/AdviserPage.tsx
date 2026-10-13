import { ArrowLeft, Download, Eye, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  respondToAdviserGrant,
  retrieveAdviserData,
  retrieveAdviserGrants,
} from '../../data/repositories/adviserRepository';
import type { AdviserData, AdviserGrant, AdviserSection } from '../../shared/types/domain';
import { formatMoney, formatMonth, minorUnitsToMoney } from '../../shared/formatting/money';
import { downloadJson } from '../../shared/utilities/download';
import { Button } from '../../shared/ui/Button';
import { BrandMark } from '../../shared/ui/BrandMark';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';

const AdviserSectionTable = ({
  section,
  title,
  rows,
  currencyCode,
}: {
  section: Exclude<AdviserSection, 'summary'>;
  title: string;
  rows: Array<Record<string, unknown>>;
  currencyCode: string;
}) => {
  const fields: Record<Exclude<AdviserSection, 'summary'>, Array<[string, string]>> = {
    categories: [
      ['name', 'Category'],
      ['type', 'Type'],
      ['actualMinor', 'Actual'],
    ],
    transactions: [
      ['date', 'Date'],
      ['description', 'Description'],
      ['type', 'Type'],
      ['category', 'Category'],
      ['status', 'Status'],
      ['amountMinor', 'Amount'],
    ],
    schedules: [
      ['name', 'Schedule'],
      ['type', 'Type'],
      ['recurrence', 'Repeats'],
      ['nextOccurrence', 'Next occurrence'],
      ['approximate', 'Amount type'],
      ['amountMinor', 'Amount'],
    ],
    goals: [
      ['name', 'Goal'],
      ['type', 'Type'],
      ['status', 'Status'],
      ['targetDate', 'Target date'],
      ['targetAmountMinor', 'Target'],
      ['currentBalanceMinor', 'Current balance'],
    ],
  };
  const descriptions: Record<Exclude<AdviserSection, 'summary'>, string> = {
    categories: 'Posted spending and income grouped by category.',
    transactions: 'Transactions within the approved date range.',
    schedules: 'Upcoming scheduled income and expenses within the approved date range.',
    goals: 'Goals active during the approved date range.',
  };
  const formatValue = (key: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (key.endsWith('Minor') && typeof value === 'number')
      return formatMoney(minorUnitsToMoney(value), currencyCode);
    if (
      (key === 'date' || key.endsWith('Date') || key === 'nextOccurrence') &&
      typeof value === 'string'
    )
      return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(`${value}T00:00:00Z`),
      );
    if (key === 'approximate' && typeof value === 'boolean') return value ? 'Approximate' : 'Fixed';
    if (typeof value === 'string')
      return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
    return typeof value === 'number' || typeof value === 'boolean' ? String(value) : '—';
  };

  return (
    <section className="settings-card adviser-data-section">
      <div className="adviser-data-section__heading">
        <h2>{title}</h2>
        <p>{descriptions[section]}</p>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {fields[section].map(([key, label]) => (
                  <th key={key}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {fields[section].map(([key, label]) => (
                    <td data-label={label} key={key}>
                      {formatValue(key, row[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No {title.toLowerCase()} are available in the approved range.</p>
      )}
    </section>
  );
};

const AdviserSummary = ({ rows }: { rows: Array<Record<string, string | number>> }) => {
  const formatAmount = (row: Record<string, string | number>, key: string) => {
    const value = row[key];
    const currency = typeof row.currencyCode === 'string' ? row.currencyCode : 'ZAR';
    return typeof value === 'number' ? formatMoney(minorUnitsToMoney(value), currency) : '—';
  };

  return (
    <section className="settings-card adviser-summary">
      <div className="adviser-summary__heading">
        <div>
          <p className="eyebrow">Approved financial overview</p>
          <h2>Summary</h2>
        </div>
        <span>Planned compared with posted actuals</span>
      </div>
      {rows.length ? (
        <div className="adviser-summary__months">
          {rows.map((row) => {
            const monthStart = typeof row.monthStart === 'string' ? row.monthStart : '';
            const currency = typeof row.currencyCode === 'string' ? row.currencyCode : '';
            return (
              <article className="adviser-summary__month" key={`${monthStart}-${currency}`}>
                <header>
                  <h3>{monthStart ? formatMonth(monthStart) : 'Budget month'}</h3>
                  {currency && <span>{currency}</span>}
                </header>
                <div className="adviser-summary__groups">
                  <div>
                    <strong>Income</strong>
                    <dl>
                      <div>
                        <dt>Planned</dt>
                        <dd>{formatAmount(row, 'plannedIncomeMinor')}</dd>
                      </div>
                      <div>
                        <dt>Actual</dt>
                        <dd>{formatAmount(row, 'actualIncomeMinor')}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <strong>Expenses</strong>
                    <dl>
                      <div>
                        <dt>Planned</dt>
                        <dd>{formatAmount(row, 'plannedExpensesMinor')}</dd>
                      </div>
                      <div>
                        <dt>Actual</dt>
                        <dd>{formatAmount(row, 'actualExpensesMinor')}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">No monthly summaries are available in the approved range.</p>
      )}
    </section>
  );
};

export const AdviserPage = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const token = location.hash.slice(1);
  const requestedGrantId = new URLSearchParams(location.search).get('grant');
  const [grants, setGrants] = useState<AdviserGrant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState<AdviserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const currentTime = Date.now();
    const next = (await retrieveAdviserGrants()).filter(
      (grant) =>
        !grant.isOwner &&
        grant.acceptedAt &&
        !grant.revokedAt &&
        new Date(grant.startsAt).getTime() <= currentTime &&
        new Date(grant.expiresAt).getTime() > currentTime,
    );
    setGrants(next);
    setSelectedId((current) => current || next[0]?.id || '');
  };

  useEffect(() => {
    void retrieveAdviserGrants()
      .then((retrieved) => {
        const currentTime = Date.now();
        const next = retrieved.filter(
          (grant) =>
            !grant.isOwner &&
            grant.acceptedAt &&
            !grant.revokedAt &&
            new Date(grant.startsAt).getTime() <= currentTime &&
            new Date(grant.expiresAt).getTime() > currentTime,
        );
        setGrants(next);
        setSelectedId(
          requestedGrantId && retrieved.some((grant) => grant.id === requestedGrantId)
            ? requestedGrantId
            : '',
        );
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [requestedGrantId]);

  useEffect(() => {
    if (!selectedId) return;
    void retrieveAdviserData(selectedId)
      .then(setData)
      .catch((reason: Error) => setError(reason.message));
  }, [selectedId]);

  const respond = async (accept: boolean) => {
    if (!token) return;
    setWorking(true);
    setError(null);
    try {
      const grantId = await respondToAdviserGrant(token, accept);
      await refresh();
      setSelectedId(accept ? grantId : '');
      void navigate('/app/adviser', { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The adviser invitation could not be processed.',
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <LoadingState label="Loading adviser access…" />;
  return (
    <div className="adviser-mode">
      <header className="adviser-mode__header">
        <BrandMark />
        <div>
          <strong>Buddy Budget adviser mode</strong>
          <small>Authenticated · time-limited · read only</small>
        </div>
        <Button variant="ghost" icon={<LogOut size={17} />} onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>
      <main className="page adviser-mode__main">
        <aside className="adviser-mode__banner" role="status">
          <Eye aria-hidden="true" />
          <div>
            <strong>You are viewing approved household data</strong>
            <p>
              You cannot edit, add, delete, reshare, or export unless the owner explicitly enabled a
              scoped export.
            </p>
          </div>
        </aside>
        {token && (
          <section className="settings-card">
            <p className="eyebrow">Adviser invitation</p>
            <h1>Accept read-only access?</h1>
            <p>
              Access is limited to the dates, sections, and expiry selected by the household owner.
            </p>
            <div className="modal-form__actions">
              <Button variant="secondary" disabled={working} onClick={() => void respond(false)}>
                Decline
              </Button>
              <Button
                loading={working}
                icon={<ShieldCheck size={17} />}
                onClick={() => void respond(true)}
              >
                Accept access
              </Button>
            </div>
          </section>
        )}
        {error && <ErrorState message={error} />}
        {!token && grants.length === 0 && !selectedId && (
          <section className="settings-card">
            <h1>No active adviser access</h1>
            <p>Ask the household owner for a new invitation if a grant expired or was revoked.</p>
          </section>
        )}
        {!token && grants.length > 0 && !selectedId && (
          <>
            <section className="settings-card adviser-report-list">
              <div>
                <p className="eyebrow">Available reports</p>
                <h1>Your adviser grants</h1>
              </div>
              <div className="adviser-report-list__cards">
                {grants.map((grant) => (
                  <article
                    className={`adviser-report-card${selectedId === grant.id ? ' adviser-report-card--selected' : ''}`}
                    key={grant.id}
                  >
                    <div>
                      <strong>{grant.householdName}</strong>
                      <small>
                        {grant.dateFrom} to {grant.dateTo}
                      </small>
                      <small>Expires {new Date(grant.expiresAt).toLocaleString()}</small>
                    </div>
                    <Button
                      variant="secondary"
                      icon={<Eye size={17} />}
                      onClick={() => {
                        setError(null);
                        setSelectedId(grant.id);
                      }}
                    >
                      View report
                    </Button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        {!token && selectedId && data && (
          <>
            <section className="adviser-report-toolbar">
              <Button
                variant="ghost"
                icon={<ArrowLeft size={17} />}
                onClick={() => {
                  setData(null);
                  setSelectedId('');
                  void navigate(requestedGrantId ? '/app/household' : '/app/adviser');
                }}
              >
                {requestedGrantId ? 'Back to household' : 'All reports'}
              </Button>
              {data.allowExport && (
                <Button
                  icon={<Download size={17} />}
                  onClick={() =>
                    downloadJson(`adviser-scope-${data.dateFrom}-${data.dateTo}.json`, data)
                  }
                >
                  Download approved JSON
                </Button>
              )}
            </section>
            <section className="adviser-scope-summary">
              <strong>Approved range</strong>
              <span>
                {data.dateFrom} to {data.dateTo}
              </span>
              <span>Expires {new Date(data.expiresAt).toLocaleString()}</span>
            </section>
            {data.sections.map((section) =>
              section === 'summary' ? (
                <AdviserSummary key={section} rows={data.summary ?? []} />
              ) : (
                <AdviserSectionTable
                  key={section}
                  section={section}
                  title={section[0].toUpperCase() + section.slice(1)}
                  rows={(data[section] ?? []) as Array<Record<string, unknown>>}
                  currencyCode={data.currencyCode}
                />
              ),
            )}
          </>
        )}
      </main>
    </div>
  );
};
