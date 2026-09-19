import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  Plus,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  createMonthFromTemplate,
  retrieveDefaultTemplate,
  retrieveMonthByStart,
  retrieveProfile,
  searchCategories,
  searchPaymentScheduleOccurrences,
  updateLastLocation,
  updateMonthItem,
} from '../../data/repositories/budgetRepository';
import {
  adjacentMonthStart,
  calculateBudgetProgress,
  calculateItemProgress,
  currentMonthStart,
  formatMoney,
  formatMonth,
  isMonthReadOnly,
} from '../../shared/formatting/money';
import type { BudgetMonthItem, BudgetMonthWithItems, ItemType } from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { parseMoney } from '../../shared/validation/schemas';
import { hasActiveBudgetEditors } from '../../pwa/editState';
import { AddMonthItemForm } from './AddMonthItemForm';
import { BudgetRow } from './BudgetRow';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';

const validMonth = /^\d{4}-(0[1-9]|1[0-2])-01$/;

export const BudgetPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const { monthStart: routeMonth } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const current = currentMonthStart(profile.data?.timezone);
  const monthStart = routeMonth === 'current' || !routeMonth ? current : routeMonth;
  const readOnly = validMonth.test(monthStart) && isMonthReadOnly(monthStart, current);
  const [addingType, setAddingType] = useState<ItemType | null>(() =>
    !readOnly && searchParams.get('add') === 'expense' ? 'expense' : null,
  );
  const [archivedItem, setArchivedItem] = useState<BudgetMonthItem | null>(null);
  const [archivingItemIds, setArchivingItemIds] = useState<Set<string>>(() => new Set());
  const [remoteChange, setRemoteChange] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingRemoteRefresh = useRef(false);
  const monthKey = useMemo(() => queryKeys.month(userId, monthStart), [monthStart, userId]);

  const defaultTemplate = useQuery({
    queryKey: queryKeys.defaultTemplate(userId),
    queryFn: retrieveDefaultTemplate,
    enabled: !readOnly,
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId),
    queryFn: () => searchCategories(),
    enabled: !readOnly,
  });
  const month = useQuery({
    queryKey: monthKey,
    queryFn: () => retrieveMonthByStart(monthStart),
    enabled: validMonth.test(monthStart) && profile.isSuccess,
  });
  const monthEndDate = new Date(`${adjacentMonthStart(monthStart, 1)}T00:00:00Z`);
  monthEndDate.setUTCDate(monthEndDate.getUTCDate() - 1);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const scheduleOccurrences = useQuery({
    queryKey: queryKeys.scheduleOccurrences(userId, monthStart, monthEnd),
    queryFn: () => searchPaymentScheduleOccurrences(monthStart, monthEnd),
    enabled: validMonth.test(monthStart) && profile.isSuccess,
  });
  const loadedMonthId = month.data?.id;
  const createMonth = useMutation({
    mutationFn: async () => {
      if (readOnly)
        throw new Error('Months that are two or more calendar months old are read-only.');
      if (!defaultTemplate.data) throw new Error('Create a default template first.');
      return createMonthFromTemplate(monthStart, defaultTemplate.data.id);
    },
    onSuccess: (created) => queryClient.setQueryData(monthKey, created),
  });

  useEffect(() => {
    if (readOnly || !loadedMonthId) return;
    const key = `buddybudget-month-${loadedMonthId}`;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      setRemoteChange(true);
      if (hasActiveBudgetEditors()) pendingRemoteRefresh.current = true;
      else void queryClient.invalidateQueries({ queryKey: monthKey });
    };
    const handleEditState = () => {
      if (hasActiveBudgetEditors() || !pendingRemoteRefresh.current) return;
      pendingRemoteRefresh.current = false;
      void queryClient.invalidateQueries({ queryKey: monthKey });
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('buddybudget-edit-state', handleEditState);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('buddybudget-edit-state', handleEditState);
    };
  }, [loadedMonthId, monthKey, queryClient, readOnly]);

  useEffect(() => {
    if (!loadedMonthId) return;
    void updateLastLocation(`/app/budget/${monthStart}`, loadedMonthId).catch(() => undefined);
  }, [loadedMonthId, monthStart]);

  useEffect(() => {
    if (!archivedItem) return;
    const timeout = window.setTimeout(() => setArchivedItem(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [archivedItem]);

  if (!validMonth.test(monthStart)) return <ErrorState message="That month address is invalid." />;
  if (
    month.isLoading ||
    profile.isLoading ||
    scheduleOccurrences.isLoading ||
    (!readOnly && (defaultTemplate.isLoading || categories.isLoading))
  ) {
    return <LoadingState label="Opening your month…" />;
  }
  if (
    month.error ||
    profile.error ||
    scheduleOccurrences.error ||
    (!readOnly && (defaultTemplate.error || categories.error))
  ) {
    const error =
      month.error ??
      profile.error ??
      scheduleOccurrences.error ??
      (!readOnly ? (defaultTemplate.error ?? categories.error) : null);
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'The database is unavailable.'}
        retry={() => void queryClient.invalidateQueries()}
      />
    );
  }

  if (!month.data) {
    return (
      <section className="page missing-month">
        <span className="empty-illustration">
          <CalendarPlus aria-hidden="true" />
        </span>
        <p className="eyebrow">{formatMonth(monthStart, profile.data?.locale)}</p>
        <h1>This month has no budget yet</h1>
        <p>
          {monthStart === current
            ? 'We’re preparing the current month from your recurring plan.'
            : 'Past and future months are only created when you choose.'}
        </p>
        {readOnly ? (
          <div className="inline-alert" role="status">
            <LockKeyhole aria-hidden="true" size={18} />
            This historical month is read-only and cannot be created.
          </div>
        ) : defaultTemplate.data ? (
          <Button loading={createMonth.isPending} onClick={() => createMonth.mutate()}>
            Create this month
          </Button>
        ) : (
          <Link className="button button--primary" to="/app/templates">
            Create a default template
          </Link>
        )}
        {createMonth.error && (
          <div className="inline-alert inline-alert--error" role="alert">
            {createMonth.error.message}
          </div>
        )}
      </section>
    );
  }

  const budgetMonth = month.data;
  const visibleBudgetItems = budgetMonth.budget_month_items.filter(
    (item) => !archivingItemIds.has(item.id),
  );
  const progress = calculateBudgetProgress(visibleBudgetItems, budgetMonth.budget_transactions);
  const locale = profile.data?.locale ?? 'en-ZA';
  const currency = budgetMonth.currency_code;
  const itemsByType = (type: ItemType) =>
    visibleBudgetItems.filter((item) => item.item_type === type && item.archived_at === null);
  const updateDraft = (id: string, amount: string) => {
    if (readOnly) return;
    if (parseMoney(amount) === null) return;
    queryClient.setQueryData<BudgetMonthWithItems>(monthKey, (existing) =>
      existing
        ? {
            ...existing,
            budget_month_items: existing.budget_month_items.map((item) =>
              item.id === id ? { ...item, amount } : item,
            ),
          }
        : existing,
    );
  };
  const refresh = () => void queryClient.invalidateQueries({ queryKey: monthKey });
  const archive = async (item: BudgetMonthItem) => {
    if (readOnly) return;
    setArchivingItemIds((current) => new Set(current).add(item.id));
    try {
      setActionError(null);
      await queryClient.cancelQueries({ queryKey: monthKey });
      await updateMonthItem(item.id, { archived_at: new Date().toISOString() });
      queryClient.setQueryData<BudgetMonthWithItems>(monthKey, (existing) =>
        existing
          ? {
              ...existing,
              budget_month_items: existing.budget_month_items.filter(
                (entry) => entry.id !== item.id,
              ),
            }
          : existing,
      );
      setArchivedItem(item);
      localStorage.setItem(`buddybudget-month-${item.budget_month_id}`, Date.now().toString());
    } catch (error) {
      setArchivedItem(null);
      setActionError(error instanceof Error ? error.message : 'The item could not be archived.');
      refresh();
    } finally {
      setArchivingItemIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };
  const undoArchive = async () => {
    if (readOnly || !archivedItem) return;
    try {
      await updateMonthItem(archivedItem.id, { archived_at: null });
      setArchivedItem(null);
      setActionError(null);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The item could not be restored.');
    }
  };
  const toggleDisabled = async (item: BudgetMonthItem) => {
    if (readOnly) return;
    const isDisabled = !item.is_disabled;
    queryClient.setQueryData<BudgetMonthWithItems>(monthKey, (existing) =>
      existing
        ? {
            ...existing,
            budget_month_items: existing.budget_month_items.map((entry) =>
              entry.id === item.id ? { ...entry, is_disabled: isDisabled } : entry,
            ),
          }
        : existing,
    );
    try {
      await updateMonthItem(item.id, { is_disabled: isDisabled });
      setActionError(null);
      localStorage.setItem(`buddybudget-month-${item.budget_month_id}`, Date.now().toString());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The item could not be updated.');
      refresh();
    }
  };

  return (
    <section className="page budget-page">
      <div className="page-heading budget-heading">
        <div>
          <p className="eyebrow">Monthly budget</p>
          <h1>{formatMonth(monthStart, locale)}</h1>
          <p>
            {readOnly
              ? 'This historical month is preserved as a read-only report.'
              : 'Adjust the plan as life happens. Changes save automatically.'}
          </p>
        </div>
        <div className="month-switcher">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() => void navigate(`/app/budget/${adjacentMonthStart(monthStart, -1)}`)}
          >
            <ArrowLeft aria-hidden="true" />
          </button>
          <button
            className="month-switcher__current"
            onClick={() => void navigate('/app/budget/current')}
          >
            This month
          </button>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() => void navigate(`/app/budget/${adjacentMonthStart(monthStart, 1)}`)}
          >
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>

      {readOnly && (
        <div className="inline-alert" role="status">
          <LockKeyhole aria-hidden="true" size={18} />
          Months become read-only when they are two calendar months old.
        </div>
      )}

      {remoteChange && (
        <div className="inline-alert" role="status">
          <CircleAlert aria-hidden="true" size={18} />
          This month changed in another tab. The latest saved values are shown.
          <button className="text-button" onClick={() => setRemoteChange(false)}>
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {actionError}
        </div>
      )}

      {(scheduleOccurrences.data?.length ?? 0) > 0 &&
        (() => {
          const expected = (scheduleOccurrences.data ?? []).filter(
            (entry) => entry.status === 'expected',
          );
          const nextIncome = expected.find((entry) => entry.item_type === 'income');
          const dueBeforeIncome = expected.filter(
            (entry) =>
              entry.item_type === 'expense' &&
              (!nextIncome || entry.due_date < nextIncome.due_date),
          );
          return (
            <aside className="budget-forecast-callout" aria-label="Upcoming cash flow">
              <CalendarClock aria-hidden="true" />
              <div>
                <strong>
                  {formatMoney(
                    dueBeforeIncome.reduce((total, entry) => total + entry.amount_minor, 0) / 100,
                    currency,
                    locale,
                  )}{' '}
                  due before your next expected income
                </strong>
                <span>
                  {nextIncome
                    ? `Next income: ${nextIncome.due_date}`
                    : 'No later income is scheduled this month.'}
                </span>
              </div>
              <Link to="/app/cash-flow">View cash flow</Link>
            </aside>
          );
        })()}

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-icon summary-icon--income">
            <TrendingUp aria-hidden="true" />
          </span>
          <div>
            <small>Income</small>
            <strong className="actual-amount">
              {formatMoney(progress.actual.income, currency, locale)} actual
            </strong>
            <dl className="progress-values">
              <div>
                <dt>Planned</dt>
                <dd>{formatMoney(progress.planned.income, currency, locale)}</dd>
              </div>
              <div>
                <dt>Variance</dt>
                <dd>{formatMoney(progress.incomeVariance, currency, locale)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{formatMoney(progress.incomeRemaining, currency, locale)}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article className="summary-card">
          <span className="summary-icon summary-icon--expense">
            <TrendingDown aria-hidden="true" />
          </span>
          <div>
            <small>Expenses</small>
            <strong className="actual-amount">
              {formatMoney(progress.actual.expenses, currency, locale)} actual
            </strong>
            <dl className="progress-values">
              <div>
                <dt>Planned</dt>
                <dd>{formatMoney(progress.planned.expenses, currency, locale)}</dd>
              </div>
              <div>
                <dt>Variance</dt>
                <dd>{formatMoney(progress.expenseVariance, currency, locale)}</dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{formatMoney(progress.expenseRemaining, currency, locale)}</dd>
              </div>
            </dl>
          </div>
        </article>
        <article
          className={`summary-card summary-card--remaining ${progress.available < 0 ? 'summary-card--negative' : ''}`}
        >
          <span className="summary-icon">
            <WalletCards aria-hidden="true" />
          </span>
          <div>
            <small>Available from your plan</small>
            <strong>{formatMoney(progress.available, currency, locale)}</strong>
            <dl className="progress-values">
              <div>
                <dt>Planned balance</dt>
                <dd>{formatMoney(progress.planned.remaining, currency, locale)}</dd>
              </div>
              <div>
                <dt>Actual balance</dt>
                <dd>{formatMoney(progress.actual.remaining, currency, locale)}</dd>
              </div>
              <div>
                <dt>Variance</dt>
                <dd>{formatMoney(progress.balanceVariance, currency, locale)}</dd>
              </div>
            </dl>
          </div>
        </article>
      </div>

      {(['income', 'expense'] as const).map((type) => {
        const sectionItems = itemsByType(type);
        const activeCount = sectionItems.filter((item) => !item.is_disabled).length;
        const pausedCount = sectionItems.length - activeCount;
        return (
          <section className="budget-section" key={type}>
            <div className="budget-section__heading">
              <div>
                <h2>{type === 'income' ? 'Income' : 'Expenses'}</h2>
                <span>
                  {activeCount} active{pausedCount ? `, ${pausedCount} paused` : ''}
                </span>
              </div>
              {!readOnly && (
                <Button
                  variant="secondary"
                  icon={<Plus aria-hidden="true" size={18} />}
                  onClick={() => setAddingType(type)}
                >
                  Add {type}
                </Button>
              )}
            </div>
            <div className="budget-list">
              {sectionItems.length ? (
                sectionItems.map((item) => (
                  <BudgetRow
                    key={item.id}
                    item={item}
                    progress={calculateItemProgress(item, budgetMonth.budget_transactions)}
                    currencyCode={currency}
                    locale={locale}
                    readOnly={readOnly}
                    onArchive={(entry) => void archive(entry)}
                    onToggleDisabled={(entry) => void toggleDisabled(entry)}
                    onChanged={refresh}
                    onDraft={updateDraft}
                  />
                ))
              ) : (
                <div className="empty-row">
                  <p>No {type} items yet.</p>
                  {!readOnly && (
                    <button className="text-button" onClick={() => setAddingType(type)}>
                      Add the first one
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {!readOnly && archivedItem && (
        <div className="undo-toast" role="status">
          <CheckCircle2 aria-hidden="true" size={19} />
          <span>{archivedItem.name_snapshot} archived</span>
          <button className="text-button" onClick={() => void undoArchive()}>
            Undo
          </button>
        </div>
      )}

      <Modal
        open={!readOnly && addingType !== null}
        title={`Add one-off ${addingType ?? 'item'}`}
        description="This changes only this month unless you also add it to your template."
        onClose={() => setAddingType(null)}
      >
        {addingType && (
          <AddMonthItemForm
            monthId={budgetMonth.id}
            itemType={addingType}
            categories={categories.data ?? []}
            defaultTemplate={defaultTemplate.data ?? null}
            onComplete={() => {
              setAddingType(null);
              refresh();
            }}
          />
        )}
      </Modal>
    </section>
  );
};
