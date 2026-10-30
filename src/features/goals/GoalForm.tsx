import { useRef, useState, type FormEvent } from 'react';
import type {
  Category,
  FinancialAccountWithBalance,
  FinancialGoal,
} from '../../shared/types/domain';
import type { FinancialGoalInput } from '../../data/repositories/budgetRepository';
import { moneyToMinorUnits } from '../../shared/formatting/money';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import { CollectionNotice } from '../legal/CollectionNotice';
import { currentDateInTimeZone } from '../schedules/cashFlow';

type GoalField = 'name' | 'targetAmount' | 'startingBalance' | 'monthlyContribution' | 'targetDate';

const normalizeGoalName = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

const addYears = (date: string, years: number) => {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCFullYear(parsed.getUTCFullYear() + years);
  return parsed.toISOString().slice(0, 10);
};

export const GoalForm = ({
  goal,
  categories,
  accounts,
  existingGoals,
  timeZone,
  onSave,
}: {
  goal?: FinancialGoal | null;
  categories: Category[];
  accounts: FinancialAccountWithBalance[];
  existingGoals: FinancialGoal[];
  timeZone?: string;
  onSave: (input: FinancialGoalInput) => Promise<void>;
}) => {
  const [name, setName] = useState(goal?.name ?? '');
  const [goalType, setGoalType] = useState<FinancialGoal['goal_type']>(
    goal?.goal_type ?? 'sinking_fund',
  );
  const [targetAmount, setTargetAmount] = useState(
    goal ? String(goal.target_amount_minor / 100) : '',
  );
  const [startingBalance, setStartingBalance] = useState(
    goal ? String(goal.starting_balance_minor / 100) : '0',
  );
  const [monthlyContribution, setMonthlyContribution] = useState(
    goal?.desired_contribution_minor
      ? String(goal.desired_contribution_minor / 100)
      : goal?.desired_monthly_contribution_minor
        ? String(goal.desired_monthly_contribution_minor / 100)
        : '',
  );
  const [frequency, setFrequency] = useState<FinancialGoal['contribution_frequency']>(
    goal?.contribution_frequency ?? 'monthly',
  );
  const [startMode, setStartMode] = useState<FinancialGoal['contribution_start_mode']>(
    goal?.contribution_start_mode ?? 'this_month',
  );
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '');
  const [priority, setPriority] = useState(String(goal?.priority ?? 3));
  const [categoryId, setCategoryId] = useState(goal?.category_id ?? '');
  const [accountId, setAccountId] = useState(goal?.account_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<GoalField, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const today = currentDateInTimeZone(timeZone);
  const maximumDate = addYears(today, 30);
  const warningDate = addYears(today, 10);
  const nextMonthStart = (() => {
    const parsed = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
    parsed.setUTCMonth(parsed.getUTCMonth() + 1);
    return parsed.toISOString().slice(0, 10);
  })();
  const contributionStartDate = startMode === 'next_month' ? nextMonthStart : today;

  const clearFieldError = (field: GoalField) =>
    setFieldErrors((current) => ({ ...current, [field]: undefined }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const nextErrors: Partial<Record<GoalField, string>> = {};
      const normalizedName = normalizeGoalName(name);
      const targetAmountMinor = moneyToMinorUnits(targetAmount);
      const startingBalanceMinor = moneyToMinorUnits(startingBalance);
      const desiredMonthlyContributionMinor = monthlyContribution
        ? moneyToMinorUnits(monthlyContribution)
        : null;
      if (!normalizedName) nextErrors.name = 'Enter a goal name.';
      else if (Array.from(name.trim()).length > 100)
        nextErrors.name = 'Use 100 characters or fewer.';
      else if (
        existingGoals.some(
          (entry) =>
            entry.id !== goal?.id &&
            (entry.status === 'active' || entry.status === 'paused') &&
            normalizeGoalName(entry.name) === normalizedName,
        )
      )
        nextErrors.name = 'An ongoing or paused goal already uses this name.';
      if (targetAmountMinor <= 0) nextErrors.targetAmount = 'Enter an amount greater than zero.';
      if (startingBalanceMinor < 0)
        nextErrors.startingBalance = 'Starting balance cannot be negative.';
      if (desiredMonthlyContributionMinor !== null && desiredMonthlyContributionMinor <= 0) {
        nextErrors.monthlyContribution = 'Enter an amount greater than zero or leave it blank.';
      }
      if (goalType === 'debt_paydown' && targetAmountMinor > startingBalanceMinor) {
        nextErrors.targetAmount = 'Amount to pay down cannot exceed the starting debt balance.';
      }
      if (targetDate && targetDate > maximumDate)
        nextErrors.targetDate = 'Choose a target date within the next 30 years.';
      if (targetDate && targetDate < today && targetDate !== goal?.target_date)
        nextErrors.targetDate = 'Choose today or a future date.';
      setFieldErrors(nextErrors);
      const firstError = Object.keys(nextErrors)[0];
      if (firstError) {
        window.requestAnimationFrame(() => {
          formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
        return;
      }
      await onSave({
        name: name.normalize('NFKC').trim().replace(/\s+/g, ' '),
        goal_type: goalType,
        target_amount_minor: targetAmountMinor,
        target_date: targetDate || null,
        starting_balance_minor: startingBalanceMinor,
        desired_monthly_contribution_minor:
          frequency === 'monthly' ? desiredMonthlyContributionMinor : null,
        desired_contribution_minor: desiredMonthlyContributionMinor,
        contribution_frequency: frequency,
        contribution_start_mode: startMode,
        contribution_start_date:
          goal && startMode === goal.contribution_start_mode
            ? goal.contribution_start_date
            : contributionStartDate,
        priority: Number(priority),
        status: goal?.status ?? 'active',
        category_id: categoryId || null,
        account_id: accountId || null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The goal could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form ref={formRef} className="modal-form" onSubmit={(event) => void submit(event)} noValidate>
      <CollectionNotice>
        Goal names, target amounts, dates, balances, priority, and optional account or category
        context are saved to the active household. Avoid unnecessary sensitive details.
      </CollectionNotice>
      <div className="form-grid">
        <FormField
          label="Goal name"
          name="goal-name"
          required
          value={name}
          error={fieldErrors.name}
          maxLength={100}
          onChange={(event) => {
            setName(event.target.value);
            clearFieldError('name');
          }}
        />
        <SelectField
          label="Goal type"
          name="goal-type"
          value={goalType}
          onChange={(event) => setGoalType(event.target.value as FinancialGoal['goal_type'])}
        >
          <option value="savings">Savings</option>
          <option value="sinking_fund">Sinking fund</option>
          <option value="debt_paydown">Debt payoff</option>
        </SelectField>
        <FormField
          label={goalType === 'debt_paydown' ? 'Amount to pay down' : 'Target amount'}
          required
          name="goal-target-amount"
          inputMode="decimal"
          value={targetAmount}
          error={fieldErrors.targetAmount}
          onChange={(event) => {
            setTargetAmount(event.target.value);
            clearFieldError('targetAmount');
          }}
        />
        <FormField
          label={goalType === 'debt_paydown' ? 'Starting debt balance' : 'Starting balance'}
          required
          name="goal-starting-balance"
          inputMode="decimal"
          value={startingBalance}
          error={fieldErrors.startingBalance}
          onChange={(event) => {
            setStartingBalance(event.target.value);
            clearFieldError('startingBalance');
          }}
        />
        <FormField
          label="Target date"
          name="goal-target-date"
          type="date"
          value={targetDate}
          error={fieldErrors.targetDate}
          max={maximumDate}
          min={goal?.target_date && goal.target_date < today ? undefined : today}
          hint={
            targetDate && targetDate > warningDate
              ? 'Long-range estimate: dates more than 10 years away carry greater uncertainty.'
              : targetDate
                ? undefined
                : 'No target date — required pace is unavailable.'
          }
          onChange={(event) => {
            setTargetDate(event.target.value);
            clearFieldError('targetDate');
          }}
        />
        <SelectField
          label="Contribution frequency"
          name="goal-contribution-frequency"
          value={frequency}
          onChange={(event) =>
            setFrequency(event.target.value as FinancialGoal['contribution_frequency'])
          }
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="monthly">Monthly</option>
        </SelectField>
        <SelectField
          label="Start contributions"
          name="goal-contribution-start"
          hint={`Assumed first contribution: ${contributionStartDate}`}
          value={startMode}
          onChange={(event) =>
            setStartMode(event.target.value as FinancialGoal['contribution_start_mode'])
          }
        >
          <option value="this_month">This month</option>
          <option value="next_month">Next month</option>
        </SelectField>
        <FormField
          label={`Planned ${frequency} contribution`}
          name="goal-monthly-contribution"
          hint="Leave blank to calculate the required pace from the target date."
          inputMode="decimal"
          value={monthlyContribution}
          error={fieldErrors.monthlyContribution}
          onChange={(event) => {
            setMonthlyContribution(event.target.value);
            clearFieldError('monthlyContribution');
          }}
        />
        <SelectField
          label="Priority"
          name="goal-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="1">1 — Highest</option>
          <option value="2">2 — High</option>
          <option value="3">3 — Normal</option>
          <option value="4">4 — Low</option>
          <option value="5">5 — Lowest</option>
        </SelectField>
        <SelectField
          label="Account (optional)"
          name="goal-account"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">No account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Category (optional)"
          name="goal-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      <Button type="submit" loading={saving} disabled={!name.trim()}>
        Save goal
      </Button>
    </form>
  );
};
