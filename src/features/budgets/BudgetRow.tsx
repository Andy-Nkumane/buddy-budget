import { Archive, Check, CirclePause, CirclePlay, Pencil, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { BudgetMonthItem } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { updateMonthItem, updateMonthItemAmount } from '../../data/repositories/budgetRepository';
import { formatMoney } from '../../shared/formatting/money';
import { useDebouncedAutosave } from './useDebouncedAutosave';

interface BudgetRowProps {
  item: BudgetMonthItem;
  currencyCode: string;
  locale: string;
  readOnly: boolean;
  progress: { planned: number; actual: number; variance: number; remaining: number };
  onDraft: (id: string, amount: string) => void;
  onArchive: (item: BudgetMonthItem) => void;
  onToggleDisabled: (item: BudgetMonthItem) => void;
  onChanged: () => void;
}

export const BudgetRow = ({
  item,
  currencyCode,
  locale,
  readOnly,
  progress,
  onDraft,
  onArchive,
  onToggleDisabled,
  onChanged,
}: BudgetRowProps) => {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name_snapshot);
  const [nameError, setNameError] = useState<string | null>(null);
  const autosave = useDebouncedAutosave(
    item.amount,
    async (amount) => {
      await updateMonthItemAmount(item.id, amount);
      localStorage.setItem(`buddybudget-month-${item.budget_month_id}`, Date.now().toString());
    },
    (amount) => onDraft(item.id, amount),
  );

  const saveName = async () => {
    if (readOnly) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter an item name.');
      return;
    }
    try {
      await updateMonthItem(item.id, { name_snapshot: trimmed });
      setRenaming(false);
      setNameError(null);
      onChanged();
    } catch (error) {
      setNameError(error instanceof Error ? error.message : 'Rename failed.');
    }
  };

  return (
    <article
      className={`budget-row ${item.is_disabled ? 'budget-row--disabled' : ''} ${autosave.status === 'failed' ? 'budget-row--error' : ''}`}
    >
      <div className="budget-row__identity">
        <span className={`item-dot item-dot--${item.item_type}`} aria-hidden="true" />
        <div>
          {renaming && !readOnly ? (
            <div className="inline-name-editor">
              <input
                aria-label="Item name"
                autoFocus
                className="input"
                maxLength={100}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <button
                className="icon-button"
                type="button"
                aria-label="Save name"
                onClick={() => void saveName()}
              >
                <Check aria-hidden="true" size={18} />
              </button>
            </div>
          ) : (
            <strong>{item.name_snapshot}</strong>
          )}
          <span>
            {item.is_disabled ? 'Paused — ' : ''}
            {item.category_snapshot ?? (item.source_template_item_id ? 'Recurring' : 'One-off')}
          </span>
          {nameError && (
            <small className="field__error" role="alert">
              {nameError}
            </small>
          )}
        </div>
      </div>
      <div className="budget-row__financials">
        <label>
          <small>Planned</small>
          <span className="budget-row__amount">
            <span aria-hidden="true">{currencyCode}</span>
            <input
              aria-label={`${item.name_snapshot} planned amount`}
              className="money-input"
              disabled={readOnly || item.is_disabled}
              inputMode="decimal"
              onChange={(event) => autosave.setValue(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              value={autosave.value}
            />
          </span>
        </label>
        <dl className="item-progress">
          <div>
            <dt>Actual</dt>
            <dd className="actual-amount">{formatMoney(progress.actual, currencyCode, locale)}</dd>
          </div>
          <div>
            <dt>Variance</dt>
            <dd>{formatMoney(progress.variance, currencyCode, locale)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{formatMoney(progress.remaining, currencyCode, locale)}</dd>
          </div>
        </dl>
      </div>
      {!readOnly && (
        <div className="budget-row__actions">
          <span className={`save-state save-state--${autosave.status}`} aria-live="polite">
            {autosave.status === 'saving' && 'Saving…'}
            {autosave.status === 'saved' && 'Saved'}
            {autosave.status === 'failed' && 'Not saved'}
          </span>
          {autosave.status === 'failed' && (
            <Button
              variant="ghost"
              icon={<RefreshCw aria-hidden="true" size={16} />}
              onClick={autosave.retry}
            >
              Retry
            </Button>
          )}
          <button
            className="icon-button row-menu-button"
            type="button"
            aria-label={`${item.is_disabled ? 'Resume' : 'Pause'} ${item.name_snapshot}`}
            title={item.is_disabled ? 'Resume item' : 'Pause item'}
            onClick={() => onToggleDisabled(item)}
          >
            {item.is_disabled ? (
              <CirclePlay aria-hidden="true" size={18} />
            ) : (
              <CirclePause aria-hidden="true" size={18} />
            )}
          </button>
          <button
            className="icon-button row-menu-button"
            type="button"
            aria-label={`Rename ${item.name_snapshot}`}
            onClick={() => setRenaming(true)}
          >
            <Pencil aria-hidden="true" size={17} />
          </button>
          <button
            className="icon-button row-menu-button"
            type="button"
            aria-label={`Archive ${item.name_snapshot}`}
            onClick={() => onArchive(item)}
          >
            <Archive aria-hidden="true" size={17} />
          </button>
        </div>
      )}
      {autosave.error && (
        <p className="budget-row__error" role="alert">
          {autosave.error}
        </p>
      )}
    </article>
  );
};
