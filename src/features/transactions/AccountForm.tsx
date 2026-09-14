import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { moneyToMinorUnits } from '../../shared/formatting/money';
import {
  currencyOptions,
  includePreferenceOption,
} from '../../shared/localization/preferenceOptions';
import type { FinancialAccountType } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import { financialAccountSchema } from '../../shared/validation/schemas';

type AccountValues = z.infer<typeof financialAccountSchema>;

interface AccountFormProps {
  currencyCode: string;
  onSubmit: (input: {
    name: string;
    accountType: FinancialAccountType;
    currencyCode: string;
    openingBalanceMinor: number;
  }) => Promise<void>;
}

export const AccountForm = ({ currencyCode, onSubmit }: AccountFormProps) => {
  const { register, handleSubmit, setError, formState } = useForm<AccountValues>({
    resolver: zodResolver(financialAccountSchema),
    defaultValues: {
      name: '',
      accountType: 'checking',
      currencyCode,
      openingBalance: '0.00',
    },
  });

  const submit = async (values: AccountValues) => {
    try {
      await onSubmit({
        name: values.name,
        accountType: values.accountType,
        currencyCode: values.currencyCode,
        openingBalanceMinor: moneyToMinorUnits(values.openingBalance),
      });
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'The account could not be saved.',
      });
    }
  };

  return (
    <form className="modal-form" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
      <FormField
        label="Account name"
        autoFocus
        placeholder="e.g. Daily account"
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <div className="form-grid">
        <SelectField label="Account type" {...register('accountType')}>
          <option value="cash">Cash</option>
          <option value="checking">Current / checking</option>
          <option value="savings">Savings</option>
          <option value="credit">Credit</option>
        </SelectField>
        <SelectField label="Currency" {...register('currencyCode')}>
          {includePreferenceOption(currencyOptions, currencyCode).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>
      <FormField
        label="Opening balance"
        hint="Use a negative value for money owed on a credit account."
        inputMode="decimal"
        error={formState.errors.openingBalance?.message}
        {...register('openingBalance')}
      />
      {formState.errors.root && (
        <div className="inline-alert inline-alert--error" role="alert">
          {formState.errors.root.message}
        </div>
      )}
      <Button className="button--wide" type="submit" loading={formState.isSubmitting}>
        Add account
      </Button>
    </form>
  );
};
