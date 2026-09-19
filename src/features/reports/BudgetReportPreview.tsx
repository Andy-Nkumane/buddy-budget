import { calculateTotals, formatMoney, formatMonth } from '../../shared/formatting/money';
import {
  calculateReportTotalsByCurrency,
  formatSignedReportAmount,
} from '../../shared/reporting/budgetReport';
import type { BudgetMonthWithItems, Profile } from '../../shared/types/domain';

interface BudgetReportPreviewProps {
  months: BudgetMonthWithItems[];
  profile: Profile;
  rangeLabel: string;
}

export const BudgetReportPreview = ({ months, profile, rangeLabel }: BudgetReportPreviewProps) => {
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
            <caption className="visually-hidden">Totals for the selected date range</caption>
            <thead>
              <tr>
                <th scope="col">Currency</th>
                <th scope="col">Income</th>
                <th scope="col">Expenses</th>
                <th scope="col">Remaining</th>
              </tr>
            </thead>
            <tbody>
              {totalsByCurrency.map((totals) => (
                <tr key={totals.currency}>
                  <th scope="row">{totals.currency}</th>
                  <td className="report-amount report-amount--income">
                    {formatSignedReportAmount(
                      totals.income,
                      'income',
                      totals.currency,
                      profile.locale,
                    )}
                  </td>
                  <td className="report-amount report-amount--expense">
                    {formatSignedReportAmount(
                      totals.expenses,
                      'expense',
                      totals.currency,
                      profile.locale,
                    )}
                  </td>
                  <td>{formatMoney(totals.remaining, totals.currency, profile.locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {months.map((month) => {
        const totals = calculateTotals(month.budget_month_items);
        const headingId = `report-month-${month.id}`;
        return (
          <section className="report-preview__section" aria-labelledby={headingId} key={month.id}>
            <h3 id={headingId}>{formatMonth(month.month_start, profile.locale)}</h3>
            <dl className="report-preview__totals">
              <div>
                <dt>Income</dt>
                <dd className="report-amount report-amount--income">
                  {formatSignedReportAmount(
                    totals.income,
                    'income',
                    month.currency_code,
                    profile.locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>Expenses</dt>
                <dd className="report-amount report-amount--expense">
                  {formatSignedReportAmount(
                    totals.expenses,
                    'expense',
                    month.currency_code,
                    profile.locale,
                  )}
                </dd>
              </div>
              <div>
                <dt>Remaining</dt>
                <dd>{formatMoney(totals.remaining, month.currency_code, profile.locale)}</dd>
              </div>
            </dl>
            <div className="report-preview__table-wrap">
              <table>
                <caption className="visually-hidden">
                  Items for {formatMonth(month.month_start, profile.locale)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Category</th>
                    <th scope="col">Status</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {month.budget_month_items.map((item) => (
                    <tr className={item.is_disabled ? 'report-preview__paused' : ''} key={item.id}>
                      <th scope="row">{item.name_snapshot}</th>
                      <td>{item.category_snapshot ?? 'Uncategorised'}</td>
                      <td>{item.is_disabled ? 'Paused' : 'Active'}</td>
                      <td className={`report-amount report-amount--${item.item_type}`}>
                        {formatSignedReportAmount(
                          Number(item.amount),
                          item.item_type,
                          month.currency_code,
                          profile.locale,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      <footer className="report-preview__footer">
        Paused items are shown for context but excluded from all totals.
      </footer>
    </article>
  );
};
