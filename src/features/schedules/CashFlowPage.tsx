import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, List, Pencil, Plus, Power, SkipForward } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import {
  confirmPaymentOccurrence,
  createPaymentSchedule,
  retrieveMonthByStart,
  retrieveProfile,
  searchCategories,
  searchFinancialAccounts,
  searchPaymentScheduleOccurrences,
  searchPaymentSchedules,
  searchTemplates,
  updatePaymentSchedule,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart, formatMoney } from '../../shared/formatting/money';
import type { PaymentSchedule, PaymentScheduleOccurrence } from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import {
  calculateCashFlowProjection,
  addMinorUnitsExact,
  currentDateInTimeZone,
  findUncertainOccurrenceMatches,
} from './cashFlow';
import { ScheduleForm } from './ScheduleForm';

const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const CashFlowPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const client = useQueryClient();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [editing, setEditing] = useState<PaymentSchedule | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const today = currentDateInTimeZone(profile.data?.timezone);
  const fromDate = currentMonthStart(profile.data?.timezone);
  const through = addDays(today, 60);
  const schedules = useQuery({
    queryKey: queryKeys.schedules(userId),
    queryFn: searchPaymentSchedules,
  });
  const occurrences = useQuery({
    queryKey: queryKeys.scheduleOccurrences(userId, fromDate, through),
    queryFn: () => searchPaymentScheduleOccurrences(fromDate, through),
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId),
    queryFn: () => searchCategories(),
  });
  const templates = useQuery({ queryKey: queryKeys.templates(userId), queryFn: searchTemplates });
  const accounts = useQuery({
    queryKey: queryKeys.accounts(userId),
    queryFn: () => searchFinancialAccounts(),
  });
  const monthStart = currentMonthStart(profile.data?.timezone);
  const month = useQuery({
    queryKey: queryKeys.month(userId, monthStart),
    queryFn: () => retrieveMonthByStart(monthStart),
  });
  const entries = useMemo(() => occurrences.data ?? [], [occurrences.data]);
  const transactions = month.data?.budget_transactions ?? [];
  const projection = useMemo(
    () =>
      calculateCashFlowProjection({
        fromDate: today,
        toDate: through,
        openingBalanceMinor: (accounts.data ?? [])
          .filter((account) => account.currency_code === (profile.data?.currency_code ?? 'ZAR'))
          .reduce((total, account) => addMinorUnitsExact(total, account.balance_minor), 0),
        transactions: [],
        occurrences: entries,
      }),
    [accounts.data, entries, profile.data?.currency_code, through, today],
  );
  const nextIncome = entries.find(
    (entry) =>
      entry.item_type === 'income' && entry.status === 'expected' && entry.due_date >= today,
  );
  const beforeNextIncome = entries.filter(
    (entry) =>
      entry.item_type === 'expense' &&
      entry.status === 'expected' &&
      (!nextIncome || entry.due_date < nextIncome.due_date),
  );
  const upcoming = entries.filter((entry) => entry.due_date <= addDays(today, 7));
  const queryError =
    profile.error ??
    schedules.error ??
    occurrences.error ??
    categories.error ??
    templates.error ??
    accounts.error ??
    month.error;
  if (
    profile.isLoading ||
    schedules.isLoading ||
    occurrences.isLoading ||
    categories.isLoading ||
    templates.isLoading ||
    accounts.isLoading ||
    month.isLoading
  )
    return <LoadingState label="Loading your cash-flow forecast…" />;
  if (queryError)
    return (
      <ErrorState
        message={queryError.message}
        retry={() => void client.invalidateQueries({ queryKey: ['user', userId] })}
      />
    );
  const currency = profile.data?.currency_code ?? 'ZAR';
  const locale = profile.data?.locale ?? 'en-ZA';
  const save = async (input: Parameters<typeof createPaymentSchedule>[0]) => {
    if (editing) await updatePaymentSchedule(editing.id, input);
    else await createPaymentSchedule(input);
    setEditing(undefined);
    setMessage(editing ? 'Schedule updated.' : 'Schedule created.');
    await client.invalidateQueries({ queryKey: ['user', userId] });
  };
  const toggle = async (schedule: PaymentSchedule) => {
    await updatePaymentSchedule(schedule.id, { ...schedule, enabled: !schedule.enabled });
    setMessage(
      schedule.enabled ? 'Future occurrences disabled; history was kept.' : 'Schedule enabled.',
    );
    await client.invalidateQueries({ queryKey: ['user', userId] });
  };
  const confirm = async (entry: PaymentScheduleOccurrence, transactionId: string | null = null) => {
    try {
      await confirmPaymentOccurrence(
        entry.id,
        entry.item_type === 'income' ? 'received' : 'paid',
        transactionId,
      );
      setMessage(
        transactionId
          ? 'Transaction matched after your confirmation.'
          : `${entry.name_snapshot} marked ${entry.item_type === 'income' ? 'received' : 'paid'}.`,
      );
      setError(null);
      await client.invalidateQueries({ queryKey: ['user', userId] });
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'The occurrence could not be updated.',
      );
    }
  };
  const skip = async (entry: PaymentScheduleOccurrence) => {
    try {
      await confirmPaymentOccurrence(entry.id, 'skipped');
      setMessage(`${entry.name_snapshot} skipped. It will not affect the forecast.`);
      setError(null);
      await client.invalidateQueries({ queryKey: ['user', userId] });
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'The occurrence could not be skipped.',
      );
    }
  };
  return (
    <section className="page cash-flow-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Know what comes next</p>
          <h1>Cash-flow calendar</h1>
          <p>Forecasts stay separate from posted transactions until you confirm a match.</p>
        </div>
        <Button icon={<Plus aria-hidden="true" size={18} />} onClick={() => setEditing(null)}>
          New schedule
        </Button>
      </header>
      {message && (
        <div className="inline-alert" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      <section className="cash-flow-summary" aria-label="Cash-flow summary">
        <article>
          <small>Due before next income</small>
          <strong>
            {formatMoney(
              beforeNextIncome.reduce(
                (sum, entry) => addMinorUnitsExact(sum, entry.amount_minor),
                0,
              ) / 100,
              currency,
              locale,
            )}
          </strong>
          <span>
            {beforeNextIncome.length} obligation{beforeNextIncome.length === 1 ? '' : 's'}
          </span>
        </article>
        <article>
          <small>Next expected income</small>
          <strong>
            {nextIncome
              ? formatMoney(nextIncome.amount_minor / 100, currency, locale)
              : 'None scheduled'}
          </strong>
          <span>{nextIncome?.due_date ?? 'Add an income schedule'}</span>
        </article>
        <article className={projection.lowestBalanceMinor < 0 ? 'cash-flow-summary__risk' : ''}>
          <small>Lowest projected balance</small>
          <strong>{formatMoney(projection.lowestBalanceMinor / 100, currency, locale)}</strong>
          <span>Next 60 days · forecast</span>
        </article>
      </section>
      <section className="forecast-panel">
        <header>
          <div>
            <h2>Upcoming seven days</h2>
            <p>Expected items are forecasts, not actual transactions.</p>
          </div>
          <div className="segmented-control" aria-label="Forecast view">
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <List size={17} /> List
            </button>
            <button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')}>
              <CalendarDays size={17} /> Calendar
            </button>
          </div>
        </header>
        {view === 'list' ? (
          <div className="occurrence-list">
            {upcoming.length ? (
              upcoming.map((entry) => {
                const candidates = findUncertainOccurrenceMatches(entry, transactions);
                return (
                  <article
                    className={`occurrence-row occurrence-row--${entry.item_type}`}
                    key={entry.id}
                  >
                    <time dateTime={entry.due_date}>{entry.due_date}</time>
                    <div>
                      <strong>{entry.name_snapshot}</strong>
                      <span>
                        {entry.amount_is_approximate ? 'Approx. ' : ''}
                        {formatMoney(entry.amount_minor / 100, currency, locale)} ·{' '}
                        {entry.status === 'expected' && entry.due_date < today
                          ? 'overdue'
                          : entry.status}
                      </span>
                    </div>
                    {entry.status === 'expected' && (
                      <div className="occurrence-row__actions">
                        {candidates.length === 1 && (
                          <Button
                            variant="ghost"
                            onClick={() => void confirm(entry, candidates[0].id)}
                          >
                            Match {candidates[0].description}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          icon={<Check size={16} />}
                          onClick={() => void confirm(entry)}
                        >
                          Mark {entry.item_type === 'income' ? 'received' : 'paid'}
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<SkipForward size={16} />}
                          onClick={() => void skip(entry)}
                        >
                          Skip
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <p className="empty-state">Nothing due in the next seven days.</p>
            )}
          </div>
        ) : (
          <div className="cash-calendar">
            {Array.from({ length: 7 }, (_, index) => addDays(today, index)).map((date) => (
              <article key={date}>
                <time dateTime={date}>
                  {new Intl.DateTimeFormat(locale, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  }).format(new Date(`${date}T00:00:00Z`))}
                </time>
                {upcoming
                  .filter((entry) => entry.due_date === date)
                  .map((entry) => (
                    <span
                      className={`calendar-event calendar-event--${entry.item_type}`}
                      key={entry.id}
                    >
                      {entry.name_snapshot}
                      <small>{formatMoney(entry.amount_minor / 100, currency, locale)}</small>
                    </span>
                  ))}
                <footer>
                  <small>Projected balance</small>
                  <strong>
                    {formatMoney(
                      (projection.days.find((day) => day.date === date)?.balanceMinor ?? 0) / 100,
                      currency,
                      locale,
                    )}
                  </strong>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="schedule-list">
        <header>
          <div>
            <h2>Payment schedules</h2>
            <p>Disabling a schedule stops future forecasts and keeps occurrence history.</p>
          </div>
        </header>
        {(schedules.data ?? []).length ? (
          schedules.data?.map((schedule) => (
            <article key={schedule.id}>
              <div>
                <strong>{schedule.name}</strong>
                <span>
                  {schedule.recurrence.replace('_', ' ')} ·{' '}
                  {formatMoney(schedule.amount_minor / 100, currency, locale)}
                  {schedule.amount_is_approximate ? ' approximate' : ''}
                </span>
              </div>
              <span className={`status-pill ${schedule.enabled ? '' : 'status-pill--muted'}`}>
                {schedule.enabled
                  ? `Next ${schedule.next_occurrence ?? 'when a month exists'}`
                  : 'Disabled'}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label={`Edit ${schedule.name}`}
                  onClick={() => setEditing(schedule)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${schedule.enabled ? 'Disable' : 'Enable'} ${schedule.name}`}
                  onClick={() => void toggle(schedule)}
                >
                  <Power size={17} />
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">
            No schedules yet. Add income or expenses to see what is due ahead.
          </p>
        )}
      </section>
      <Modal
        open={editing !== undefined}
        title={editing ? 'Edit payment schedule' : 'New payment schedule'}
        description="Schedules forecast future cash flow without creating actual transactions."
        onClose={() => setEditing(undefined)}
      >
        {editing !== undefined && (
          <ScheduleForm
            schedule={editing}
            categories={categories.data ?? []}
            templates={templates.data ?? []}
            timezone={profile.data?.timezone ?? 'UTC'}
            onSave={save}
          />
        )}
      </Modal>
    </section>
  );
};
