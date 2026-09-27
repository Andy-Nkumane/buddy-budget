import { useState } from 'react';
import { CheckCircle2, History, LockKeyhole, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import type {
  BudgetMonthWithItems,
  ItemType,
  MonthAdjustmentDirection,
} from '../../shared/types/domain';
import { formatMoney, formatMonth } from '../../shared/formatting/money';
import { calculateAdjustedActuals } from '../../shared/reporting/budgetReport';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import {
  closeBudgetMonth,
  createMonthAdjustment,
  reopenBudgetMonth,
} from '../../data/repositories/budgetRepository';
import { buildMonthCloseChecklist, parseAdjustmentAmount } from './monthClose';

export const MonthClosePanel = ({
  month,
  ageLocked,
  currentMonthId,
  locale,
  onChanged,
}: {
  month: BudgetMonthWithItems;
  ageLocked: boolean;
  currentMonthId: string | null;
  locale: string;
  onChanged: () => void;
}) => {
  const [dialog, setDialog] = useState<'close' | 'reopen' | 'adjust' | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [itemType, setItemType] = useState<ItemType>('expense');
  const [direction, setDirection] = useState<MonthAdjustmentDirection>('increase');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [adjustmentKey, setAdjustmentKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checklist = buildMonthCloseChecklist(month);
  const adjusted = calculateAdjustedActuals(month);
  const isClosed = month.lifecycle?.state === 'closed';
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (dialog === 'adjust') setAdjustmentKey(crypto.randomUUID());
      setDialog(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="month-close-panel" aria-labelledby="month-close-heading">
      <header>
        <div>
          <p className="eyebrow">Month lifecycle</p>
          <h2 id="month-close-heading">
            {ageLocked ? 'Locked report' : isClosed ? 'Month closed' : 'Ready to close?'}
          </h2>
          <p>
            {ageLocked
              ? 'Original records are permanently read-only. Add a current-month adjustment for legitimate late corrections.'
              : isClosed
                ? `Closed ${month.lifecycle?.closed_at ? new Date(month.lifecycle.closed_at).toLocaleString(locale) : ''}. Reopen before the automatic lock boundary if needed.`
                : 'Review the checklist, preserve a close snapshot, then move deliberately to the next month.'}
          </p>
        </div>
        {ageLocked ? (
          <Button variant="secondary" onClick={() => setDialog('adjust')}>
            Add adjustment
          </Button>
        ) : isClosed ? (
          <Button
            variant="secondary"
            icon={<RotateCcw size={17} />}
            onClick={() => setDialog('reopen')}
          >
            Reopen month
          </Button>
        ) : (
          <Button icon={<CheckCircle2 size={17} />} onClick={() => setDialog('close')}>
            Close month
          </Button>
        )}
      </header>
      {(month.adjustments?.length ?? 0) > 0 && (
        <div className="adjusted-summary">
          <strong>Adjusted interpretation</strong>
          <span>
            Original balance {formatMoney(adjusted.original.remaining, month.currency_code, locale)}
          </span>
          <span>
            After adjustments {formatMoney(adjusted.remaining, month.currency_code, locale)}
          </span>
        </div>
      )}
      {isClosed && !ageLocked && (
        <Link
          className="text-button"
          to={`/app/budget/${new Date(Date.UTC(Number(month.month_start.slice(0, 4)), Number(month.month_start.slice(5, 7)), 1)).toISOString().slice(0, 10)}`}
        >
          Next step: review and create the next month
        </Link>
      )}
      {(month.lifecycle_events?.length ?? 0) > 0 && (
        <details className="month-activity">
          <summary>
            <History size={17} /> Activity trail
          </summary>
          <ol>
            {month.lifecycle_events?.map((event) => (
              <li key={event.id}>
                <strong>{event.event_type.replaceAll('_', ' ')}</strong>
                <time dateTime={event.created_at}>
                  {new Date(event.created_at).toLocaleString(locale)}
                </time>
              </li>
            ))}
          </ol>
        </details>
      )}
      <Modal
        open={dialog === 'close'}
        title="Close this month"
        description="The close summary is permanent. Warnings do not change your data."
        onClose={() => setDialog(null)}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => closeBudgetMonth(month.id));
          }}
        >
          <ul className="close-checklist">
            <li>
              <span>Uncategorised transactions</span>
              <strong>{checklist.uncategorisedCount}</strong>
            </li>
            <li>
              <span>Unmatched expected schedules</span>
              <strong>{checklist.unmatchedScheduleCount}</strong>
            </li>
            <li>
              <span>Income variance</span>
              <strong>
                {formatMoney(checklist.progress.incomeVariance, month.currency_code, locale)}
              </strong>
            </li>
            <li>
              <span>Expense variance</span>
              <strong>
                {formatMoney(checklist.progress.expenseVariance, month.currency_code, locale)}
              </strong>
            </li>
            <li>
              <span>Savings or deficit</span>
              <strong>
                {formatMoney(checklist.progress.actual.remaining, month.currency_code, locale)}
              </strong>
            </li>
            <li>
              <span>Incomplete goal allocations</span>
              <strong>{checklist.incompleteGoalCount}</strong>
            </li>
          </ul>
          <label className="check-row">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              <strong>I reviewed these results</strong>
              <small>Closing makes this month read-only until it is reopened.</small>
            </span>
          </label>
          {error && (
            <div className="inline-alert inline-alert--error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" disabled={!acknowledged} loading={busy}>
            Close month
          </Button>
        </form>
      </Modal>
      <Modal
        open={dialog === 'reopen'}
        title="Reopen this month?"
        description="This creates an audit event and allows edits again. Age-locked months can never be reopened."
        onClose={() => setDialog(null)}
      >
        {error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {error}
          </div>
        )}
        <div className="button-row">
          <Button variant="ghost" onClick={() => setDialog(null)}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void run(() => reopenBudgetMonth(month.id))}>
            Confirm reopen
          </Button>
        </div>
      </Modal>
      <Modal
        open={dialog === 'adjust'}
        title="Add historical adjustment"
        description={`The original ${formatMonth(month.month_start, locale)} report will not change.`}
        onClose={() => setDialog(null)}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!currentMonthId) {
              setError('Create the current month before adding an adjustment.');
              return;
            }
            void run(() =>
              createMonthAdjustment({
                originalMonthId: month.id,
                appliedMonthId: currentMonthId,
                itemType,
                direction,
                amountMinor: parseAdjustmentAmount(amount),
                reason,
                idempotencyKey: adjustmentKey,
              }),
            );
          }}
        >
          <div className="inline-alert">
            <LockKeyhole size={17} /> Stored in the current month; original records remain
            unchanged.
          </div>
          <label className="field">
            <span className="field__label">Affects</span>
            <select
              className="input"
              value={itemType}
              onChange={(event) => setItemType(event.target.value as ItemType)}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Change</span>
            <select
              className="input"
              value={direction}
              onChange={(event) => setDirection(event.target.value as MonthAdjustmentDirection)}
            >
              <option value="increase">Increase</option>
              <option value="decrease">Decrease</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Amount</span>
            <input
              className="input"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Reason</span>
            <textarea
              className="input"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && (
            <div className="inline-alert inline-alert--error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" loading={busy}>
            Record adjustment
          </Button>
        </form>
      </Modal>
    </section>
  );
};
