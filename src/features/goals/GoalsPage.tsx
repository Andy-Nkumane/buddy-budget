import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Landmark,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import {
  createFinancialGoal,
  createGoalContribution,
  deleteGoalContribution,
  retrieveProfile,
  searchCategories,
  searchFinancialAccounts,
  searchFinancialGoals,
  searchBudgetTransactions,
  searchMonths,
  updateFinancialGoal,
} from '../../data/repositories/budgetRepository';
import type { FinancialGoal, FinancialGoalWithContributions } from '../../shared/types/domain';
import {
  currentMonthStart,
  formatMoney,
  isMonthReadOnly,
  moneyToMinorUnits,
} from '../../shared/formatting/money';
import { Button } from '../../shared/ui/Button';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { FormField } from '../../shared/ui/FormField';
import { Modal } from '../../shared/ui/Modal';
import { SelectField } from '../../shared/ui/SelectField';
import { GoalForm } from './GoalForm';
import { calculateGoalProgress } from './goalCalculations';
import { formatGoalPriority } from '../../shared/reporting/budgetReport';

const goalTypeLabel = {
  savings: 'Savings',
  sinking_fund: 'Sinking fund',
  debt_paydown: 'Debt payoff',
} as const;

export const GoalsPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const goals = useQuery({
    queryKey: queryKeys.goals(userId),
    queryFn: () => searchFinancialGoals(),
  });
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId),
    queryFn: () => searchCategories(),
  });
  const accounts = useQuery({
    queryKey: queryKeys.accounts(userId),
    queryFn: () => searchFinancialAccounts(),
  });
  const months = useQuery({ queryKey: queryKeys.months(userId), queryFn: searchMonths });
  const transactions = useQuery({
    queryKey: queryKeys.transactions(userId, 0),
    queryFn: () => searchBudgetTransactions(0),
  });
  const [editing, setEditing] = useState<FinancialGoal | null | 'new'>(null);
  const [contributing, setContributing] = useState<FinancialGoalWithContributions | null>(null);
  const [amount, setAmount] = useState('');
  const [monthId, setMonthId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.goals(userId) });
  const saveGoal = async (input: Parameters<typeof createFinancialGoal>[0]) => {
    if (editing && editing !== 'new') await updateFinancialGoal(editing.id, input);
    else await createFinancialGoal(input);
    setEditing(null);
    refresh();
    void queryClient.invalidateQueries({ queryKey: queryKeys.months(userId) });
  };
  const changeStatus = async (goal: FinancialGoal, status: FinancialGoal['status']) => {
    try {
      setActionError(null);
      await updateFinancialGoal(goal.id, { ...goal, status });
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The goal could not be updated.');
    }
  };
  const removeContribution = async (id: string) => {
    try {
      setActionError(null);
      await deleteGoalContribution(id);
      refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'The contribution could not be removed.',
      );
    }
  };
  const addContribution = useMutation({
    mutationFn: async () => {
      if (!contributing || !monthId) throw new Error('Choose a budget month.');
      const amountMinor = moneyToMinorUnits(amount);
      if (amountMinor <= 0) throw new Error('Enter a positive contribution.');
      return createGoalContribution({
        goalId: contributing.id,
        budgetMonthId: monthId,
        transactionId: transactionId || null,
        contributionDate: date,
        amountMinor,
        notes,
      });
    },
    onSuccess: () => {
      setContributing(null);
      setAmount('');
      setNotes('');
      setTransactionId('');
      refresh();
    },
  });

  if (
    goals.isLoading ||
    profile.isLoading ||
    categories.isLoading ||
    accounts.isLoading ||
    months.isLoading ||
    transactions.isLoading
  )
    return <LoadingState label="Loading your goals…" />;
  const loadError =
    goals.error ??
    profile.error ??
    categories.error ??
    accounts.error ??
    months.error ??
    transactions.error;
  if (loadError) return <ErrorState message={loadError.message} retry={refresh} />;
  const currency = profile.data?.currency_code ?? 'ZAR';
  const locale = profile.data?.locale ?? 'en-ZA';
  const currentMonth = currentMonthStart(profile.data?.timezone);
  const editableMonths = (months.data ?? []).filter(
    (month) => !isMonthReadOnly(month.month_start, currentMonth),
  );
  const availableTransactions = (transactions.data?.records ?? []).filter(
    (entry) => entry.budget_month_id === monthId && entry.status === 'posted',
  );

  return (
    <section className="page goals-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Plan with purpose</p>
          <h1>Goals</h1>
          <p>
            Prepare for future costs, grow savings, or pay down debt without treating transfers as
            spending.
          </p>
        </div>
        <Button icon={<Plus aria-hidden="true" size={18} />} onClick={() => setEditing('new')}>
          New goal
        </Button>
      </div>
      {actionError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {actionError}
        </div>
      )}
      {!goals.data?.length ? (
        <div className="empty-card">
          <Landmark aria-hidden="true" />
          <h2>Turn future costs into a monthly plan</h2>
          <p>Create a goal to see a clear recommended contribution in each editable month.</p>
          <Button onClick={() => setEditing('new')}>Create your first goal</Button>
        </div>
      ) : (
        <div className="goal-grid">
          {goals.data.map((goal) => {
            const progress = calculateGoalProgress(goal, goal.goal_contributions);
            return (
              <article className="goal-card" key={goal.id}>
                <header>
                  <div>
                    <span className={`status-pill status-pill--${goal.status}`}>{goal.status}</span>
                    <h2>{goal.name}</h2>
                    <p>
                      {goalTypeLabel[goal.goal_type]} · {formatGoalPriority(goal.priority)} priority
                    </p>
                  </div>
                  <strong>{Math.round(progress.progressPercent)}%</strong>
                </header>
                <progress
                  max="100"
                  value={progress.progressPercent}
                  aria-label={`${goal.name} progress`}
                />
                <dl className="goal-card__metrics">
                  <div>
                    <dt>
                      {goal.goal_type === 'debt_paydown' ? 'Debt remaining' : 'Current balance'}
                    </dt>
                    <dd>{formatMoney(progress.currentBalanceMinor / 100, currency, locale)}</dd>
                  </div>
                  <div>
                    <dt>Target remaining</dt>
                    <dd>{formatMoney(progress.remainingMinor / 100, currency, locale)}</dd>
                  </div>
                  <div>
                    <dt>Monthly plan</dt>
                    <dd>{formatMoney(progress.recommendedMonthlyMinor / 100, currency, locale)}</dd>
                  </div>
                  <div>
                    <dt>Projected finish</dt>
                    <dd>{progress.projectedCompletionDate ?? 'Needs a monthly amount'}</dd>
                  </div>
                </dl>
                {goal.target_date && (
                  <p className={`goal-track goal-track--${progress.onTrack ? 'good' : 'behind'}`}>
                    {progress.onTrack
                      ? 'On track for target date'
                      : 'Monthly contribution is below the target pace'}
                  </p>
                )}
                {goal.goal_contributions.length > 0 && (
                  <details className="goal-history">
                    <summary>
                      {goal.goal_contributions.length} recorded contribution
                      {goal.goal_contributions.length === 1 ? '' : 's'}
                    </summary>
                    <ul>
                      {goal.goal_contributions.map((contribution) => {
                        const contributionMonth = months.data?.find(
                          (month) => month.id === contribution.budget_month_id,
                        );
                        const locked = contributionMonth
                          ? isMonthReadOnly(contributionMonth.month_start, currentMonth)
                          : true;
                        return (
                          <li key={contribution.id}>
                            <span>
                              <strong>
                                {formatMoney(contribution.amount_minor / 100, currency, locale)}
                              </strong>
                              <small>
                                {contribution.contribution_date}
                                {contribution.transaction_id ? ' · transaction linked' : ''}
                              </small>
                            </span>
                            {!locked && (
                              <button
                                className="icon-button"
                                aria-label={`Remove ${contribution.goal_name_snapshot} contribution from ${contribution.contribution_date}`}
                                onClick={() => void removeContribution(contribution.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
                <footer>
                  {goal.status === 'active' && (
                    <Button variant="secondary" onClick={() => setContributing(goal)}>
                      Add contribution
                    </Button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Edit ${goal.name}`}
                    onClick={() => setEditing(goal)}
                  >
                    <Pencil size={17} />
                  </button>
                  {goal.status === 'active' ? (
                    <button
                      className="icon-button"
                      aria-label={`Pause ${goal.name}`}
                      onClick={() => void changeStatus(goal, 'paused')}
                    >
                      <CirclePause size={18} />
                    </button>
                  ) : goal.status === 'paused' ? (
                    <button
                      className="icon-button"
                      aria-label={`Resume ${goal.name}`}
                      onClick={() => void changeStatus(goal, 'active')}
                    >
                      <CirclePlay size={18} />
                    </button>
                  ) : null}
                  {goal.status !== 'completed' && (
                    <button
                      className="icon-button"
                      aria-label={`Complete ${goal.name}`}
                      onClick={() => void changeStatus(goal, 'completed')}
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Archive ${goal.name}`}
                    onClick={() => void changeStatus(goal, 'archived')}
                  >
                    <Archive size={18} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Create a goal' : 'Edit goal'}
        description="Changes update editable months only; locked reports stay unchanged."
        onClose={() => setEditing(null)}
      >
        <GoalForm
          goal={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          accounts={accounts.data ?? []}
          onSave={saveGoal}
        />
      </Modal>
      <Modal
        open={contributing !== null}
        title={`Contribute to ${contributing?.name ?? 'goal'}`}
        description="A contribution is a transfer toward your goal, not an expense."
        onClose={() => setContributing(null)}
      >
        <form
          className="modal-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            addContribution.mutate();
          }}
        >
          <FormField
            label="Amount"
            name="goal-contribution-amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <SelectField
            label="Budget month"
            name="goal-contribution-month"
            required
            value={monthId}
            onChange={(event) => {
              const selectedMonthId = event.target.value;
              setMonthId(selectedMonthId);
              setTransactionId('');
              const selectedMonth = editableMonths.find((month) => month.id === selectedMonthId);
              if (selectedMonth && !date.startsWith(selectedMonth.month_start.slice(0, 7))) {
                setDate(selectedMonth.month_start);
              }
            }}
          >
            <option value="">Choose month</option>
            {editableMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {month.month_start.slice(0, 7)}
              </option>
            ))}
          </SelectField>
          <FormField
            label="Contribution date"
            name="goal-contribution-date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <FormField
            label="Notes (optional)"
            name="goal-contribution-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <SelectField
            label="Posted transaction (optional)"
            name="goal-contribution-transaction"
            hint="A linked transaction can count toward only one goal."
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
          >
            <option value="">No linked transaction</option>
            {availableTransactions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.transaction_date} · {entry.description} ·{' '}
                {formatMoney(entry.amount_minor / 100, currency, locale)}
              </option>
            ))}
          </SelectField>
          {addContribution.error && (
            <div className="inline-alert inline-alert--error" role="alert">
              {addContribution.error.message}
            </div>
          )}
          <Button type="submit" loading={addContribution.isPending}>
            Record contribution
          </Button>
        </form>
      </Modal>
    </section>
  );
};
