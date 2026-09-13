import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
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
  updateLastLocation,
  updateMonthItem,
} from '../../data/repositories/budgetRepository';
import {
  adjacentMonthStart,
  calculateTotals,
  currentMonthStart,
  formatMoney,
  formatMonth,
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
  const current = currentMonthStart();
  const monthStart = routeMonth === 'current' || !routeMonth ? current : routeMonth;
  const [addingType, setAddingType] = useState<ItemType | null>(() =>
    searchParams.get('add') === 'expense' ? 'expense' : null,
  );
  const [archivedItem, setArchivedItem] = useState<BudgetMonthItem | null>(null);
  const [archivingItemIds, setArchivingItemIds] = useState<Set<string>>(() => new Set());
  const [remoteChange, setRemoteChange] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingRemoteRefresh = useRef(false);
  const monthKey = useMemo(() => queryKeys.month(userId, monthStart), [monthStart, userId]);

  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const defaultTemplate = useQuery({
    queryKey: queryKeys.defaultTemplate(userId),
    queryFn: retrieveDefaultTemplate,
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId),
    queryFn: () => searchCategories(),
  });
  const month = useQuery({
    queryKey: monthKey,
    queryFn: () => retrieveMonthByStart(monthStart),
    enabled: validMonth.test(monthStart),
  });
  const loadedMonthId = month.data?.id;
  const createMonth = useMutation({
    mutationFn: async () => {
      if (!defaultTemplate.data) throw new Error('Create a default template first.');
      return createMonthFromTemplate(monthStart, defaultTemplate.data.id);
    },
    onSuccess: (created) => queryClient.setQueryData(monthKey, created),
  });

  useEffect(() => {
    if (!loadedMonthId) return;
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
  }, [loadedMonthId, monthKey, queryClient]);

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
  if (month.isLoading || defaultTemplate.isLoading || profile.isLoading || categories.isLoading) {
    return <LoadingState label="Opening your month…" />;
  }
  if (month.error || defaultTemplate.error || profile.error || categories.error) {
    const error = month.error ?? defaultTemplate.error ?? profile.error ?? categories.error;
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
        {defaultTemplate.data ? (
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
  const totals = calculateTotals(visibleBudgetItems);
  const locale = profile.data?.locale ?? 'en-ZA';
  const currency = budgetMonth.currency_code;
  const itemsByType = (type: ItemType) =>
    visibleBudgetItems.filter((item) => item.item_type === type && item.archived_at === null);
  const updateDraft = (id: string, amount: string) => {
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
    if (!archivedItem) return;
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
          <p>Adjust the plan as life happens. Changes save automatically.</p>
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

      <div className="summary-grid">
        <article className="summary-card">
          <span className="summary-icon summary-icon--income">
            <TrendingUp aria-hidden="true" />
          </span>
          <div>
            <small>Total income</small>
            <strong>{formatMoney(totals.income, currency, locale)}</strong>
          </div>
        </article>
        <article className="summary-card">
          <span className="summary-icon summary-icon--expense">
            <TrendingDown aria-hidden="true" />
          </span>
          <div>
            <small>Total expenses</small>
            <strong>{formatMoney(totals.expenses, currency, locale)}</strong>
          </div>
        </article>
        <article
          className={`summary-card summary-card--remaining ${totals.remaining < 0 ? 'summary-card--negative' : ''}`}
        >
          <span className="summary-icon">
            <WalletCards aria-hidden="true" />
          </span>
          <div>
            <small>Remaining</small>
            <strong>{formatMoney(totals.remaining, currency, locale)}</strong>
            <span>
              {totals.savingsRate === null
                ? 'Savings rate unavailable with zero income'
                : `${totals.savingsRate.toFixed(1)}% savings rate`}
            </span>
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
              <Button
                variant="secondary"
                icon={<Plus aria-hidden="true" size={18} />}
                onClick={() => setAddingType(type)}
              >
                Add {type}
              </Button>
            </div>
            <div className="budget-list">
              {sectionItems.length ? (
                sectionItems.map((item) => (
                  <BudgetRow
                    key={item.id}
                    item={item}
                    currencyCode={currency}
                    onArchive={(entry) => void archive(entry)}
                    onToggleDisabled={(entry) => void toggleDisabled(entry)}
                    onChanged={refresh}
                    onDraft={updateDraft}
                  />
                ))
              ) : (
                <div className="empty-row">
                  <p>No {type} items yet.</p>
                  <button className="text-button" onClick={() => setAddingType(type)}>
                    Add the first one
                  </button>
                </div>
              )}
            </div>
          </section>
        );
      })}

      {archivedItem && (
        <div className="undo-toast" role="status">
          <CheckCircle2 aria-hidden="true" size={19} />
          <span>{archivedItem.name_snapshot} archived</span>
          <button className="text-button" onClick={() => void undoArchive()}>
            Undo
          </button>
        </div>
      )}

      <Modal
        open={addingType !== null}
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
