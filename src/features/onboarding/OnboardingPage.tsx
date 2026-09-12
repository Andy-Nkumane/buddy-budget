import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, CircleDollarSign, Plus, Trash2 } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { setupFirstBudget } from '../../data/repositories/budgetRepository';
import {
  currencyOptions,
  includePreferenceOption,
  localeOptions,
  timezoneOptions,
} from '../../shared/localization/preferenceOptions';
import { Button } from '../../shared/ui/Button';
import { BrandMark } from '../../shared/ui/BrandMark';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import { parseMoney, profileSchema, toDatabaseMoney } from '../../shared/validation/schemas';

const onboardingSchema = profileSchema.extend({
  templateName: z.string().trim().min(1, 'Name your template.').max(80),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Enter an item name.').max(100),
        itemType: z.enum(['income', 'expense']),
        categoryName: z.string().trim().min(1, 'Choose a category.').max(80),
        amount: z.string().refine((value) => parseMoney(value) !== null, 'Enter a valid amount.'),
      }),
    )
    .min(1, 'Add at least one recurring item.'),
});

type OnboardingValues = z.infer<typeof onboardingSchema>;

const defaults: OnboardingValues = {
  displayName: '',
  currencyCode: 'ZAR',
  locale: navigator.language || 'en-ZA',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg',
  theme: 'system',
  templateName: 'My monthly plan',
  items: [
    { name: 'Salary', itemType: 'income', categoryName: 'Earnings', amount: '0.00' },
    { name: 'Rent', itemType: 'expense', categoryName: 'Housing', amount: '0.00' },
    { name: 'Groceries', itemType: 'expense', categoryName: 'Groceries', amount: '0.00' },
  ],
};

const categoryOptions = {
  income: ['Earnings'],
  expense: ['Housing', 'Utilities', 'Groceries', 'Transport', 'Entertainment'],
} as const;

const onboardingCurrencyOptions = includePreferenceOption(currencyOptions, defaults.currencyCode);
const onboardingLocaleOptions = includePreferenceOption(localeOptions, defaults.locale);
const onboardingTimezoneOptions = includePreferenceOption(timezoneOptions, defaults.timezone);

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, register, handleSubmit, setValue, trigger, formState } =
    useForm<OnboardingValues>({
      resolver: zodResolver(onboardingSchema),
      defaultValues: defaults,
      mode: 'onBlur',
    });
  const items = useFieldArray({ control, name: 'items' });
  const values = useWatch({ control });

  const nextStep = async () => {
    const fields =
      step === 1
        ? (['displayName', 'currencyCode', 'locale', 'timezone', 'theme'] as const)
        : (['templateName', 'items'] as const);
    if (await trigger(fields)) setStep((current) => Math.min(3, current + 1));
  };

  const submit = async (input: OnboardingValues) => {
    setSubmitError(null);
    try {
      const month = await setupFirstBudget({
        displayName: input.displayName,
        currencyCode: input.currencyCode,
        locale: input.locale,
        timezone: input.timezone,
        theme: input.theme,
        templateName: input.templateName,
        items: input.items.map((item) => ({
          name: item.name,
          item_type: item.itemType,
          category_name: item.categoryName,
          default_amount: toDatabaseMoney(item.amount),
        })),
      });
      void navigate(`/app/budget/${month.month_start}`, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Setup failed. Please try again.');
    }
  };

  return (
    <main className="onboarding">
      <header className="onboarding__header">
        <span className="brand">
          <BrandMark />
          <strong>BuddyBudget</strong>
        </span>
        <span>Step {step} of 3</span>
      </header>
      <div className="onboarding__progress" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((number) => (
          <i className={number <= step ? 'active' : ''} key={number} />
        ))}
      </div>
      <section className="onboarding__card">
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          {step === 1 && (
            <div className="onboarding__step">
              <span className="step-icon">
                <CircleDollarSign aria-hidden="true" />
              </span>
              <p className="eyebrow">Make it yours</p>
              <h1>Set up your budget basics</h1>
              <p className="muted">
                These choices control how dates and amounts appear. You can change them later.
              </p>
              <div className="form-grid">
                <FormField
                  label="Display name"
                  placeholder="How should we greet you?"
                  error={formState.errors.displayName?.message}
                  {...register('displayName')}
                />
                <SelectField
                  label="Currency"
                  error={formState.errors.currencyCode?.message}
                  {...register('currencyCode')}
                >
                  {onboardingCurrencyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Locale"
                  error={formState.errors.locale?.message}
                  {...register('locale')}
                >
                  {onboardingLocaleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Timezone"
                  error={formState.errors.timezone?.message}
                  {...register('timezone')}
                >
                  {onboardingTimezoneOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <label className="field">
                  <span className="field__label">Theme</span>
                  <select className="input" {...register('theme')}>
                    <option value="system">Follow device</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="onboarding__step">
              <p className="eyebrow">Your recurring plan</p>
              <h1>What happens most months?</h1>
              <p className="muted">
                Zero is welcome—fill uncertain amounts in when the month begins.
              </p>
              <FormField
                label="Template name"
                error={formState.errors.templateName?.message}
                {...register('templateName')}
              />
              <div className="onboarding-items">
                {items.fields.map((field, index) => (
                  <fieldset className="onboarding-item" key={field.id}>
                    <legend className="visually-hidden">Recurring item {index + 1}</legend>
                    <SelectField
                      label="Type"
                      className="field--compact"
                      {...register(`items.${index}.itemType`, {
                        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                          const itemType = event.target.value as 'income' | 'expense';
                          setValue(`items.${index}.categoryName`, categoryOptions[itemType][0], {
                            shouldValidate: true,
                          });
                        },
                      })}
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </SelectField>
                    <FormField
                      label="Item name"
                      className="field--compact"
                      error={formState.errors.items?.[index]?.name?.message}
                      {...register(`items.${index}.name`)}
                    />
                    <SelectField
                      label="Category"
                      className="field--compact"
                      error={formState.errors.items?.[index]?.categoryName?.message}
                      {...register(`items.${index}.categoryName`)}
                    >
                      {categoryOptions[
                        values.items?.[index]?.itemType === 'expense' ? 'expense' : 'income'
                      ].map((category) => (
                        <option value={category} key={category}>
                          {category}
                        </option>
                      ))}
                    </SelectField>
                    <FormField
                      label="Default amount"
                      className="field--compact"
                      inputMode="decimal"
                      error={formState.errors.items?.[index]?.amount?.message}
                      {...register(`items.${index}.amount`)}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      aria-label={`Remove ${field.name}`}
                      onClick={() => items.remove(index)}
                    >
                      <Trash2 aria-hidden="true" size={19} />
                    </button>
                  </fieldset>
                ))}
              </div>
              <div className="split-actions">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus aria-hidden="true" size={18} />}
                  onClick={() =>
                    items.append({
                      name: '',
                      itemType: 'income',
                      categoryName: 'Earnings',
                      amount: '0.00',
                    })
                  }
                >
                  Add income
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Plus aria-hidden="true" size={18} />}
                  onClick={() =>
                    items.append({
                      name: '',
                      itemType: 'expense',
                      categoryName: 'Housing',
                      amount: '0.00',
                    })
                  }
                >
                  Add expense
                </Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="onboarding__step onboarding__review">
              <span className="step-icon">
                <Check aria-hidden="true" />
              </span>
              <p className="eyebrow">Ready to begin</p>
              <h1>Create your first month</h1>
              <p>
                BuddyBudget will copy <strong>{values.items?.length ?? 0} recurring items</strong>{' '}
                from <strong>{values.templateName}</strong> into the current month.
              </p>
              <div className="review-note">
                <strong>Your history stays reliable.</strong>
                <span>Future template edits will apply only to newly created months.</span>
              </div>
              {submitError && (
                <div className="inline-alert inline-alert--error" role="alert">
                  {submitError}
                </div>
              )}
            </div>
          )}
          <div className="onboarding__actions">
            {step > 1 && (
              <Button
                type="button"
                variant="ghost"
                icon={<ArrowLeft aria-hidden="true" size={18} />}
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={() => void nextStep()}>
                Continue <ArrowRight aria-hidden="true" size={18} />
              </Button>
            ) : (
              <Button type="submit" loading={formState.isSubmitting}>
                Create my month <ArrowRight aria-hidden="true" size={18} />
              </Button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
};
