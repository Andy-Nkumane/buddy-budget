import { useQuery } from '@tanstack/react-query';
import { BarChart3, Lightbulb, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import {
  retrieveBudgetInsights,
  retrieveProfile,
  searchCategories,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart, formatMoney, formatMonth } from '../../shared/formatting/money';
import { formatGoalPriority } from '../../shared/reporting/budgetReport';
import type { InsightMonthlyMetric } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import {
  describeSavingsTrend,
  findRepeatedOverspending,
  resolveInsightRange,
  selectVarianceAction,
  type InsightRangePreset,
} from './insights';

const currentMonth = currentMonthStart().slice(0, 7);

const formatMinor = (minor: number, currency: string, locale: string) =>
  formatMoney(minor / 100, currency, locale);

const formatSignedMinor = (minor: number, currency: string, locale: string) =>
  `${minor > 0 ? '+' : minor < 0 ? '−' : ''}${formatMinor(Math.abs(minor), currency, locale)}`;

const MonthBars = ({ months, locale }: { months: InsightMonthlyMetric[]; locale: string }) => {
  const maximum = Math.max(
    1,
    ...months.flatMap((month) => [month.planned_expenses_minor, month.actual_expenses_minor]),
  );
  return (
    <div className="insight-bars" aria-hidden="true">
      {months.map((month) => (
        <div className="insight-bars__month" key={month.month_start}>
          <small>{formatMonth(month.month_start, locale).slice(0, 3)}</small>
          <progress
            className="insight-bar insight-bar--planned"
            max={maximum}
            value={month.planned_expenses_minor}
          />
          <progress
            className="insight-bar insight-bar--actual"
            max={maximum}
            value={month.actual_expenses_minor}
          />
        </div>
      ))}
    </div>
  );
};

export const InsightsPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [preset, setPreset] = useState<InsightRangePreset>('last6');
  const [customFrom, setCustomFrom] = useState(currentMonth);
  const [customTo, setCustomTo] = useState(currentMonth);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const initialRange = resolveInsightRange('last6', '', '');
  const [filters, setFilters] = useState({ ...initialRange, categoryIds: [] as string[] });
  const [filterError, setFilterError] = useState<string | null>(null);
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId, true),
    queryFn: () => searchCategories(true),
  });
  const insights = useQuery({
    queryKey: queryKeys.insights(userId, filters.fromMonth, filters.toMonth, filters.categoryIds),
    queryFn: () =>
      retrieveBudgetInsights({
        fromMonth: filters.fromMonth,
        toMonth: filters.toMonth,
        categoryIds: filters.categoryIds,
      }),
    enabled: Boolean(userId && filters.fromMonth && filters.toMonth),
  });
  const locale = profile.data?.locale ?? 'en-ZA';
  const data = insights.data;
  const repeatedOverspending = useMemo(
    () => findRepeatedOverspending(data?.categories ?? []),
    [data?.categories],
  );

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const range = resolveInsightRange(preset, customFrom, customTo);
    if (!range.fromMonth || !range.toMonth) {
      setFilterError('Choose both a start month and an end month.');
      return;
    }
    if (range.fromMonth > range.toMonth) {
      setFilterError('The start month must not follow the end month.');
      return;
    }
    setFilterError(null);
    setFilters({ ...range, categoryIds: [...categoryIds].sort() });
  };

  return (
    <section className="page insights-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Decide with evidence</p>
          <h1>Budget insights</h1>
          <p>See what changed, why it matters, and what to do next.</p>
        </div>
      </header>

      <form className="surface-card insights-filters" onSubmit={applyFilters}>
        <header>
          <SlidersHorizontal aria-hidden="true" size={20} />
          <h2>Choose the evidence</h2>
        </header>
        <div className="insights-filters__fields">
          <SelectField
            label="Date range"
            value={preset}
            onChange={(event) => setPreset(event.target.value as InsightRangePreset)}
          >
            <option value="last3">Last 3 months</option>
            <option value="last6">Last 6 months</option>
            <option value="last12">Last 12 months</option>
            <option value="ytd">Year to date</option>
            <option value="custom">Custom range</option>
          </SelectField>
          {preset === 'custom' && (
            <>
              <FormField
                label="Start month"
                type="month"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
              <FormField
                label="End month"
                type="month"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
              />
            </>
          )}
          <details className="insights-category-select">
            <summary>
              <span>Categories</span>
              <strong>
                {categoryIds.length === 0
                  ? 'All categories'
                  : `${categoryIds.length} categor${categoryIds.length === 1 ? 'y' : 'ies'} selected`}
              </strong>
            </summary>
            <fieldset className="insights-category-checklist">
              <legend className="sr-only">Select categories</legend>
              <label>
                <input
                  type="checkbox"
                  checked={categoryIds.length === 0}
                  onChange={() => setCategoryIds([])}
                />
                All categories
              </label>
              {categories.data?.map((category) => (
                <label key={category.id}>
                  <input
                    type="checkbox"
                    checked={categoryIds.includes(category.id)}
                    onChange={(event) =>
                      setCategoryIds((current) =>
                        event.target.checked
                          ? [...current, category.id]
                          : current.filter((id) => id !== category.id),
                      )
                    }
                  />
                  {category.name} ({category.item_type})
                </label>
              ))}
            </fieldset>
          </details>
          <Button className="insights-filters__submit" type="submit">
            Apply filters
          </Button>
        </div>
        {filterError && <div className="inline-alert inline-alert--error">{filterError}</div>}
      </form>

      {insights.isLoading && <LoadingState />}
      {insights.isError && <ErrorState message={insights.error.message} />}
      {data && data.month_count === 0 && (
        <section className="surface-card empty-state">
          <BarChart3 aria-hidden="true" size={32} />
          <h2>No months in this range</h2>
          <p>This is missing data, not a zero result. Choose another range or create a month.</p>
        </section>
      )}
      {data && data.month_count > 0 && (
        <>
          {data.month_count < 3 && (
            <div className="inline-alert" role="status">
              Early signal: only {data.month_count} month{data.month_count === 1 ? '' : 's'} of data
              is available. Trends become more reliable from three months onward.
            </div>
          )}
          {data.currencies.length > 1 && (
            <div className="inline-alert" role="status">
              Multiple currencies are shown separately. Buddy Budget does not apply exchange rates
              or combine unlike currencies.
            </div>
          )}
          {filters.categoryIds.length > 0 && (
            <div className="inline-alert" role="status">
              Category mode excludes unattributed historical adjustments. Savings-rate and income
              stability conclusions are withheld because selected categories are not a whole budget.
            </div>
          )}

          <section className="surface-card insight-decision" aria-labelledby="insight-action">
            <Lightbulb aria-hidden="true" size={24} />
            <div>
              <p className="eyebrow">Recommended next action</p>
              <h2 id="insight-action">{selectVarianceAction(data.monthly, data.categories)}</h2>
              <p>
                This deterministic recommendation prioritises repeated overspending, then the latest
                expense or income variance. It does not predict future activity.
              </p>
            </div>
          </section>

          {data.currencies.map((currency) => {
            const months = data.monthly.filter((month) => month.currency_code === currency);
            const currencyCategories = data.categories.filter(
              (category) => category.currency_code === currency,
            );
            const stability = data.income_stability.find(
              (entry) => entry.currency_code === currency,
            );
            return (
              <section
                className="insight-currency"
                aria-labelledby={`currency-${currency}`}
                key={currency}
              >
                <header>
                  <p className="eyebrow">Currency view</p>
                  <h2 id={`currency-${currency}`}>{currency}</h2>
                </header>

                <article className="surface-card insight-block">
                  <header>
                    <div>
                      <h3>Planned versus actual</h3>
                      <p>
                        The chart compares expenses; the table also traces income. Posted refunds
                        reverse actuals and active items provide the plan.
                      </p>
                    </div>
                    <div className="insight-legend" aria-label="Chart legend">
                      <span>
                        <i className="legend-swatch legend-swatch--planned" />
                        Planned
                      </span>
                      <span>
                        <i className="legend-swatch legend-swatch--actual" />
                        Actual
                      </span>
                    </div>
                  </header>
                  <MonthBars months={months} locale={locale} />
                  <div className="table-scroll">
                    <table>
                      <caption>Monthly planned and actual values shown in the chart</caption>
                      <thead>
                        <tr>
                          <th scope="col">Month</th>
                          <th scope="col">Planned income</th>
                          <th scope="col">Actual income</th>
                          <th scope="col">Income variance</th>
                          <th scope="col">Planned expenses</th>
                          <th scope="col">Actual expenses</th>
                          <th scope="col">Expense variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((month) => (
                          <tr key={month.month_start}>
                            <th scope="row">{formatMonth(month.month_start, locale)}</th>
                            <td>{formatMinor(month.planned_income_minor, currency, locale)}</td>
                            <td>{formatMinor(month.actual_income_minor, currency, locale)}</td>
                            <td>
                              {formatSignedMinor(month.income_variance_minor, currency, locale)}
                            </td>
                            <td>{formatMinor(month.planned_expenses_minor, currency, locale)}</td>
                            <td>{formatMinor(month.actual_expenses_minor, currency, locale)}</td>
                            <td>
                              {formatSignedMinor(month.expense_variance_minor, currency, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <footer>
                    <strong>Action:</strong> {selectVarianceAction(months, currencyCategories)}
                  </footer>
                </article>

                <div className="insight-grid">
                  <article className="surface-card insight-block">
                    <h3>Savings-rate trend</h3>
                    <p>
                      {filters.categoryIds.length
                        ? 'Unavailable for a category-only view.'
                        : describeSavingsTrend(months)}
                    </p>
                    <ul className="metric-list">
                      {months.map((month) => (
                        <li key={month.month_start}>
                          <span>{formatMonth(month.month_start, locale)}</span>
                          <strong>
                            {month.savings_rate_basis_points === null
                              ? 'Not available'
                              : `${month.savings_rate_basis_points / 100}%`}
                          </strong>
                        </li>
                      ))}
                    </ul>
                    <footer>
                      <strong>Action:</strong> If the rate is falling, review expense growth before
                      increasing goal contributions.
                    </footer>
                  </article>
                  <article className="surface-card insight-block">
                    <h3>Income stability</h3>
                    {!stability || stability.range_basis_points === null ? (
                      <p>
                        Insufficient or inapplicable data. Three whole-budget months with positive
                        average income are required.
                      </p>
                    ) : (
                      <p>
                        Income ranges from{' '}
                        {formatMinor(stability.minimum_income_minor, currency, locale)} to{' '}
                        {formatMinor(stability.maximum_income_minor, currency, locale)}—a spread
                        equal to {stability.range_basis_points / 100}% of average income.
                      </p>
                    )}
                    {stability && (
                      <dl className="metric-pair">
                        <div>
                          <dt>Average</dt>
                          <dd>{formatMinor(stability.average_income_minor, currency, locale)}</dd>
                        </div>
                        <div>
                          <dt>Months with income</dt>
                          <dd>
                            {stability.months_with_income} of {stability.months_observed}
                          </dd>
                        </div>
                      </dl>
                    )}
                    <footer>
                      <strong>Action:</strong> Base fixed commitments on the lowest observed income
                      when earnings vary materially.
                    </footer>
                  </article>
                </div>

                <article className="surface-card insight-block">
                  <h3>Category averages and repeated overspending</h3>
                  <p>
                    An overspent month has posted category expenses above its active category plan.
                    At least two occurrences count as repeated.
                  </p>
                  {currencyCategories.length ? (
                    <div className="table-scroll">
                      <table>
                        <caption>Category evidence and averages</caption>
                        <thead>
                          <tr>
                            <th scope="col">Category</th>
                            <th scope="col">Type</th>
                            <th scope="col">Monthly average</th>
                            <th scope="col">Total variance</th>
                            <th scope="col">Overspent months</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currencyCategories.map((category) => (
                            <tr key={`${category.category_id ?? 'none'}-${category.item_type}`}>
                              <th scope="row">{category.category_name}</th>
                              <td>{category.item_type}</td>
                              <td>
                                {formatMinor(category.average_actual_minor, currency, locale)}
                              </td>
                              <td>
                                {formatSignedMinor(category.variance_minor, currency, locale)}
                              </td>
                              <td>
                                {category.item_type === 'expense'
                                  ? category.overspent_months
                                  : 'Not applicable'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No category activity exists in this range.</p>
                  )}
                  <footer>
                    <strong>Action:</strong>{' '}
                    {repeatedOverspending.length
                      ? `Start with ${repeatedOverspending[0].category_name}, the strongest repeated overspending signal.`
                      : 'No repeated overspending is evidenced in this range; keep monitoring rather than changing plans prematurely.'}
                  </footer>
                </article>
              </section>
            );
          })}

          <div className="insight-grid">
            <article className="surface-card insight-block">
              <h2>Recurring amount changes</h2>
              <p>
                Compares consecutive monthly totals for transactions explicitly tagged as recurring.
              </p>
              {data.recurring_changes.length ? (
                <ul className="metric-list">
                  {data.recurring_changes.slice(0, 8).map((change) => (
                    <li
                      key={`${change.description}-${change.current_month}-${change.currency_code}`}
                    >
                      <span>
                        <strong>{change.description}</strong>
                        <small>
                          {formatMonth(change.previous_month, locale)} to{' '}
                          {formatMonth(change.current_month, locale)}
                        </small>
                      </span>
                      <strong>
                        {formatSignedMinor(change.change_minor, change.currency_code, locale)}
                      </strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No changed recurring totals were found. This is zero observed change, not proof
                  that every bill is unchanged.
                </p>
              )}
              <footer>
                <strong>Action:</strong> Verify increases against bills before updating future
                templates.
              </footer>
            </article>
            <article className="surface-card insight-block">
              <h2>Largest discretionary expenses</h2>
              <p>
                Up to ten largest posted, non-refund expenses per currency that are not matched to a
                payment schedule. “Discretionary” is a scheduling proxy, not a judgement about
                necessity.
              </p>
              {data.largest_discretionary.length ? (
                <ol className="metric-list">
                  {data.largest_discretionary.map((expense) => (
                    <li key={expense.id}>
                      <span>
                        <strong>{expense.description}</strong>
                        <small>
                          {expense.transaction_date} · {expense.category_name}
                        </small>
                      </span>
                      <strong>
                        {formatMinor(expense.amount_minor, expense.currency_code, locale)}
                      </strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No qualifying expenses were found.</p>
              )}
              <footer>
                <strong>Action:</strong> Review the largest item first and schedule it if it is
                actually recurring or essential.
              </footer>
            </article>
          </div>

          <article className="surface-card insight-block">
            <h2>Goal progress</h2>
            <p>
              Starting balance plus valid contributions for savings goals; contributions paid down
              for debt goals. Archived goals are excluded.
            </p>
            {data.goals.length ? (
              <div className="table-scroll">
                <table>
                  <caption>Current goal progress through the selected end month</caption>
                  <thead>
                    <tr>
                      <th scope="col">Goal</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Progress</th>
                      <th scope="col">Remaining</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.goals.map((goal) => (
                      <tr key={goal.goal_id}>
                        <th scope="row">{goal.name}</th>
                        <td>{formatGoalPriority(goal.priority)}</td>
                        <td>{goal.progress_basis_points / 100}%</td>
                        <td>{formatMinor(goal.remaining_minor, goal.currency_code, locale)}</td>
                        <td>{goal.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No active, paused, or completed goals match this view.</p>
            )}
            <footer>
              <strong>Action:</strong> Review the highest-priority goal with a remaining balance
              without treating transfers as expenses.
            </footer>
          </article>

          <aside className="insight-methodology">
            <h2>How these numbers work</h2>
            <p>
              All aggregation runs in PostgreSQL using integer minor units over at most 60 months.
              Posted refunds reverse their transaction type. Paused plan items contribute zero
              planned value while their real transactions remain actual. Whole-month totals include
              explicit historical adjustments; category totals do not assign categoryless
              adjustments. Negative or zero income has no savings-rate percentage.
            </p>
          </aside>
        </>
      )}
    </section>
  );
};
