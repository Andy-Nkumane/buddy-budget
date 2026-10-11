import { Download, LockKeyhole, Printer } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { retrievePublicSharedReport } from '../../data/repositories/budgetRepository';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { BrandMark } from '../../shared/ui/BrandMark';
import type { SharedReportSnapshot } from './sharedReport';
import { SharedReportView } from './SharedReportView';

const downloadPdf = async (snapshot: SharedReportSnapshot) => {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ unit: 'pt', format: 'a4' });
  const lines = [
    snapshot.title,
    snapshot.rangeLabel,
    `Snapshot: ${snapshot.snapshotAt}`,
    `Omitted: ${snapshot.omitted.join(', ') || 'None'}`,
  ];
  snapshot.months.forEach((month) => {
    lines.push('', month.monthStart, `Currency: ${month.currencyCode}`);
    if (month.totals)
      lines.push(
        `Planned income: ${month.totals.plannedIncomeMinor / 100}`,
        `Actual income: ${month.totals.actualIncomeMinor / 100}`,
        `Planned expenses: ${month.totals.plannedExpenseMinor / 100}`,
        `Actual expenses: ${month.totals.actualExpenseMinor / 100}`,
        `Actual remaining: ${month.totals.remainingMinor / 100}`,
      );
    month.categories?.forEach((category) =>
      lines.push(
        `${category.name} (${category.itemType}): planned ${category.plannedMinor / 100}, actual ${category.actualMinor / 100}`,
      ),
    );
    month.transactions?.forEach((transaction) =>
      lines.push(
        `${transaction.date} · ${transaction.name ?? 'Transaction'} · ${transaction.category} · ${transaction.amountMinor / 100}${transaction.notes ? ` · ${transaction.notes}` : ''}`,
      ),
    );
    month.goals?.forEach((goal) =>
      lines.push(`Goal: ${goal.name} · ${goal.type} · ${goal.recommendedMinor / 100}`),
    );
    if (month.notes) lines.push(`Note: ${month.notes}`);
  });
  const wrapped = lines.flatMap((line) =>
    line.length ? (line.match(/.{1,80}(?:\s|$)/g) ?? [line]).map((part) => part.trim()) : [''],
  );
  let y = 48;
  wrapped.forEach((line: string) => {
    if (y > 790) {
      document.addPage();
      y = 48;
    }
    document.text(line, 40, y);
    y += 16;
  });
  document.save('buddy-budget-shared-report.pdf');
};

export const SharedReportPage = () => {
  const token = window.location.hash.slice(1);
  const [accessCode, setAccessCode] = useState('');
  const [snapshot, setSnapshot] = useState<SharedReportSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [unavailable, setUnavailable] = useState(!token);
  const [accessCodeRequired, setAccessCodeRequired] = useState(false);

  const load = useCallback(
    async (code = '') => {
      setLoading(true);
      setUnavailable(false);
      setAccessCodeRequired(false);
      try {
        const result = await retrievePublicSharedReport(token, code);
        if ('accessCodeRequired' in result) {
          setAccessCodeRequired(true);
          return;
        }
        setSnapshot(result.snapshot);
        document.title = `${result.snapshot.rangeLabel} | Buddy Budget`;
      } catch {
        setUnavailable(true);
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute('content', 'noindex, nofollow, noarchive');
    let referrer = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    if (!referrer) {
      referrer = document.createElement('meta');
      referrer.name = 'referrer';
      document.head.append(referrer);
    }
    referrer.content = 'no-referrer';
    if (token) queueMicrotask(() => void load());
  }, [load, token]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(accessCode);
  };
  return (
    <main className="shared-report-page">
      <header className="public-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <BrandMark />
          <span>Buddy Budget</span>
        </a>
        <span className="shared-report-page__privacy">
          <LockKeyhole size={16} /> Private snapshot
        </span>
      </header>
      {loading && <p role="status">Opening the shared report…</p>}
      {!loading && snapshot && (
        <>
          <SharedReportView snapshot={snapshot} />
          <div className="shared-report-page__actions">
            <Button variant="secondary" icon={<Printer size={18} />} onClick={() => window.print()}>
              Print
            </Button>
            <Button icon={<Download size={18} />} onClick={() => void downloadPdf(snapshot)}>
              Download PDF
            </Button>
          </div>
        </>
      )}
      {!loading && unavailable && !snapshot && (
        <section className="shared-report-unavailable">
          <LockKeyhole size={32} />
          <h1>This shared report is unavailable</h1>
          <p>The link may have expired, been revoked, or reached its view limit.</p>
        </section>
      )}
      {!loading && accessCodeRequired && !snapshot && (
        <section className="shared-report-unavailable">
          <LockKeyhole size={32} />
          <h1>Enter the access code</h1>
          <p>This report's owner protected it with an access code.</p>
          <form onSubmit={submit}>
            <FormField
              label="Access code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={accessCode}
              onChange={(event) =>
                setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 12))
              }
            />
            <Button type="submit" disabled={accessCode.length < 6}>
              Open report
            </Button>
          </form>
        </section>
      )}
    </main>
  );
};
