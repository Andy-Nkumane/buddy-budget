import {
  calculateBudgetProgress,
  calculateItemProgress,
  formatMoney,
  formatMonth,
} from '../../shared/formatting/money';
import {
  calculateReportTotalsByCurrency,
  formatGoalPriority,
  formatSignedReportAmount,
  formatSignedTransactionAmount,
} from '../../shared/reporting/budgetReport';
import type { BudgetMonthWithItems, Profile } from '../../shared/types/domain';

interface BudgetReportPreviewProps {
  months: BudgetMonthWithItems[];
  profile: Profile;
  rangeLabel: string;
  includeForecast?: boolean;
}

export const BudgetReportPreview = ({
  months,
  profile,
  rangeLabel,
  includeForecast = false,
}: BudgetReportPreviewProps) => {
  const totalsByCurrency = calculateReportTotalsByCurrency(months);

  return (
    <article className="report-preview">
      <header className="report-preview__header">
        <p className="eyebrow">Buddy Budget report</p>
        <h2>{rangeLabel}</h2>
        <p>
          Prepared for {profile.display_name || 'Buddy Budget user'} on{' '}
          {new Intl.DateTimeFormat(profile.locale, { dateStyle: 'long' }).format(new Date())}.
        </p>
      </header>
      <section className="report-preview__section" aria-labelledby="report-summary-heading">
        <h3 id="report-summary-heading">Range summary</h3>
        <div className="report-preview__table-wrap">
          <table>
            <caption className="visually-hidden">
              Planned and actual totals for the selected date range
            </caption>
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col">Planned income</th>
                <th scope="col">Actual income</th>
                <th scope="col">Planned expenses</th>
                <th scope="col">Actual expenses</th>
                <th scope="col">Available</th>
              </tr>
            </thead>
            <tbody>
              {totalsByCurrency.map((totals) => (
                <tr key={totals.currency}>
                  <th scope="row">{totals.currency}</th>
                  <td>{formatMoney(totals.plannedIncome, totals.currency, profile.locale)}</td>
                  <td className="report-amount report-amount--income">
                    {formatSignedReportAmount(
                      totals.actualIncome,
                      'income',
                      totals.currency,
                      profile.locale,
                    )}
                  </td>
                  <td>{formatMoney(totals.plannedExpenses, totals.currency, profile.locale)}</td>
                  <td className="report-amount report-amount--expense">
                    {formatSignedReportAmount(
                      totals.actualExpenses,
                      'expense',
                      totals.currency,
                      profile.locale,
                    )}
                  </td>
                  <td>{formatMoney(totals.available, totals.currency, profile.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {months.map((month) => {
        const progress = calculateBudgetProgress(
          month.budget_month_items,
          month.budget_transactions,
        );
        const headingId = `report-month-${month.id}`;
        return (
          <section className="report-preview__section" aria-labelledby={headingId} key={month.id}>
            <h3 id={headingId}>{formatMonth(month.month_start, profile.locale)}</h3>
            <dl className="report-preview__totals report-preview__totals--four">
              <div>
                <dt>Planned income</dt>
                <dd>{formatMoney(progress.planned.income, month.currency_code, profile.locale)}</dd>
              </div>
              <div>
                <dt>Actual income</dt>
                <dd className="report-amount report-amount--income">
                  {formatSignedReportAmount(
                    progress.actual.income,
                    'income',
                    month.currency_code,
                    profile.locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>Planned expenses</dt>
                <dd>
                  {formatMoney(progress.planned.expenses, month.currency_code, profile.locale)}
                </dd>
              </div>
              <div>
                <dt>Actual expenses</dt>
                <dd className="report-amount report-amount--expense">
                  {formatSignedReportAmount(
                    progress.actual.expenses,
                    'expense',
                    month.currency_code,
                    profile.locale,
                  )}
                </dd>
              </div>
            </dl>
            <h4>Budget items</h4>
            <div className="report-preview__table-wrap">
              <table>
                <caption className="visually-hidden">
                  Planned and actual items for {formatMonth(month.month_start, profile.locale)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Status</th>
                    <th scope="col">Planned</th>
                    <th scope="col">Actual</th>
                    <th scope="col">Variance</th>
                    <th scope="col">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {month.budget_month_items.map((item) => {
                    const itemProgress = calculateItemProgress(item, month.budget_transactions);
                    return (
                      <tr
                        className={item.is_disabled ? 'report-preview__paused' : ''}
                        key={item.id}
                      >
                        <th scope="row">
                          {item.name_snapshot}
                          <small>{item.category_snapshot ?? 'Uncategorised'}</small>
                        </th>
                        <td>{item.is_disabled ? 'Paused' : 'Active'}</td>
                        <td>
                          {formatMoney(itemProgress.planned, month.currency_code, profile.locale)}
                        </td>
                        <td className="actual-amount">
                          {formatMoney(itemProgress.actual, month.currency_code, profile.locale)}
                        </td>
                        <td>
                          {formatMoney(itemProgress.variance, month.currency_code, profile.locale)}
                        </td>
                        <td>
                          {formatMoney(itemProgress.remaining, month.currency_code, profile.locale)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <h4>Transactions</h4>
            {month.budget_transactions.length ? (
              <div className="report-preview__table-wrap">
                <table>
                  <caption className="visually-hidden">
                    Transactions for {formatMonth(month.month_start, profile.locale)}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Description</th>
                      <th scope="col">Assignment</th>
                      <th scope="col">Status</th>
                      <th scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {month.budget_transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.transaction_date}</td>
                        <th scope="row">{transaction.description}</th>
                        <td>
                          {transaction.budget_item_snapshot ??
                            transaction.category_snapshot ??
                            'Unassigned'}
                        </td>
                        <td>
                          {transaction.is_refund
                            ? `${transaction.status} refund`
                            : transaction.status}
                        </td>
                        <td
                          className={`report-amount report-amount--${transaction.transaction_type}`}
                        >
                          {formatSignedTransactionAmount(
                            transaction,
                            month.currency_code,
                            profile.locale,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No transactions recorded.</p>
            )}
            {includeForecast && (
              <>
                <h4>Schedule forecast</h4>
                {(month.payment_schedule_occurrences?.length ?? 0) > 0 ? (
                  <div className="report-preview__table-wrap">
                    <table>
                      <caption className="visually-hidden">
                        Schedule forecast for {formatMonth(month.month_start, profile.locale)}
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Due</th>
                          <th scope="col">Item</th>
                          <th scope="col">State</th>
                          <th scope="col">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {month.payment_schedule_occurrences?.map((occurrence) => (
                          <tr key={occurrence.id}>
                            <td>{occurrence.due_date}</td>
                            <th scope="row">
                              {occurrence.name_snapshot}
                              {occurrence.amount_is_approximate ? ' (approx.)' : ''}
                            </th>
                            <td>
                              {occurrence.matched_transaction_id
                                ? `${occurrence.status} · matched`
                                : occurrence.status}
                            </td>
                            <td className={`report-amount report-amount--${occurrence.item_type}`}>
                              {formatSignedReportAmount(
                                occurrence.amount_minor / 100,
                                occurrence.item_type,
                                month.currency_code,
                                profile.locale,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>No scheduled items.</p>
                )}
              </>
            )}
            {(month.goal_month_recommendations?.length ?? 0) > 0 && (
              <>
                <h4>Goal contribution plan</h4>
                <div className="report-preview__table-wrap">
                  <table>
                    <caption className="visually-hidden">
                      Goal allocations for {formatMonth(month.month_start, profile.locale)}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Goal</th>
                        <th scope="col">Type</th>
                        <th scope="col">Priority</th>
                        <th scope="col">Recommended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {month.goal_month_recommendations?.map((recommendation) => (
                        <tr key={recommendation.id}>
                          <th scope="row">{recommendation.name_snapshot}</th>
                          <td>{recommendation.goal_type.replace('_', ' ')}</td>
                          <td>{formatGoalPriority(recommendation.priority)}</td>
                          <td>
                            {formatMoney(
                              recommendation.recommended_amount_minor / 100,
                              month.currency_code,
                              profile.locale,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {(month.goal_contributions?.length ?? 0) > 0 && (
              <>
                <h4>Recorded goal contributions</h4>
                <div className="report-preview__table-wrap">
                  <table>
                    <caption className="visually-hidden">
                      Recorded goal contributions for{' '}
                      {formatMonth(month.month_start, profile.locale)}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Goal</th>
                        <th scope="col">Source</th>
                        <th scope="col">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {month.goal_contributions?.map((contribution) => (
                        <tr key={contribution.id}>
                          <td>{contribution.contribution_date}</td>
                          <th scope="row">{contribution.goal_name_snapshot}</th>
                          <td>
                            {contribution.transaction_id ? 'Transaction linked' : 'Manual record'}
                          </td>
                          <td>
                            {formatMoney(
                              contribution.amount_minor / 100,
                              month.currency_code,
                              profile.locale,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        );
      })}
      <footer className="report-preview__footer">
        Paused items are excluded from planned totals. Their posted transactions still count as
        actual activity.
      </footer>
    </article>
  );
};
