import { useState, type FormEvent } from 'react';
import type {
  Category,
  ItemType,
  PaymentSchedule,
  TemplateWithItems,
} from '../../shared/types/domain';
import { moneyToMinorUnits } from '../../shared/formatting/money';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import type { PaymentScheduleInput } from '../../data/repositories/budgetRepository';

const weekdays = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [7, 'Sunday'],
] as const;

export const ScheduleForm = ({
  schedule,
  categories,
  templates,
  timezone,
  onSave,
}: {
  schedule?: PaymentSchedule | null;
  categories: Category[];
  templates: TemplateWithItems[];
  timezone: string;
  onSave: (input: PaymentScheduleInput) => Promise<void>;
}) => {
  const [name, setName] = useState(schedule?.name ?? '');
  const [itemType, setItemType] = useState<ItemType>(schedule?.item_type ?? 'expense');
  const [amount, setAmount] = useState(schedule ? String(schedule.amount_minor / 100) : '');
  const [approximate, setApproximate] = useState(schedule?.amount_is_approximate ?? false);
  const [startDate, setStartDate] = useState(
    schedule?.start_date ?? new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(schedule?.end_date ?? '');
  const [recurrence, setRecurrence] = useState<PaymentSchedule['recurrence']>(
    schedule?.recurrence ?? 'monthly',
  );
  const [selectedDays, setSelectedDays] = useState<number[]>(schedule?.selected_days ?? []);
  const [templateId, setTemplateId] = useState(schedule?.template_id ?? '');
  const [templateItemId, setTemplateItemId] = useState(schedule?.template_item_id ?? '');
  const [categoryId, setCategoryId] = useState(schedule?.category_id ?? '');
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedTemplate = templates.find((entry) => entry.id === templateId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (recurrence === 'selected_days' && selectedDays.length === 0) {
      setError('Choose at least one weekday.');
      return;
    }
    try {
      setSaving(true);
      await onSave({
        name: name.trim(),
        item_type: itemType,
        amount_minor: moneyToMinorUnits(amount),
        amount_is_approximate: approximate,
        start_date: startDate,
        end_date: endDate || null,
        recurrence,
        selected_days: recurrence === 'selected_days' ? selectedDays : [],
        timezone,
        enabled: schedule?.enabled ?? true,
        template_id: templateId || null,
        template_item_id: templateItemId || null,
        category_id: categoryId || null,
        notes: notes.trim() || null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The schedule could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="modal-form schedule-form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <FormField
          label="Schedule name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <SelectField
          label="Type"
          value={itemType}
          onChange={(event) => setItemType(event.target.value as ItemType)}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </SelectField>
        <FormField
          label="Amount"
          required
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <SelectField
          label="Recurrence"
          value={recurrence}
          onChange={(event) => setRecurrence(event.target.value as PaymentSchedule['recurrence'])}
        >
          <option value="monthly">Monthly</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="selected_days">Selected weekdays</option>
        </SelectField>
        <FormField
          label="Starts"
          required
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <FormField
          label="Ends (optional)"
          type="date"
          min={startDate}
          value={endDate}
          onChange={(event) => setEndDate(event.target.value)}
        />
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={approximate}
          onChange={(event) => setApproximate(event.target.checked)}
        />{' '}
        Amount is approximate
      </label>
      {recurrence === 'selected_days' && (
        <fieldset className="weekday-picker">
          <legend>Occurs on</legend>
          {weekdays.map(([day, label]) => (
            <label key={day}>
              <input
                type="checkbox"
                aria-label={label}
                checked={selectedDays.includes(day)}
                onChange={() =>
                  setSelectedDays((value) =>
                    value.includes(day)
                      ? value.filter((entry) => entry !== day)
                      : [...value, day].sort(),
                  )
                }
              />
              {label.slice(0, 3)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="form-grid">
        <SelectField
          label="Template (optional)"
          value={templateId}
          onChange={(event) => {
            setTemplateId(event.target.value);
            setTemplateItemId('');
          }}
        >
          <option value="">No template</option>
          {templates.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Budget item (optional)"
          value={templateItemId}
          onChange={(event) => setTemplateItemId(event.target.value)}
          disabled={!selectedTemplate}
        >
          <option value="">No budget item</option>
          {selectedTemplate?.template_items
            .filter((entry) => entry.item_type === itemType)
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
        </SelectField>
        <SelectField
          label="Category (optional)"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Uncategorised</option>
          {categories
            .filter((entry) => entry.item_type === itemType && !entry.archived_at)
            .map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
        </SelectField>
        <FormField
          label="Notes (optional)"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      <Button type="submit" loading={saving}>
        {schedule ? 'Save schedule' : 'Create schedule'}
      </Button>
    </form>
  );
};
