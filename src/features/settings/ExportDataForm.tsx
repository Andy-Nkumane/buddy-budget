import { ArrowLeft, Download, FileText } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  exportAllData,
  retrieveMonthsForExport,
  type MonthExportRange,
} from '../../data/repositories/budgetRepository';
import { adjacentMonthStart, currentMonthStart, formatMonth } from '../../shared/formatting/money';
import type { BudgetMonthWithItems, Profile } from '../../shared/types/domain';
import {
  downloadBudgetReportPdf,
  downloadJson,
  downloadMonthsCsv,
} from '../../shared/utilities/download';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import { BudgetReportPreview } from '../reports/BudgetReportPreview';

type ExportFormat = 'csv' | 'json' | 'pdf';
type ExportPreset =
  'all' | 'current' | 'last3' | 'last6' | 'last12' | 'ytd' | 'previousYear' | 'custom';

interface ExportDataFormProps {
  profile: Profile;
  onComplete: () => void;
}

interface ReportPreview {
  months: BudgetMonthWithItems[];
  rangeLabel: string;
  filenameRange: string;
  includeForecast: boolean;
}

const resolveRange = (
  preset: ExportPreset,
  customStart: string,
  customEnd: string,
  currentMonth: string,
): MonthExportRange => {
  const currentYear = currentMonth.slice(0, 4);
  switch (preset) {
    case 'current':
      return { fromMonth: currentMonth, toMonth: currentMonth };
    case 'last3':
      return { fromMonth: adjacentMonthStart(currentMonth, -2), toMonth: currentMonth };
    case 'last6':
      return { fromMonth: adjacentMonthStart(currentMonth, -5), toMonth: currentMonth };
    case 'last12':
      return { fromMonth: adjacentMonthStart(currentMonth, -11), toMonth: currentMonth };
    case 'ytd':
      return { fromMonth: `${currentYear}-01-01`, toMonth: currentMonth };
    case 'previousYear': {
      const year = String(Number(currentYear) - 1);
      return { fromMonth: `${year}-01-01`, toMonth: `${year}-12-01` };
    }
    case 'custom':
      return {
        fromMonth: customStart ? `${customStart}-01` : undefined,
        toMonth: customEnd ? `${customEnd}-01` : undefined,
      };
    default:
      return {};
  }
};

const describeRange = (range: MonthExportRange, locale: string) => {
  if (!range.fromMonth || !range.toMonth) {
    return { label: 'All budget months', filename: 'all-months' };
  }
  if (range.fromMonth === range.toMonth) {
    return {
      label: formatMonth(range.fromMonth, locale),
      filename: range.fromMonth.slice(0, 7),
    };
  }
  return {
    label: `${formatMonth(range.fromMonth, locale)} to ${formatMonth(range.toMonth, locale)}`,
    filename: `${range.fromMonth.slice(0, 7)}-to-${range.toMonth.slice(0, 7)}`,
  };
};

export const ExportDataForm = ({ profile, onComplete }: ExportDataFormProps) => {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [preset, setPreset] = useState<ExportPreset>('all');
  const [customStart, setCustomStart] = useState(() => currentMonthStart().slice(0, 7));
  const [customEnd, setCustomEnd] = useState(() => currentMonthStart().slice(0, 7));
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportPreview, setReportPreview] = useState<ReportPreview | null>(null);
  const [includeForecast, setIncludeForecast] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const range = resolveRange(preset, customStart, customEnd, currentMonthStart());
    if (preset === 'custom' && (!range.fromMonth || !range.toMonth)) {
      setError('Choose both a start month and an end month.');
      return;
    }
    if (range.fromMonth && range.toMonth && range.fromMonth > range.toMonth) {
      setError('The start month must be before or equal to the end month.');
      return;
    }

    setExporting(true);
    try {
      const rangeDescription = describeRange(range, profile.locale);
      if (format === 'json') {
        const data = await exportAllData(range);
        downloadJson(`buddybudget-${rangeDescription.filename}.json`, data);
      } else {
        const months = await retrieveMonthsForExport(range);
        if (!months.length) throw new Error('There are no budget months in this date range.');
        if (format === 'csv') {
          downloadMonthsCsv(months, rangeDescription.filename, includeForecast);
        } else {
          setReportPreview({
            months,
            rangeLabel: rangeDescription.label,
            filenameRange: rangeDescription.filename,
            includeForecast,
          });
          return;
        }
      }
      onComplete();
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'The export could not be created.',
      );
    } finally {
      setExporting(false);
    }
  };

  const downloadPdf = async () => {
    if (!reportPreview) return;
    setError(null);
    setExporting(true);
    try {
      await downloadBudgetReportPdf(
        reportPreview.months,
        profile,
        reportPreview.rangeLabel,
        reportPreview.filenameRange,
        reportPreview.includeForecast,
      );
      onComplete();
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : 'The PDF could not be downloaded.',
      );
    } finally {
      setExporting(false);
    }
  };

  if (reportPreview) {
    return (
      <section className="report-preview-shell" aria-label="PDF report preview">
        <BudgetReportPreview
          months={reportPreview.months}
          profile={profile}
          rangeLabel={reportPreview.rangeLabel}
          includeForecast={reportPreview.includeForecast}
        />
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        <footer className="report-preview-shell__actions">
          <Button
            type="button"
            variant="ghost"
            icon={<ArrowLeft aria-hidden="true" size={18} />}
            onClick={() => setReportPreview(null)}
          >
            Back
          </Button>
          <Button
            type="button"
            loading={exporting}
            icon={<Download aria-hidden="true" size={18} />}
            onClick={() => void downloadPdf()}
          >
            Download PDF
          </Button>
        </footer>
      </section>
    );
  }

  return (
    <form className="modal-form export-form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <SelectField
          label="Format"
          value={format}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
        >
          <option value="pdf">PDF report</option>
          <option value="csv">CSV spreadsheet</option>
          <option value="json">JSON data backup</option>
        </SelectField>
        <SelectField
          label="Date range"
          value={preset}
          onChange={(event) => setPreset(event.target.value as ExportPreset)}
        >
          <option value="all">All months</option>
          <option value="current">Current month</option>
          <option value="last3">Last 3 months</option>
          <option value="last6">Last 6 months</option>
          <option value="last12">Last 12 months</option>
          <option value="ytd">Year to date</option>
          <option value="previousYear">Previous calendar year</option>
          <option value="custom">Custom range</option>
        </SelectField>
      </div>
      {preset === 'custom' && (
        <div className="form-grid export-form__custom-range">
          <FormField
            label="Start month"
            type="month"
            value={customStart}
            onChange={(event) => setCustomStart(event.target.value)}
          />
          <FormField
            label="End month"
            type="month"
            value={customEnd}
            onChange={(event) => setCustomEnd(event.target.value)}
          />
        </div>
      )}
      {format !== 'json' && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={includeForecast}
            onChange={(event) => setIncludeForecast(event.target.checked)}
          />
          Include payment schedules and forecasts
        </label>
      )}
      <p className="export-form__hint">
        {format === 'pdf'
          ? 'Preview the formatted report, then download it directly as a PDF file.'
          : format === 'csv'
            ? 'CSV includes planned items, actual transactions, assignments, and paused states for spreadsheet analysis.'
            : 'JSON includes your profile, preferences, accounts, templates, categories, months, and transactions in the selected range.'}
      </p>
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      <Button
        type="submit"
        loading={exporting}
        icon={format === 'pdf' ? <FileText size={18} /> : <Download size={18} />}
      >
        {format === 'pdf' ? 'Preview PDF report' : `Export ${format.toUpperCase()}`}
      </Button>
    </form>
  );
};
