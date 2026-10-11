import { Check, Copy, Eye, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  createSharedReport,
  retrieveMonthsForExport,
  retrieveSharedReports,
  revokeSharedReport,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart, formatMonth } from '../../shared/formatting/money';
import type { Profile, SharedReportRecord } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import {
  createSharedReportSnapshot,
  defaultSharedReportSelection,
  type SharedReportSelection,
  type SharedReportSnapshot,
} from './sharedReport';
import { SharedReportView } from './SharedReportView';

export const ShareReportForm = ({
  profile,
  onComplete,
}: {
  profile: Profile;
  onComplete: () => void;
}) => {
  const current = currentMonthStart().slice(0, 7);
  const [start, setStart] = useState(current);
  const [end, setEnd] = useState(current);
  const [selection, setSelection] = useState(defaultSharedReportSelection);
  const [expiryHours, setExpiryHours] = useState(168);
  const [maxViews, setMaxViews] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [preview, setPreview] = useState<SharedReportSnapshot | null>(null);
  const [reports, setReports] = useState<SharedReportRecord[]>([]);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void retrieveSharedReports()
      .then(setReports)
      .catch(() => undefined);
  }, []);
  const toggle = (key: keyof SharedReportSelection, checked: boolean) =>
    setSelection((currentSelection) => ({
      ...currentSelection,
      [key]: checked,
      ...(key === 'transactions' && !checked ? { transactionNames: false } : {}),
    }));
  const prepare = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (start > end) {
      setError('The start month must be before or equal to the end month.');
      return;
    }
    if (!Object.values(selection).some(Boolean)) {
      setError('Choose at least one report section.');
      return;
    }
    setBusy(true);
    try {
      const months = await retrieveMonthsForExport({
        fromMonth: `${start}-01`,
        toMonth: `${end}-01`,
      });
      if (!months.length) throw new Error('There are no budget months in this range.');
      const label =
        start === end
          ? formatMonth(`${start}-01`, profile.locale)
          : `${formatMonth(`${start}-01`, profile.locale)} to ${formatMonth(`${end}-01`, profile.locale)}`;
      setPreview(createSharedReportSnapshot(months, profile, label, selection));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The preview could not be created.');
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!preview) return;
    if (accessCode && accessCode.length < 6) {
      setError('The optional access code must contain at least 6 digits.');
      return;
    }
    if (maxViews && (!Number.isInteger(Number(maxViews)) || Number(maxViews) < 1)) {
      setError('The optional view limit must be a whole number greater than zero.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createSharedReport({
        snapshot: preview,
        expiryHours,
        maxViews: maxViews ? Number(maxViews) : null,
        accessCode,
      });
      const path = `${import.meta.env.BASE_URL}shared-report#${result.token}`;
      setShareUrl(new URL(path, window.location.origin).toString());
      setReports(await retrieveSharedReports());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The share could not be created.');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('The link could not be copied. Select and copy it manually.');
    }
  };
  const revoke = async (id: string) => {
    setBusy(true);
    try {
      await revokeSharedReport(id);
      setReports(await retrieveSharedReports());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The link could not be revoked.');
    } finally {
      setBusy(false);
    }
  };
  if (preview)
    return (
      <section className="share-report-preview">
        <SharedReportView snapshot={preview} />
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        {shareUrl ? (
          <div className="share-link-result">
            <p>
              <ShieldCheck size={18} /> Only someone with this link
              {accessCode ? ' and the access code' : ''} can open the snapshot.
            </p>
            <div>
              <input className="input" readOnly value={shareUrl} aria-label="Shared report link" />
              <Button
                variant="secondary"
                icon={copied ? <Check size={18} /> : <Copy size={18} />}
                onClick={() => void copy()}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="share-report-preview__actions">
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Back
            </Button>
            <Button loading={busy} onClick={() => void publish()}>
              Create private link
            </Button>
          </div>
        )}
      </section>
    );
  return (
    <div className="share-report-form">
      <form onSubmit={(event) => void prepare(event)}>
        <div className="form-grid">
          <FormField
            label="Start month"
            type="month"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
          <FormField
            label="End month"
            type="month"
            required
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
        <fieldset className="check-list">
          <legend>Information to include</legend>
          {(
            [
              ['totals', 'Monthly totals'],
              ['categories', 'Aggregated categories'],
              ['transactions', 'Transaction-level details'],
              ['transactionNames', 'Transaction names or descriptions'],
              ['notes', 'Notes'],
              ['goals', 'Goal data'],
            ] as const
          ).map(([key, label]) => (
            <label className="check-row" key={key}>
              <input
                type="checkbox"
                checked={selection[key]}
                disabled={key === 'transactionNames' && !selection.transactions}
                onChange={(event) => toggle(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p className="export-form__hint">
          The privacy-safe default includes totals and category aggregates. Transaction details,
          names, notes, and goals stay off until you choose them.
        </p>
        <div className="form-grid">
          <SelectField
            label="Link expires"
            value={expiryHours}
            onChange={(event) => setExpiryHours(Number(event.target.value))}
          >
            <option value={24}>After 24 hours</option>
            <option value={168}>After 7 days</option>
            <option value={720}>After 30 days</option>
            <option value={2160}>After 90 days</option>
          </SelectField>
          <FormField
            label="View limit (optional)"
            type="number"
            min="1"
            max="10000"
            value={maxViews}
            onChange={(event) => setMaxViews(event.target.value)}
          />
          <FormField
            label="Access code (optional, 6–12 digits)"
            inputMode="numeric"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 12))}
          />
        </div>
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        <Button type="submit" loading={busy} icon={<Eye size={18} />}>
          Preview exactly what will be shared
        </Button>
      </form>
      {reports.length > 0 && (
        <section className="share-report-list">
          <h3>Existing shared snapshots</h3>
          <ul>
            {reports.map((report) => (
              <li key={report.id}>
                <div>
                  <strong>{report.rangeLabel}</strong>
                  <small>
                    {report.revokedAt
                      ? 'Revoked'
                      : new Date(report.expiresAt) <= new Date()
                        ? 'Expired'
                        : `Active · ${report.viewCount}${report.maxViews ? ` of ${report.maxViews}` : ''} views`}
                  </small>
                </div>
                {!report.revokedAt && new Date(report.expiresAt) > new Date() && (
                  <Button
                    variant="danger"
                    disabled={busy}
                    icon={<Trash2 size={16} />}
                    onClick={() => void revoke(report.id)}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <Button variant="ghost" onClick={onComplete}>
        Done
      </Button>
    </div>
  );
};
