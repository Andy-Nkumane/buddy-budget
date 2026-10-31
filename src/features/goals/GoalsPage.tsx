import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleX, CirclePause, CirclePlay, Landmark, Pencil, Plus, Trash2 } from 'lucide-react';
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
  searchPostedBudgetTransactionsByMonth,
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
import { claimAndAnnounceMilestone } from '../../shared/milestones/milestones';
import { CollectionNotice } from '../legal/CollectionNotice';
import { InfoHelp } from '../../shared/ui/InfoHelp';
import { budgetGoalHelp } from '../../shared/copy/budgetGoalHelp';

const goalTypeLabel = {
  savings: 'Savings',
  sinking_fund: 'Sinking fund',
  debt_paydown: 'Debt payoff',
} as const;

const contributionTimingText = {
  daily: 'each day',
  weekly: 'each week',
  fortnightly: 'every two weeks',
  monthly: 'each month',
} as const;

export const GoalsPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab =
    requestedTab === 'paused' || requestedTab === 'cancelled' || requestedTab === 'completed'
      ? requestedTab
      : 'ongoing';
  const goals = useQuery({
    queryKey: queryKeys.goals(userId, true),
    queryFn: () => searchFinancialGoals(true),
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
  const [editing, setEditing] = useState<FinancialGoal | null | 'new'>(null);
  const [contributing, setContributing] = useState<FinancialGoalWithContributions | null>(null);
  const [amount, setAmount] = useState('');
  const [monthId, setMonthId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const transactions = useQuery({
    queryKey: queryKeys.transactions(userId, 0, monthId || 'none'),
    queryFn: () => searchPostedBudgetTransactionsByMonth(monthId),
    enabled: contributing !== null && Boolean(monthId),
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const updateVisibleGoal = (savedGoal: FinancialGoal) => {
    queryClient.setQueryData<FinancialGoalWithContributions[]>(
      queryKeys.goals(userId, true),
      (current = []) => {
        const existing = current.find((goal) => goal.id === savedGoal.id);
        const nextGoal = {
          ...savedGoal,
          goal_contributions: existing?.goal_contributions ?? [],
        };
        return existing
          ? current.map((goal) => (goal.id === savedGoal.id ? nextGoal : goal))
          : [...current, nextGoal];
      },
    );
  };
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals(userId, true) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.goals(userId, false) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.insightsRoot(userId) });
  };
  const saveGoal = async (input: Parameters<typeof createFinancialGoal>[0]) => {
    const savedGoal =
      editing && editing !== 'new'
        ? await updateFinancialGoal(editing.id, input)
        : await createFinancialGoal(input);
    updateVisibleGoal(savedGoal);
    setEditing(null);
    refresh();
    void queryClient.invalidateQueries({ queryKey: queryKeys.months(userId) });
  };
  const changeStatus = async (goal: FinancialGoal, status: FinancialGoal['status']) => {
    try {
      setActionError(null);
      const savedGoal = await updateFinancialGoal(goal.id, { ...goal, status });
      updateVisibleGoal(savedGoal);
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
      void claimAndAnnounceMilestone('first_goal_contribution').catch(() => undefined);
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
    months.isLoading
  )
    return <LoadingState label="Loading your goals…" />;
  const loadError =
    goals.error ?? profile.error ?? categories.error ?? accounts.error ?? months.error;
  if (loadError) return <ErrorState message={loadError.message} retry={refresh} />;
  const currency = profile.data?.currency_code ?? 'ZAR';
  const locale = profile.data?.locale ?? 'en-ZA';
  const formatGoalDate = (value: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${value}T00:00:00Z`),
    );
  const currentMonth = currentMonthStart(profile.data?.timezone);
  const editableMonths = (months.data ?? []).filter(
    (month) => !isMonthReadOnly(month.month_start, currentMonth),
  );
  const linkedTransactionIds = new Set(
    (goals.data ?? []).flatMap((goal) =>
      goal.goal_contributions.flatMap((entry) =>
        entry.transaction_id ? [entry.transaction_id] : [],
      ),
    ),
  );
  const availableTransactions = (transactions.data ?? []).filter(
    (entry) => !linkedTransactionIds.has(entry.id),
  );
  const goalsByTab = {
    ongoing: (goals.data ?? []).filter((goal) => goal.status === 'active'),
    paused: (goals.data ?? []).filter((goal) => goal.status === 'paused'),
    cancelled: (goals.data ?? []).filter(
      (goal) => goal.status === 'cancelled' || goal.status === 'archived',
    ),
    completed: (goals.data ?? []).filter((goal) => goal.status === 'completed'),
  };
  const visibleGoals = goalsByTab[activeTab];
  const tabLabels = {
    ongoing: 'Ongoing',
    paused: 'Paused',
    cancelled: 'Cancelled',
    completed: 'Completed',
  } as const;

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
      {(goals.data ?? []).length > 0 && (
        <div className="goal-tabs" role="tablist" aria-label="Goal status">
          {(Object.keys(tabLabels) as Array<keyof typeof tabLabels>).map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-controls="goal-tab-panel"
              aria-selected={activeTab === tab}
              className={activeTab === tab ? 'goal-tab goal-tab--active' : 'goal-tab'}
              onClick={() => setSearchParams(tab === 'ongoing' ? {} : { tab })}
            >
              {tabLabels[tab]} <span>{goalsByTab[tab].length}</span>
            </button>
          ))}
        </div>
      )}
      {!goals.data?.length ? (
        <div className="empty-card">
          <Landmark aria-hidden="true" />
          <h2>Turn future costs into a monthly plan</h2>
          <p>Create a goal to see a clear recommended contribution in each editable month.</p>
          <Button onClick={() => setEditing('new')}>Create your first goal</Button>
        </div>
      ) : visibleGoals.length ? (
        <div className="goal-grid" id="goal-tab-panel" role="tabpanel">
          {visibleGoals.map((goal) => {
            const progress = calculateGoalProgress(goal, goal.goal_contributions);
            const completed = goal.status === 'completed' || progress.remainingMinor === 0;
            return (
              <article className="goal-card" key={goal.id}>
                <header>
                  <div>
                    <span className={`status-pill status-pill--${goal.status}`}>
                      {goal.status === 'active'
                        ? 'ongoing'
                        : goal.status === 'archived'
                          ? 'previously archived'
                          : goal.status}
                    </span>
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
                    <dt>
                      Planned {goal.contribution_frequency} contribution{' '}
                      <InfoHelp label="About planned goal contributions">
                        {budgetGoalHelp.plannedContribution}
                      </InfoHelp>
                    </dt>
                    <dd>
                      {progress.plannedContributionMinor === null
                        ? 'Not set'
                        : formatMoney(progress.plannedContributionMinor / 100, currency, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      Required {goal.contribution_frequency} pace{' '}
                      <InfoHelp label="About required goal pace">
                        {budgetGoalHelp.requiredContribution}
                      </InfoHelp>
                    </dt>
                    <dd>
                      {progress.requiredContributionMinor === null
                        ? 'Needs a future target date'
                        : formatMoney(progress.requiredContributionMinor / 100, currency, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {goal.target_date ? 'Target date' : 'Projected finish'}{' '}
                      <InfoHelp
                        label={
                          goal.target_date ? 'About the target date' : 'About projected completion'
                        }
                      >
                        {goal.target_date
                          ? budgetGoalHelp.targetDate
                          : budgetGoalHelp.projectedCompletion}
                      </InfoHelp>
                    </dt>
                    <dd>
                      {goal.target_date
                        ? formatGoalDate(goal.target_date)
                        : progress.projectedCompletionDate
                          ? `Estimated ${formatGoalDate(progress.projectedCompletionDate)}`
                          : 'Needs a planned amount'}
                    </dd>
                  </div>
                </dl>
                {goal.target_date && (
                  <p className={`goal-track goal-track--${progress.onTrack ? 'good' : 'behind'}`}>
                    {progress.onTrack
                      ? `Your plan is on track for ${formatGoalDate(goal.target_date)}.`
                      : progress.requiredContributionMinor !== null
                        ? `At this amount, you may miss ${formatGoalDate(goal.target_date)}. Try adding at least ${formatMoney(progress.requiredContributionMinor / 100, currency, locale)} ${contributionTimingText[goal.contribution_frequency]}.`
                        : `Your target date has passed. Choose a new date to make a new plan.`}
                  </p>
                )}
                <p className="goal-estimate-note">
                  Planning estimates use your entries and exclude returns, fees, and unexpected
                  costs. They are not personalised financial advice.
                </p>
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
                  {goal.status === 'active' && !completed && (
                    <Button variant="secondary" onClick={() => setContributing(goal)}>
                      Add contribution
                    </Button>
                  )}
                  {!completed && goal.status !== 'cancelled' && goal.status !== 'archived' && (
                    <button
                      className="icon-button"
                      aria-label={`Edit ${goal.name}`}
                      onClick={() => setEditing(goal)}
                    >
                      <Pencil size={17} />
                    </button>
                  )}
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
                  {(goal.status === 'active' || goal.status === 'paused') && !completed && (
                    <button
                      className="icon-button"
                      aria-label={`Cancel ${goal.name}`}
                      onClick={() => void changeStatus(goal, 'cancelled')}
                    >
                      <CircleX size={18} />
                    </button>
                  )}
                  {(goal.status === 'cancelled' || goal.status === 'archived') && (
                    <Button variant="ghost" onClick={() => void changeStatus(goal, 'active')}>
                      Restore as ongoing
                    </Button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-card" id="goal-tab-panel" role="tabpanel">
          <Landmark aria-hidden="true" />
          <h2>No {tabLabels[activeTab].toLowerCase()} goals</h2>
          <p>Goals in this lifecycle state will appear here.</p>
        </div>
      )}
      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'Create a goal' : 'Edit goal'}
        description="Changes update editable months only; locked reports stay unchanged."
        onClose={() => setEditing(null)}
      >
        <GoalForm
          key={editing === 'new' ? 'new' : editing?.id}
          goal={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          accounts={accounts.data ?? []}
          existingGoals={goals.data ?? []}
          timeZone={profile.data?.timezone}
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
          <CollectionNotice>
            The contribution amount, date, optional notes, and any linked transaction are saved to
            the active household. Avoid unnecessary sensitive details in notes.
          </CollectionNotice>
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
          {transactions.isLoading && <p className="muted">Loading posted transactions…</p>}
          {transactions.error && (
            <div className="inline-alert inline-alert--error" role="alert">
              Posted transactions could not be loaded. Choose the month again to retry.
            </div>
          )}
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
