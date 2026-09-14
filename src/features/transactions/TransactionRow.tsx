import { Pencil, ReceiptText, Trash2 } from 'lucide-react';
import { formatMoney, isMonthReadOnly } from '../../shared/formatting/money';
import type { BudgetTransaction, MonthSummary } from '../../shared/types/domain';

interface TransactionRowProps {
  accountName?: string;
  currentMonth: string;
  locale: string;
  month?: MonthSummary;
  onDelete: (transaction: BudgetTransaction) => void;
  onEdit: (transaction: BudgetTransaction) => void;
  profileCurrency: string;
  transaction: BudgetTransaction;
}

export const TransactionRow = ({
  accountName,
  currentMonth,
  locale,
  month,
  onDelete,
  onEdit,
  profileCurrency,
  transaction,
}: TransactionRowProps) => {
  const readOnly = !month || isMonthReadOnly(month.month_start, currentMonth);
  const positiveCashFlow =
    (transaction.transaction_type === 'income' && !transaction.is_refund) ||
    (transaction.transaction_type === 'expense' && transaction.is_refund);
  const amount = `${positiveCashFlow ? '+' : '-'} ${formatMoney(
    transaction.amount_minor / 100,
    month?.currency_code ?? profileCurrency,
    locale,
  )}`;

  return (
    <article className="transaction-row">
      <span
        className={`transaction-row__icon transaction-row__icon--${positiveCashFlow ? 'income' : 'expense'}`}
      >
        <ReceiptText aria-hidden="true" size={18} />
      </span>
      <div className="transaction-row__identity">
        <strong>{transaction.description}</strong>
        <span>
          {transaction.transaction_date} · {transaction.category_snapshot ?? 'Uncategorised'} ·{' '}
          {transaction.budget_item_snapshot ?? 'Unassigned'}
        </span>
      </div>
      <div className="transaction-row__meta">
        <strong className={positiveCashFlow ? 'positive' : 'negative'}>{amount}</strong>
        <span>
          {transaction.is_refund ? 'Refund / reversal · ' : ''}
          {transaction.status} · {accountName ?? 'No account'}
        </span>
      </div>
      <div className="transaction-row__actions">
        {!readOnly ? (
          <>
            <button
              className="icon-button"
              aria-label={`Edit ${transaction.description}`}
              onClick={() => onEdit(transaction)}
            >
              <Pencil aria-hidden="true" size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={`Delete ${transaction.description}`}
              onClick={() => onDelete(transaction)}
            >
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </>
        ) : (
          <span className="locked-label">Read-only</span>
        )}
      </div>
    </article>
  );
};
