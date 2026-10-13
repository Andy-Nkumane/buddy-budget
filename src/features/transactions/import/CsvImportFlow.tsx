import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  BudgetMonth,
  BudgetMonthItem,
  FinancialAccountWithBalance,
} from '../../../shared/types/domain';
import { Button } from '../../../shared/ui/Button';
import {
  importBudgetTransactions,
  retrieveMonthById,
  searchCategorisationRules,
  searchExistingTransactionFingerprints,
} from '../../../data/repositories/budgetRepository';
import {
  createImportBatchKey,
  CSV_MAX_ROWS,
  normalizeCsvRows,
  readCsvFile,
  suggestCsvMapping,
  type CsvColumnMapping,
  type CsvPreviewRow,
  type CsvTable,
} from './csvParser';
import { queryKeys } from '../../../data/queryKeys';
import { evaluateCategorisationRules } from '../../rules/rulesEngine';

type Props = {
  userId: string;
  months: BudgetMonth[];
  accounts: FinancialAccountWithBalance[];
  onComplete: (monthId: string, message: string) => Promise<void>;
  onCancel: () => void;
};

const columnValue = (value: number | null): string => (value === null ? '' : String(value));
const optionalColumn = (value: string): number | null => (value === '' ? null : Number(value));

export const CsvImportFlow = ({ userId, months, accounts, onComplete, onCancel }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [monthId, setMonthId] = useState(months[0]?.id ?? '');
  const [accountId, setAccountId] = useState('');
  const [preview, setPreview] = useState<CsvPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<BudgetMonthItem[]>([]);
  const rules = useQuery({
    queryKey: queryKeys.categorisationRules(userId),
    queryFn: searchCategorisationRules,
  });
  const selectedMonth = months.find((month) => month.id === monthId);
  const eligibleAccounts = accounts.filter(
    (account) =>
      account.archived_at === null && account.currency_code === selectedMonth?.currency_code,
  );
  const counts = useMemo(
    () =>
      (preview ?? []).reduce(
        (result, row) => ({ ...result, [row.status]: result[row.status] + 1 }),
        { valid: 0, invalid: 0, duplicate: 0, excluded: 0 },
      ),
    [preview],
  );
  const ruleEvaluations = useMemo(
    () =>
      new Map(
        (preview ?? []).flatMap((row) => {
          if (!row.normalized) return [];
          const evaluation = evaluateCategorisationRules(
            {
              id: row.id,
              description: row.normalized.description,
              amount_minor: row.normalized.amount_minor,
              transaction_type: row.normalized.transaction_type,
              transaction_date: row.normalized.transaction_date,
              category_id: null,
              budget_month_item_id: null,
              notes: null,
              is_recurring_candidate: false,
            },
            rules.data ?? [],
          );
          evaluation.changes = evaluation.changes.flatMap((change) => {
            if (change.field !== 'budget_month_item_id') return [change];
            const match = previewItems.find(
              (item) =>
                item.archived_at === null &&
                item.item_type === row.normalized?.transaction_type &&
                item.name_snapshot.toLocaleLowerCase('en') ===
                  String(change.after).toLocaleLowerCase('en'),
            );
            return match ? [{ ...change, after: match.id }] : [];
          });
          const categoryChange = evaluation.changes.find(
            (change) => change.field === 'category_id',
          );
          if (
            categoryChange &&
            !evaluation.changes.some((change) => change.field === 'budget_month_item_id')
          ) {
            const categoryItem = previewItems
              .filter(
                (item) =>
                  item.archived_at === null &&
                  item.item_type === row.normalized?.transaction_type &&
                  item.category_id === categoryChange.after,
              )
              .sort(
                (left, right) =>
                  Number(left.is_disabled) - Number(right.is_disabled) ||
                  left.sort_order - right.sort_order ||
                  left.id.localeCompare(right.id),
              )[0];
            if (categoryItem) {
              evaluation.changes.push({
                field: 'budget_month_item_id',
                before: null,
                after: categoryItem.id,
                ruleId: categoryChange.ruleId,
                ruleName: categoryChange.ruleName,
              });
            }
          }
          return [[row.id, evaluation] as const];
        }),
      ),
    [preview, previewItems, rules.data],
  );

  const chooseFile = async (selected: File | undefined) => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await readCsvFile(selected);
      setFile(selected);
      setTable(parsed);
      setMapping(suggestCsvMapping(parsed));
      setPreview(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The CSV file could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const buildPreview = async () => {
    if (!table || !mapping || !selectedMonth) return;
    setBusy(true);
    setError(null);
    try {
      const ruleResult = rules.data ? rules : await rules.refetch();
      if (ruleResult.error) throw ruleResult.error;
      const monthDetails = await retrieveMonthById(selectedMonth.id);
      if (!monthDetails) throw new Error('The destination month could not be loaded.');
      setPreviewItems(monthDetails.budget_month_items);
      const normalized = await normalizeCsvRows(table, mapping, selectedMonth.month_start, userId);
      const fingerprints = normalized.flatMap((row) => row.normalized?.external_fingerprint ?? []);
      const duplicates = await searchExistingTransactionFingerprints(fingerprints);
      setPreview(
        normalized.map((row) =>
          row.normalized && duplicates.has(row.normalized.external_fingerprint)
            ? { ...row, status: 'duplicate', errors: ['This transaction was imported before.'] }
            : row,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The preview could not be prepared.');
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!preview || !mapping || !table || !file || !selectedMonth) return;
    const rows = preview
      .filter((row) => (row.status === 'valid' || row.status === 'duplicate') && row.normalized)
      .map((row) => row.normalized!);
    if (!rows.length) {
      setError('There are no valid, included transactions to import.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const batchKey = await createImportBatchKey(userId, monthId, accountId || null, preview);
      const result = await importBudgetTransactions({
        budgetMonthId: monthId,
        accountId: accountId || null,
        fileName: file.name,
        batchKey,
        mappingMetadata: {
          delimiter: table.delimiter,
          date_format: mapping.dateFormat,
          decimal_format: mapping.decimalFormat,
          amount_mode: mapping.amountMode,
          date_column: mapping.dateColumn,
          description_column: mapping.descriptionColumn,
          reference_column: mapping.referenceColumn,
          amount_column: mapping.amountColumn,
          debit_column: mapping.debitColumn,
          credit_column: mapping.creditColumn,
        },
        rows,
        invalidCount: counts.invalid,
        excludedCount: counts.excluded,
      });
      await onComplete(
        monthId,
        result.was_existing
          ? 'This CSV was already imported. No duplicates were added.'
          : `${result.accepted_count} transaction${result.accepted_count === 1 ? '' : 's'} imported.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'The transactions could not be imported.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!table || !mapping) {
    return (
      <form className="csv-import-flow" onSubmit={(event) => event.preventDefault()}>
        <div className="csv-privacy-note">
          <strong>Your statement stays on this device.</strong>
          <span>
            Buddy Budget reads it in browser memory and never uploads or retains the raw file.
          </span>
        </div>
        <label className="field" htmlFor="csv-statement">
          <span className="field__label">Bank statement CSV</span>
          <input
            id="csv-statement"
            className="input"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <span className="field__hint">
            UTF-8, up to 2 MiB and {CSV_MAX_ROWS.toLocaleString()} data rows.
          </span>
        </label>
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-form__actions">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button loading={busy} disabled>
            Continue
          </Button>
        </div>
      </form>
    );
  }

  const columnOptions = table.headers.map((header, index) => (
    <option key={`${header}-${index}`} value={index}>
      {header}
    </option>
  ));
  if (!preview) {
    return (
      <form
        className="csv-import-flow"
        onSubmit={(event) => {
          event.preventDefault();
          void buildPreview();
        }}
      >
        <fieldset>
          <legend>Destination</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Budget month</span>
              <select
                className="input"
                value={monthId}
                onChange={(event) => {
                  setMonthId(event.target.value);
                  setAccountId('');
                }}
              >
                {months.map((month) => (
                  <option key={month.id} value={month.id}>
                    {month.month_start.slice(0, 7)} · {month.currency_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Account (optional)</span>
              <select
                className="input"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">No account</option>
                {eligibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Column mapping</legend>
          <div className="form-grid">
            <label className="field">
              <span className="field__label">Date</span>
              <select
                className="input"
                value={mapping.dateColumn}
                onChange={(event) =>
                  setMapping({ ...mapping, dateColumn: Number(event.target.value) })
                }
              >
                {columnOptions}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Description or merchant</span>
              <select
                className="input"
                value={mapping.descriptionColumn}
                onChange={(event) =>
                  setMapping({ ...mapping, descriptionColumn: Number(event.target.value) })
                }
              >
                {columnOptions}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Reference (optional)</span>
              <select
                className="input"
                value={columnValue(mapping.referenceColumn)}
                onChange={(event) =>
                  setMapping({ ...mapping, referenceColumn: optionalColumn(event.target.value) })
                }
              >
                <option value="">Not included</option>
                {columnOptions}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Amount layout</span>
              <select
                className="input"
                value={mapping.amountMode}
                onChange={(event) =>
                  setMapping({
                    ...mapping,
                    amountMode: event.target.value as CsvColumnMapping['amountMode'],
                  })
                }
              >
                <option value="signed">One signed amount</option>
                <option value="debit_credit">Separate debit and credit</option>
              </select>
            </label>
            {mapping.amountMode === 'signed' ? (
              <label className="field">
                <span className="field__label">Signed amount</span>
                <select
                  className="input"
                  required
                  value={columnValue(mapping.amountColumn)}
                  onChange={(event) =>
                    setMapping({ ...mapping, amountColumn: optionalColumn(event.target.value) })
                  }
                >
                  <option value="">Choose column</option>
                  {columnOptions}
                </select>
              </label>
            ) : (
              <>
                <label className="field">
                  <span className="field__label">Debit</span>
                  <select
                    className="input"
                    required
                    value={columnValue(mapping.debitColumn)}
                    onChange={(event) =>
                      setMapping({ ...mapping, debitColumn: optionalColumn(event.target.value) })
                    }
                  >
                    <option value="">Choose column</option>
                    {columnOptions}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Credit</span>
                  <select
                    className="input"
                    required
                    value={columnValue(mapping.creditColumn)}
                    onChange={(event) =>
                      setMapping({ ...mapping, creditColumn: optionalColumn(event.target.value) })
                    }
                  >
                    <option value="">Choose column</option>
                    {columnOptions}
                  </select>
                </label>
              </>
            )}
            <label className="field">
              <span className="field__label">Date format</span>
              <select
                className="input"
                value={mapping.dateFormat}
                onChange={(event) =>
                  setMapping({
                    ...mapping,
                    dateFormat: event.target.value as CsvColumnMapping['dateFormat'],
                  })
                }
              >
                <option value="ymd">YYYY-MM-DD</option>
                <option value="dmy">DD/MM/YYYY</option>
                <option value="mdy">MM/DD/YYYY</option>
              </select>
            </label>
            <label className="field">
              <span className="field__label">Decimal separator</span>
              <select
                className="input"
                value={mapping.decimalFormat}
                onChange={(event) =>
                  setMapping({
                    ...mapping,
                    decimalFormat: event.target.value as CsvColumnMapping['decimalFormat'],
                  })
                }
              >
                <option value="auto">Detect automatically</option>
                <option value="dot">Dot (1,234.56)</option>
                <option value="comma">Comma (1.234,56)</option>
              </select>
            </label>
          </div>
        </fieldset>
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-form__actions">
          <Button
            variant="ghost"
            onClick={() => {
              setTable(null);
              setMapping(null);
            }}
          >
            Choose another file
          </Button>
          <Button type="submit" loading={busy}>
            Review transactions
          </Button>
        </div>
      </form>
    );
  }

  return (
    <section className="csv-import-flow" aria-label="CSV import preview">
      <div className="csv-preview-summary" role="status">
        <strong>{counts.valid} ready</strong>
        <span>{counts.invalid} invalid</span>
        <span>{counts.duplicate} duplicate</span>
        <span>{counts.excluded} excluded</span>
      </div>
      {(counts.invalid > 0 || counts.duplicate > 0) && (
        <p>Every row is shown below. Resolve mapping errors or exclude rows before importing.</p>
      )}
      <div className="csv-preview-table">
        <table>
          <thead>
            <tr>
              <th scope="col">Include</th>
              <th scope="col">Line</th>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Rules</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((row) => (
              <tr key={row.id} className={`csv-row--${row.status}`}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Include CSV line ${row.line}`}
                    checked={row.status === 'valid'}
                    disabled={row.status === 'invalid' || row.status === 'duplicate'}
                    onChange={(event) =>
                      setPreview(
                        (current) =>
                          current?.map((entry) =>
                            entry.id === row.id
                              ? { ...entry, status: event.target.checked ? 'valid' : 'excluded' }
                              : entry,
                          ) ?? null,
                      )
                    }
                  />
                </td>
                <td>{row.line}</td>
                <td>{row.normalized?.transaction_date ?? row.raw[mapping.dateColumn]}</td>
                <td>{row.normalized?.description ?? row.raw[mapping.descriptionColumn]}</td>
                <td>
                  {row.normalized
                    ? `${row.normalized.transaction_type === 'expense' ? '−' : '+'}${(row.normalized.amount_minor / 100).toFixed(2)}`
                    : '—'}
                </td>
                <td>
                  <strong>{row.status}</strong>
                  {row.errors.length > 0 && <small>{row.errors.join(' ')}</small>}
                </td>
                <td>
                  {(ruleEvaluations.get(row.id)?.changes.length ?? 0) > 0 ? (
                    <span
                      title={ruleEvaluations
                        .get(row.id)
                        ?.changes.map(
                          (change) =>
                            `${change.field}: ${String(change.after)} (${change.ruleName})`,
                        )
                        .join('\n')}
                    >
                      {ruleEvaluations.get(row.id)?.changes.length} field change
                      {ruleEvaluations.get(row.id)?.changes.length === 1 ? '' : 's'}
                    </span>
                  ) : (
                    'No change'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-form__actions">
        <Button variant="ghost" onClick={() => setPreview(null)}>
          Back to mapping
        </Button>
        <Button loading={busy} disabled={counts.valid === 0} onClick={() => void confirmImport()}>
          Import {counts.valid} transactions
        </Button>
      </div>
    </section>
  );
};
