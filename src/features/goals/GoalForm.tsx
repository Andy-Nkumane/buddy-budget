import { useState, type FormEvent } from 'react';
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

export const GoalForm = ({
  goal,
  categories,
  accounts,
  onSave,
}: {
  goal?: FinancialGoal | null;
  categories: Category[];
  accounts: FinancialAccountWithBalance[];
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
    goal?.desired_monthly_contribution_minor
      ? String(goal.desired_monthly_contribution_minor / 100)
      : '',
  );
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '');
  const [priority, setPriority] = useState(String(goal?.priority ?? 3));
  const [categoryId, setCategoryId] = useState(goal?.category_id ?? '');
  const [accountId, setAccountId] = useState(goal?.account_id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const targetAmountMinor = moneyToMinorUnits(targetAmount);
      const startingBalanceMinor = moneyToMinorUnits(startingBalance);
      const desiredMonthlyContributionMinor = monthlyContribution
        ? moneyToMinorUnits(monthlyContribution)
        : null;
      if (targetAmountMinor <= 0 || startingBalanceMinor < 0) {
        throw new Error('Target must be positive and starting balance cannot be negative.');
      }
      if (desiredMonthlyContributionMinor !== null && desiredMonthlyContributionMinor <= 0) {
        throw new Error('Monthly contribution must be positive.');
      }
      if (goalType === 'debt_paydown' && targetAmountMinor > startingBalanceMinor) {
        throw new Error('A debt payoff target cannot exceed the starting debt balance.');
      }
      await onSave({
        name: name.trim(),
        goal_type: goalType,
        target_amount_minor: targetAmountMinor,
        target_date: targetDate || null,
        starting_balance_minor: startingBalanceMinor,
        desired_monthly_contribution_minor: desiredMonthlyContributionMinor,
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
    <form className="modal-form" onSubmit={(event) => void submit(event)}>
      <div className="form-grid">
        <FormField
          label="Goal name"
          name="goal-name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
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
          onChange={(event) => setTargetAmount(event.target.value)}
        />
        <FormField
          label={goalType === 'debt_paydown' ? 'Starting debt balance' : 'Starting balance'}
          required
          name="goal-starting-balance"
          inputMode="decimal"
          value={startingBalance}
          onChange={(event) => setStartingBalance(event.target.value)}
        />
        <FormField
          label="Target date"
          name="goal-target-date"
          type="date"
          value={targetDate}
          onChange={(event) => setTargetDate(event.target.value)}
        />
        <FormField
          label="Desired monthly contribution"
          name="goal-monthly-contribution"
          hint="Leave blank to calculate it from the target date."
          inputMode="decimal"
          value={monthlyContribution}
          onChange={(event) => setMonthlyContribution(event.target.value)}
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
