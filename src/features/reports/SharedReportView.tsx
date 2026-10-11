import { formatMoney, formatMonth } from '../../shared/formatting/money';
import { formatGoalPriority } from '../../shared/reporting/budgetReport';
import type { SharedReportSnapshot } from './sharedReport';

export const SharedReportView = ({ snapshot }: { snapshot: SharedReportSnapshot }) => (
  <article className="shared-report" aria-labelledby="shared-report-title">
    <header className="shared-report__header">
      <p className="eyebrow">Limited shared snapshot</p>
      <h1 id="shared-report-title">{snapshot.title}</h1>
      <p className="shared-report__range">{snapshot.rangeLabel}</p>
      <p className="shared-report__snapshot-date">
        Frozen on{' '}
        {new Intl.DateTimeFormat(snapshot.locale, { dateStyle: 'long', timeStyle: 'short' }).format(
          new Date(snapshot.snapshotAt),
        )}
        . Later budget changes are not included.
      </p>
      <p className="privacy-note">
        Omitted: {snapshot.omitted.length ? snapshot.omitted.join(', ') : 'nothing selected'}.
      </p>
    </header>
    {snapshot.months.map((month) => (
      <section className="shared-report__month" key={month.monthStart}>
        <header className="shared-report__month-heading">
          <div>
            <p className="eyebrow">Monthly snapshot</p>
            <h2>{formatMonth(month.monthStart, snapshot.locale)}</h2>
          </div>
          <span className="shared-report__currency">{month.currencyCode}</span>
        </header>
        {month.totals && (
          <dl className="shared-report__totals">
            <div className="shared-report__total shared-report__total--income">
              <dt>Planned income</dt>
              <dd>
                {formatMoney(
                  month.totals.plannedIncomeMinor / 100,
                  month.currencyCode,
                  snapshot.locale,
                )}
              </dd>
            </div>
            <div className="shared-report__total shared-report__total--income">
              <dt>Actual income</dt>
              <dd>
                {formatMoney(
                  month.totals.actualIncomeMinor / 100,
                  month.currencyCode,
                  snapshot.locale,
                )}
              </dd>
            </div>
            <div className="shared-report__total shared-report__total--expense">
              <dt>Planned expenses</dt>
              <dd>
                {formatMoney(
                  month.totals.plannedExpenseMinor / 100,
                  month.currencyCode,
                  snapshot.locale,
                )}
              </dd>
            </div>
            <div className="shared-report__total shared-report__total--expense">
              <dt>Actual expenses</dt>
              <dd>
                {formatMoney(
                  month.totals.actualExpenseMinor / 100,
                  month.currencyCode,
                  snapshot.locale,
                )}
              </dd>
            </div>
            <div
              className={`shared-report__total shared-report__total--remaining${month.totals.remainingMinor < 0 ? ' shared-report__total--negative' : ''}`}
            >
              <dt>Actual remaining</dt>
              <dd>
                {formatMoney(
                  month.totals.remainingMinor / 100,
                  month.currencyCode,
                  snapshot.locale,
                )}
              </dd>
            </div>
          </dl>
        )}
        {month.categories && (
          <div className="table-scroll shared-report__table-wrap">
            <table className="shared-report__table">
              <caption>Category summary</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Type</th>
                  <th className="shared-report__amount" scope="col">
                    Planned
                  </th>
                  <th className="shared-report__amount" scope="col">
                    Actual
                  </th>
                </tr>
              </thead>
              <tbody>
                {month.categories.map((category) => (
                  <tr key={`${category.itemType}:${category.name}`}>
                    <th scope="row" data-label="Category">
                      {category.name}
                    </th>
                    <td data-label="Type">
                      <span
                        className={`shared-report__type shared-report__type--${category.itemType}`}
                      >
                        {category.itemType}
                      </span>
                    </td>
                    <td className="shared-report__amount" data-label="Planned">
                      {formatMoney(
                        category.plannedMinor / 100,
                        month.currencyCode,
                        snapshot.locale,
                      )}
                    </td>
                    <td className="shared-report__amount" data-label="Actual">
                      {formatMoney(category.actualMinor / 100, month.currencyCode, snapshot.locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {month.transactions && (
          <div className="table-scroll shared-report__table-wrap">
            <table className="shared-report__table">
              <caption>Approved transaction details</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  {snapshot.selection.transactionNames && <th scope="col">Name</th>}
                  <th scope="col">Category</th>
                  <th scope="col">Type</th>
                  <th className="shared-report__amount" scope="col">
                    Amount
                  </th>
                  {snapshot.selection.notes && <th scope="col">Notes</th>}
                </tr>
              </thead>
              <tbody>
                {month.transactions.map((transaction, index) => (
                  <tr key={`${transaction.date}:${index}`}>
                    <td data-label="Date">{transaction.date}</td>
                    {snapshot.selection.transactionNames && (
                      <th scope="row" data-label="Name">
                        {transaction.name}
                      </th>
                    )}
                    <td data-label="Category">{transaction.category}</td>
                    <td data-label="Type">
                      <span
                        className={`shared-report__type shared-report__type--${transaction.type}`}
                      >
                        {transaction.type}
                      </span>
                    </td>
                    <td className="shared-report__amount" data-label="Amount">
                      {formatMoney(
                        transaction.amountMinor / 100,
                        month.currencyCode,
                        snapshot.locale,
                      )}
                    </td>
                    {snapshot.selection.notes && (
                      <td data-label="Notes">{transaction.notes ?? '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {month.notes && (
          <p className="shared-report__note">
            <strong>Month note:</strong> {month.notes}
          </p>
        )}
        {month.goals && (
          <div className="table-scroll shared-report__table-wrap">
            <table className="shared-report__table">
              <caption>Approved goal data</caption>
              <thead>
                <tr>
                  <th scope="col">Goal</th>
                  <th scope="col">Type</th>
                  <th scope="col">Priority</th>
                  <th className="shared-report__amount" scope="col">
                    Recommended
                  </th>
                </tr>
              </thead>
              <tbody>
                {month.goals.map((goal) => (
                  <tr key={`${goal.type}:${goal.name}`}>
                    <th scope="row" data-label="Goal">
                      {goal.name}
                    </th>
                    <td data-label="Type">{goal.type.replace('_', ' ')}</td>
                    <td data-label="Priority">{formatGoalPriority(goal.priority)}</td>
                    <td className="shared-report__amount" data-label="Recommended">
                      {formatMoney(
                        goal.recommendedMinor / 100,
                        month.currencyCode,
                        snapshot.locale,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    ))}
  </article>
);
