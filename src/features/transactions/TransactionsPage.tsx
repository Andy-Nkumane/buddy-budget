import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Plus,
  Upload,
  ReceiptText,
  RotateCcw,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import {
  createBudgetTransaction,
  createFinancialAccount,
  deleteBudgetTransaction,
  retrieveProfile,
  searchBudgetTransactions,
  searchCategories,
  searchFinancialAccounts,
  searchTransactionImportBatches,
  searchMonths,
  TRANSACTION_PAGE_SIZE,
  updateBudgetTransaction,
  updateFinancialAccount,
  undoTransactionImportBatch,
  type BudgetTransactionInput,
} from '../../data/repositories/budgetRepository';
import { currentMonthStart, formatMoney, isMonthReadOnly } from '../../shared/formatting/money';
import type {
  BudgetTransaction,
  FinancialAccountWithBalance,
  TransactionImportBatch,
} from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';
import { AccountForm } from './AccountForm';
import { TransactionForm } from './TransactionForm';
import { TransactionRow } from './TransactionRow';
import { CsvImportFlow } from './import/CsvImportFlow';

export const TransactionsPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const filteredMonthId = searchParams.get('month') ?? undefined;
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<BudgetTransaction | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(
    () => searchParams.get('add') === 'transaction',
  );
  const [accountOpen, setAccountOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<TransactionImportBatch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const months = useQuery({ queryKey: queryKeys.months(userId), queryFn: searchMonths });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId, true),
    queryFn: () => searchCategories(true),
  });
  const accounts = useQuery({
    queryKey: queryKeys.accounts(userId),
    queryFn: () => searchFinancialAccounts(true),
  });
  const transactions = useQuery({
    queryKey: queryKeys.transactions(userId, page, filteredMonthId),
    queryFn: () => searchBudgetTransactions(page, filteredMonthId),
  });
  const importBatches = useQuery({
    queryKey: queryKeys.transactionImports(userId),
    queryFn: searchTransactionImportBatches,
  });
  const current = currentMonthStart(profile.data?.timezone);
  const editableMonths = useMemo(
    () => (months.data ?? []).filter((month) => !isMonthReadOnly(month.month_start, current)),
    [current, months.data],
  );
  const initialMonth =
    editableMonths.find((month) => month.month_start === current) ?? editableMonths[0];
  const monthById = new Map((months.data ?? []).map((month) => [month.id, month]));
  const accountById = new Map((accounts.data ?? []).map((account) => [account.id, account]));
  const totalPages = Math.max(
    1,
    Math.ceil((transactions.data?.total ?? 0) / TRANSACTION_PAGE_SIZE),
  );

  const refreshFinancialData = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user', userId] });
  };

  const notifyMonthChanged = (monthId: string) => {
    localStorage.setItem(`buddybudget-month-${monthId}`, Date.now().toString());
  };

  const saveTransaction = async (input: BudgetTransactionInput) => {
    const previousMonthId = editing?.budget_month_id;
    if (editing) await updateBudgetTransaction(editing.id, input);
    else await createBudgetTransaction(input);
    notifyMonthChanged(input.budgetMonthId);
    if (previousMonthId && previousMonthId !== input.budgetMonthId) {
      notifyMonthChanged(previousMonthId);
    }
    setEditing(null);
    setTransactionOpen(false);
    setActionMessage(editing ? 'Transaction updated.' : 'Transaction added.');
    setActionError(null);
    await refreshFinancialData();
  };

  const removeTransaction = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBudgetTransaction(deleteTarget.id);
      notifyMonthChanged(deleteTarget.budget_month_id);
      if (transactions.data?.records.length === 1 && page > 0) setPage((value) => value - 1);
      setDeleteTarget(null);
      setActionMessage('Transaction deleted.');
      setActionError(null);
      await refreshFinancialData();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'The transaction could not be deleted.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const toggleAccountArchive = async (account: FinancialAccountWithBalance) => {
    try {
      await updateFinancialAccount(account, account.archived_at === null);
      setActionMessage(account.archived_at === null ? 'Account archived.' : 'Account restored.');
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts(userId) });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The account could not be updated.');
    }
  };

  const undoImport = async () => {
    if (!undoTarget) return;
    setDeleting(true);
    try {
      await undoTransactionImportBatch(undoTarget.id);
      notifyMonthChanged(undoTarget.budget_month_id);
      setUndoTarget(null);
      setActionMessage('CSV import undone.');
      setActionError(null);
      await refreshFinancialData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'The import could not be undone.');
    } finally {
      setDeleting(false);
    }
  };

  if (
    profile.isLoading ||
    months.isLoading ||
    categories.isLoading ||
    accounts.isLoading ||
    transactions.isLoading ||
    importBatches.isLoading
  ) {
    return <LoadingState label="Loading your transactions…" />;
  }
  const queryError =
    profile.error ??
    months.error ??
    categories.error ??
    accounts.error ??
    transactions.error ??
    importBatches.error;
  if (queryError) {
    return (
      <ErrorState
        message={queryError.message}
        retry={() => void queryClient.invalidateQueries({ queryKey: ['user', userId] })}
      />
    );
  }

  const locale = profile.data?.locale ?? 'en-ZA';
  const currency = profile.data?.currency_code ?? 'ZAR';

  return (
    <section className="page transactions-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">What actually happened</p>
          <h1>Transactions</h1>
          <p>Record real income and spending, then compare it with your monthly plan.</p>
          {filteredMonthId && monthById.has(filteredMonthId) && (
            <p className="filter-context">
              Showing {monthById.get(filteredMonthId)?.month_start.slice(0, 7)} only.{' '}
              <Link to="/app/transactions" onClick={() => setPage(0)}>
                Show every month
              </Link>
            </p>
          )}
        </div>
        <div className="page-heading__actions">
          <Button
            variant="secondary"
            icon={<Upload aria-hidden="true" size={18} />}
            disabled={!initialMonth}
            onClick={() => setImportOpen(true)}
          >
            Import CSV
          </Button>
          <Button
            icon={<Plus aria-hidden="true" size={18} />}
            disabled={!initialMonth}
            onClick={() => {
              setEditing(null);
              setTransactionOpen(true);
            }}
          >
            Add transaction
          </Button>
        </div>
      </header>

      {actionMessage && (
        <div className="inline-alert" role="status">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {actionError}
        </div>
      )}

      <section className="management-card accounts-panel" aria-labelledby="accounts-heading">
        <header>
          <div>
            <h2 id="accounts-heading">Accounts</h2>
            <p>Balances come from the opening amount plus posted transactions.</p>
          </div>
          <Button
            variant="secondary"
            icon={<Plus aria-hidden="true" size={17} />}
            onClick={() => setAccountOpen(true)}
          >
            Add account
          </Button>
        </header>
        {(accounts.data ?? []).length ? (
          <div className="account-grid">
            {accounts.data?.map((account) => (
              <article
                className={`account-card ${account.archived_at ? 'account-card--archived' : ''}`}
                key={account.id}
              >
                <WalletCards aria-hidden="true" />
                <div>
                  <strong>{account.name}</strong>
                  <span>{account.archived_at ? 'Archived' : account.account_type}</span>
                </div>
                <b>{formatMoney(account.balance_minor / 100, account.currency_code, locale)}</b>
                <button
                  className="icon-button"
                  aria-label={`${account.archived_at ? 'Restore' : 'Archive'} ${account.name}`}
                  onClick={() => void toggleAccountArchive(account)}
                >
                  {account.archived_at ? (
                    <RotateCcw aria-hidden="true" size={17} />
                  ) : (
                    <Archive aria-hidden="true" size={17} />
                  )}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-row">
            <p>Accounts are optional. Add one if you want a running balance.</p>
          </div>
        )}
      </section>

      {(importBatches.data ?? []).length > 0 && (
        <section
          className="transaction-history import-history"
          aria-labelledby="import-history-heading"
        >
          <header>
            <div>
              <h2 id="import-history-heading">Recent CSV imports</h2>
              <p>Raw statement files are never retained.</p>
            </div>
          </header>
          <div className="import-batch-list">
            {importBatches.data?.map((batch) => {
              const month = monthById.get(batch.budget_month_id);
              const locked = !month || isMonthReadOnly(month.month_start, current);
              return (
                <article key={batch.id} className="import-batch">
                  <div>
                    <strong>{batch.file_name}</strong>
                    <span>
                      {month?.month_start.slice(0, 7) ?? 'Unknown month'} · {batch.accepted_count}{' '}
                      imported · {batch.duplicate_count} duplicates
                    </span>
                  </div>
                  <span className="status-pill">{batch.status}</span>
                  <Button
                    variant="ghost"
                    disabled={batch.status === 'undone' || locked}
                    onClick={() => setUndoTarget(batch)}
                  >
                    Undo
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="transaction-history" aria-labelledby="transaction-history-heading">
        <header>
          <div>
            <h2 id="transaction-history-heading">Transaction history</h2>
            <p>{transactions.data?.total ?? 0} recorded transactions</p>
          </div>
        </header>
        {transactions.data?.records.length ? (
          <div className="transaction-list">
            {transactions.data.records.map((transaction) => (
              <TransactionRow
                accountName={accountById.get(transaction.account_id ?? '')?.name}
                currentMonth={current}
                key={transaction.id}
                locale={locale}
                month={monthById.get(transaction.budget_month_id)}
                onDelete={setDeleteTarget}
                onEdit={(entry) => {
                  setEditing(entry);
                  setTransactionOpen(true);
                }}
                profileCurrency={currency}
                transaction={transaction}
              />
            ))}
          </div>
        ) : (
          <div className="empty-card transaction-empty">
            <ReceiptText aria-hidden="true" />
            <h2>No transactions yet</h2>
            <p>Add the first real income or expense to begin comparing actuals with your plan.</p>
            {initialMonth ? (
              <Button onClick={() => setTransactionOpen(true)}>Add transaction</Button>
            ) : (
              <Link className="button button--primary" to="/app/budget/current">
                Create a month
              </Link>
            )}
          </div>
        )}
        {totalPages > 1 && (
          <nav className="pagination" aria-label="Transaction pages">
            <Button
              variant="secondary"
              icon={<ArrowLeft aria-hidden="true" size={17} />}
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="secondary"
              icon={<ArrowRight aria-hidden="true" size={17} />}
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </nav>
        )}
      </section>

      <Modal
        className="modal--wide"
        open={importOpen}
        title="Import bank statement"
        description="Map and review every row before anything is saved."
        onClose={() => setImportOpen(false)}
      >
        {importOpen && initialMonth && (
          <CsvImportFlow
            userId={userId}
            months={editableMonths}
            accounts={accounts.data ?? []}
            onCancel={() => setImportOpen(false)}
            onComplete={async (monthId, message) => {
              notifyMonthChanged(monthId);
              setImportOpen(false);
              setActionMessage(message);
              await refreshFinancialData();
            }}
          />
        )}
      </Modal>
      <Modal
        open={transactionOpen}
        title={editing ? 'Edit transaction' : 'Add transaction'}
        description="Posted entries update actual totals immediately. Pending and void entries do not."
        onClose={() => {
          setTransactionOpen(false);
          setEditing(null);
        }}
      >
        {transactionOpen && initialMonth && (
          <TransactionForm
            accounts={accounts.data ?? []}
            categories={categories.data ?? []}
            initialMonthId={editing?.budget_month_id ?? initialMonth.id}
            months={editableMonths}
            onSubmit={saveTransaction}
            transaction={editing ?? undefined}
            timeZone={profile.data?.timezone ?? 'UTC'}
            userId={userId}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(undoTarget)}
        title="Undo CSV import?"
        description="All transactions created by this import will be removed. This is available only while its month remains editable."
        onClose={() => setUndoTarget(null)}
      >
        <div className="modal-form modal-form__actions">
          <Button variant="ghost" onClick={() => setUndoTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void undoImport()}>
            Undo import
          </Button>
        </div>
      </Modal>
      <Modal
        open={accountOpen}
        title="Add financial account"
        description="Buddy Budget stores only your account label and opening balance—never bank credentials."
        onClose={() => setAccountOpen(false)}
      >
        {accountOpen && (
          <AccountForm
            currencyCode={currency}
            onSubmit={async (input) => {
              await createFinancialAccount(input);
              setAccountOpen(false);
              setActionMessage('Account added.');
              await queryClient.invalidateQueries({ queryKey: queryKeys.accounts(userId) });
            }}
          />
        )}
      </Modal>
      <Modal
        open={Boolean(deleteTarget)}
        title="Delete transaction?"
        description="This removes the transaction from actual totals and account balances."
        onClose={() => setDeleteTarget(null)}
      >
        <div className="modal-form modal-form__actions">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={() => void removeTransaction()}>
            Delete transaction
          </Button>
        </div>
      </Modal>
    </section>
  );
};
