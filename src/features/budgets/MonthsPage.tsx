import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, Download } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  retrieveMonthById,
  retrieveProfile,
  searchMonths,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart, formatMoney, formatMonth } from '../../shared/formatting/money';
import type { BudgetMonthWithItems } from '../../shared/types/domain';
import {
  downloadBudgetReportPdf,
  downloadJson,
  downloadMonthCsv,
} from '../../shared/utilities/download';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { BudgetReportPreview } from '../reports/BudgetReportPreview';

type MonthExportFormat = 'csv' | 'json' | 'pdf';

export const MonthsPage = () => {
  const months = useQuery({ queryKey: ['months'], queryFn: searchMonths });
  const profile = useQuery({ queryKey: ['profile'], queryFn: retrieveProfile });
  const [exportFormats, setExportFormats] = useState<Record<string, MonthExportFormat>>({});
  const [reportMonth, setReportMonth] = useState<BudgetMonthWithItems | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  if (months.isLoading || profile.isLoading) return <LoadingState label="Gathering your months…" />;
  if (months.error || profile.error)
    return (
      <ErrorState
        message={(months.error ?? profile.error)?.message ?? 'Month history is unavailable.'}
        retry={() => void months.refetch()}
      />
    );
  const locale = profile.data?.locale ?? 'en-ZA';
  const current = currentMonthStart();
  const exportMonth = async (id: string) => {
    setExportError(null);
    setExportingId(id);
    try {
      const month = await retrieveMonthById(id);
      if (!month) throw new Error('That budget month is unavailable.');
      const format = exportFormats[id] ?? 'pdf';
      if (format === 'csv') {
        downloadMonthCsv(month);
      } else if (format === 'json') {
        downloadJson(`buddybudget-${month.month_start.slice(0, 7)}.json`, month);
      } else {
        setReportMonth(month);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The month could not be exported.');
    } finally {
      setExportingId(null);
    }
  };

  const downloadReport = async () => {
    if (!reportMonth || !profile.data) return;
    setExportError(null);
    setExportingId(reportMonth.id);
    try {
      await downloadBudgetReportPdf(
        [reportMonth],
        profile.data,
        formatMonth(reportMonth.month_start, locale),
        reportMonth.month_start.slice(0, 7),
      );
      setReportMonth(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The PDF could not be downloaded.');
    } finally {
      setExportingId(null);
    }
  };
  return (
    <section className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Look back clearly</p>
          <h1>Month history</h1>
          <p>Every month is an independent snapshot of the plan you had at the time.</p>
        </div>
      </header>
      {exportError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {exportError}
        </div>
      )}
      {months.data?.length ? (
        <section className="months-list" aria-label="Budget month history">
          <header className="months-list__header">
            <span>Month</span>
            <span>Income</span>
            <span>Expenses</span>
            <span>Remaining</span>
            <span>Actions</span>
          </header>
          {months.data.map((month) => (
            <article className="month-row" key={month.id}>
              <div className="month-row__title">
                <span className="calendar-tile">
                  <small>{formatMonth(month.month_start, locale).slice(0, 3)}</small>
                  <strong>{month.month_start.slice(0, 4)}</strong>
                </span>
                <div>
                  <strong>{formatMonth(month.month_start, locale)}</strong>
                  {month.month_start === current && (
                    <small className="current-pill">Current month</small>
                  )}
                </div>
              </div>
              <dl>
                <div>
                  <dt>Income</dt>
                  <dd>{formatMoney(month.income, month.currency_code, locale)}</dd>
                </div>
                <div>
                  <dt>Expenses</dt>
                  <dd>{formatMoney(month.expenses, month.currency_code, locale)}</dd>
                </div>
                <div>
                  <dt>Remaining</dt>
                  <dd className={month.remaining < 0 ? 'negative' : 'positive'}>
                    {formatMoney(month.remaining, month.currency_code, locale)}
                  </dd>
                </div>
              </dl>
              <div className="month-row__actions">
                <label className="month-export-format">
                  <span className="visually-hidden">
                    Download format for {formatMonth(month.month_start, locale)}
                  </span>
                  <select
                    className="input"
                    value={exportFormats[month.id] ?? 'pdf'}
                    onChange={(event) =>
                      setExportFormats((currentFormats) => ({
                        ...currentFormats,
                        [month.id]: event.target.value as MonthExportFormat,
                      }))
                    }
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="pdf">PDF</option>
                  </select>
                </label>
                <button
                  className="icon-button"
                  aria-label={`Download ${formatMonth(month.month_start, locale)} as ${(exportFormats[month.id] ?? 'pdf').toUpperCase()}`}
                  disabled={exportingId === month.id}
                  onClick={() => void exportMonth(month.id)}
                >
                  <Download aria-hidden="true" size={18} />
                </button>
                <Link className="button button--secondary" to={`/app/budget/${month.month_start}`}>
                  Open <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="empty-card">
          <CalendarDays />
          <h2>No budget months yet</h2>
          <p>Create your recurring template, then start your first month.</p>
          <Link className="button button--primary" to="/app/templates">
            Go to templates
          </Link>
        </div>
      )}
      <Modal
        open={Boolean(reportMonth)}
        title="Report preview"
        description="Review the report, then download it directly as a PDF file."
        onClose={() => setReportMonth(null)}
      >
        {reportMonth && profile.data && (
          <section className="report-preview-shell" aria-label="PDF report preview">
            <BudgetReportPreview
              months={[reportMonth]}
              profile={profile.data}
              rangeLabel={formatMonth(reportMonth.month_start, locale)}
            />
            {exportError && (
              <div className="inline-alert inline-alert--error" role="alert">
                {exportError}
              </div>
            )}
            <footer className="report-preview-shell__actions">
              <Button variant="ghost" type="button" onClick={() => setReportMonth(null)}>
                Back
              </Button>
              <Button
                type="button"
                loading={exportingId === reportMonth.id}
                icon={<Download aria-hidden="true" size={18} />}
                onClick={() => void downloadReport()}
              >
                Download PDF
              </Button>
            </footer>
          </section>
        )}
      </Modal>
    </section>
  );
};
