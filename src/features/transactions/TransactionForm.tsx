import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { queryKeys } from '../../data/queryKeys';
import {
  retrieveMonthByStart,
  type BudgetTransactionInput,
} from '../../data/repositories/budgetRepository';
import { moneyToMinorUnits } from '../../shared/formatting/money';
import type {
  BudgetTransaction,
  Category,
  FinancialAccountWithBalance,
  MonthSummary,
} from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import { transactionSchema } from '../../shared/validation/schemas';

type TransactionValues = z.infer<typeof transactionSchema>;

interface TransactionFormProps {
  accounts: FinancialAccountWithBalance[];
  categories: Category[];
  initialMonthId: string;
  months: MonthSummary[];
  onSubmit: (input: BudgetTransactionInput) => Promise<void>;
  transaction?: BudgetTransaction;
  timeZone: string;
  userId: string;
}

const nullableSelect = {
  setValueAs: (value: unknown) => (typeof value === 'string' && value ? value : null),
};

const currentDate = (timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

export const TransactionForm = ({
  accounts,
  categories,
  initialMonthId,
  months,
  onSubmit,
  transaction,
  timeZone,
  userId,
}: TransactionFormProps) => {
  const initialMonth = months.find((month) => month.id === initialMonthId) ?? months[0];
  const today = currentDate(timeZone);
  const { register, handleSubmit, control, setValue, setError, formState } =
    useForm<TransactionValues>({
      resolver: zodResolver(transactionSchema),
      defaultValues: {
        budgetMonthId: initialMonth?.id ?? '',
        transactionDate:
          transaction?.transaction_date ??
          (today.startsWith(initialMonth?.month_start.slice(0, 7) ?? '')
            ? today
            : (initialMonth?.month_start ?? '')),
        description: transaction?.description ?? '',
        amount: transaction ? (transaction.amount_minor / 100).toFixed(2) : '',
        transactionType: transaction?.transaction_type ?? 'expense',
        isRefund: transaction?.is_refund ?? false,
        status: transaction?.status ?? 'posted',
        accountId: transaction?.account_id ?? null,
        budgetMonthItemId: transaction?.budget_month_item_id ?? null,
        categoryId: transaction?.category_id ?? null,
        notes: transaction?.notes ?? '',
      },
    });
  const selectedMonthId = useWatch({ control, name: 'budgetMonthId' });
  const transactionDate = useWatch({ control, name: 'transactionDate' });
  const transactionType = useWatch({ control, name: 'transactionType' });
  const selectedAccountId = useWatch({ control, name: 'accountId' });
  const selectedCategoryId = useWatch({ control, name: 'categoryId' });
  const selectedItemId = useWatch({ control, name: 'budgetMonthItemId' });
  const selectedMonth =
    months.find((month) => month.id === selectedMonthId) ?? initialMonth ?? months[0];
  const month = useQuery({
    queryKey: queryKeys.month(userId, selectedMonth?.month_start ?? 'unavailable'),
    queryFn: () => retrieveMonthByStart(selectedMonth.month_start),
    enabled: Boolean(selectedMonth),
  });

  useEffect(() => {
    if (!selectedMonthId && initialMonth) {
      setValue('budgetMonthId', initialMonth.id);
    }
  }, [initialMonth, selectedMonthId, setValue]);

  useEffect(() => {
    if (selectedMonth && !transactionDate.startsWith(selectedMonth.month_start.slice(0, 7))) {
      setValue('transactionDate', selectedMonth.month_start);
    }
    if (
      selectedAccountId &&
      (selectedAccountId !== transaction?.account_id ||
        selectedMonth?.id !== transaction?.budget_month_id) &&
      !accounts.some(
        (account) =>
          account.id === selectedAccountId &&
          account.archived_at === null &&
          account.currency_code === selectedMonth?.currency_code,
      )
    ) {
      setValue('accountId', null);
    }
  }, [
    accounts,
    selectedAccountId,
    selectedMonth,
    setValue,
    transaction?.account_id,
    transaction?.budget_month_id,
    transactionDate,
  ]);

  useEffect(() => {
    if (
      selectedCategoryId &&
      (selectedCategoryId !== transaction?.category_id ||
        transactionType !== transaction?.transaction_type) &&
      !categories.some(
        (category) =>
          category.id === selectedCategoryId &&
          category.archived_at === null &&
          category.item_type === transactionType,
      )
    ) {
      setValue('categoryId', null);
    }
    if (
      selectedItemId &&
      (selectedItemId !== transaction?.budget_month_item_id ||
        selectedMonth?.id !== transaction?.budget_month_id ||
        transactionType !== transaction?.transaction_type) &&
      !month.data?.budget_month_items.some(
        (item) => item.id === selectedItemId && item.item_type === transactionType,
      )
    ) {
      setValue('budgetMonthItemId', null);
    }
  }, [
    categories,
    month.data?.budget_month_items,
    selectedCategoryId,
    selectedItemId,
    selectedMonth?.id,
    setValue,
    transaction?.budget_month_item_id,
    transaction?.budget_month_id,
    transaction?.category_id,
    transaction?.transaction_type,
    transactionType,
  ]);

  const submit = async (values: TransactionValues) => {
    if (!selectedMonth) return;
    if (!values.transactionDate.startsWith(selectedMonth.month_start.slice(0, 7))) {
      setError('transactionDate', { message: 'Choose a date inside the selected budget month.' });
      return;
    }
    try {
      await onSubmit({
        budgetMonthId: selectedMonth.id,
        transactionDate: values.transactionDate,
        description: values.description,
        amountMinor: moneyToMinorUnits(values.amount),
        transactionType: values.transactionType,
        isRefund: values.isRefund,
        status: values.status,
        accountId: values.accountId,
        budgetMonthItemId: values.budgetMonthItemId,
        categoryId: values.categoryId,
        notes: values.notes,
      });
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'The transaction could not be saved.',
      });
    }
  };

  return (
    <form
      className="modal-form transaction-form"
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
    >
      <div className="form-grid">
        <SelectField
          label="Budget month"
          defaultValue={initialMonth?.id}
          {...register('budgetMonthId')}
        >
          {months.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.month_start.slice(0, 7)}
            </option>
          ))}
        </SelectField>
        <FormField
          label="Date"
          type="date"
          error={formState.errors.transactionDate?.message}
          {...register('transactionDate')}
        />
        <SelectField label="Type" {...register('transactionType')}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </SelectField>
        <FormField
          label="Amount"
          inputMode="decimal"
          autoFocus
          error={formState.errors.amount?.message}
          {...register('amount')}
        />
      </div>
      <FormField
        label="Description or merchant"
        autoComplete="off"
        error={formState.errors.description?.message}
        {...register('description')}
      />
      <div className="form-grid">
        <SelectField label="Budget item" {...register('budgetMonthItemId', nullableSelect)}>
          <option value="">Unassigned</option>
          {transaction?.budget_month_item_id &&
            !month.data?.budget_month_items.some(
              (item) => item.id === transaction.budget_month_item_id,
            ) && (
              <option value={transaction.budget_month_item_id}>
                {transaction.budget_item_snapshot ?? 'Archived item'} (archived)
              </option>
            )}
          {(month.data?.budget_month_items ?? [])
            .filter((item) => item.item_type === transactionType && item.archived_at === null)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name_snapshot}
                {item.is_disabled ? ' (paused)' : ''}
              </option>
            ))}
        </SelectField>
        <SelectField label="Category" {...register('categoryId', nullableSelect)}>
          <option value="">Uncategorised</option>
          {categories
            .filter(
              (category) =>
                category.item_type === transactionType &&
                (category.archived_at === null || category.id === transaction?.category_id),
            )
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.archived_at ? ' (archived)' : ''}
              </option>
            ))}
        </SelectField>
        <SelectField label="Account" {...register('accountId', nullableSelect)}>
          <option value="">No account</option>
          {accounts
            .filter(
              (account) =>
                (account.archived_at === null || account.id === transaction?.account_id) &&
                account.currency_code === selectedMonth?.currency_code,
            )
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.archived_at ? ' (archived)' : ''}
              </option>
            ))}
        </SelectField>
        <SelectField label="Status" {...register('status')}>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
          <option value="void">Void</option>
        </SelectField>
      </div>
      <label className="check-row">
        <input type="checkbox" {...register('isRefund')} />
        <span>
          <strong>{transactionType === 'expense' ? 'Expense refund' : 'Income reversal'}</strong>
          <small>This reverses the amount while keeping the transaction value non-negative.</small>
        </span>
      </label>
      <label className="field" htmlFor="transaction-notes">
        <span className="field__label">Notes (optional)</span>
        <textarea
          id="transaction-notes"
          className="input transaction-form__notes"
          rows={3}
          {...register('notes')}
        />
        {formState.errors.notes && (
          <span className="field__error" role="alert">
            {formState.errors.notes.message}
          </span>
        )}
      </label>
      {formState.errors.root && (
        <div className="inline-alert inline-alert--error" role="alert">
          {formState.errors.root.message}
        </div>
      )}
      <Button className="button--wide" type="submit" loading={formState.isSubmitting}>
        {transaction ? 'Save transaction' : 'Add transaction'}
      </Button>
    </form>
  );
};
