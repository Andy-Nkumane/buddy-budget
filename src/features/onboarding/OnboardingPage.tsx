import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDollarSign,
  Library,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
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
import { Modal } from '../../shared/ui/Modal';
import { SelectField } from '../../shared/ui/SelectField';
import { parseMoney, profileSchema, toDatabaseMoney } from '../../shared/validation/schemas';
import type { UserPreferences } from '../../shared/types/domain';
import { clearApprovedStarterPlan, retrieveApprovedStarterPlan } from '../demo/demoModel';
import {
  StarterTemplatePicker,
  type StarterTemplateSelection,
} from '../templates/StarterTemplatePicker';

const onboardingSchema = profileSchema.extend({
  templateName: z.string().trim().min(1, 'Name your template.').max(80),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1, 'Enter an item name.').max(100),
        itemType: z.enum(['income', 'expense']),
        categoryName: z.string().trim().min(1, 'Choose a category.').max(80),
        amount: z.string().refine((value) => parseMoney(value) !== null, 'Enter a valid amount.'),
        starterItemKey: z.string().optional(),
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

const retrieveLocalStarterPlan = () => {
  try {
    return retrieveApprovedStarterPlan(window.localStorage);
  } catch {
    return null;
  }
};

export const OnboardingPage = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [starterOpen, setStarterOpen] = useState(false);
  const [starterSelection, setStarterSelection] = useState<StarterTemplateSelection | null>(null);
  const [starterPlan] = useState(retrieveLocalStarterPlan);
  const { control, register, handleSubmit, setValue, trigger, formState } =
    useForm<OnboardingValues>({
      resolver: zodResolver(onboardingSchema),
      defaultValues: starterPlan
        ? {
            ...defaults,
            currencyCode: starterPlan.currencyCode,
            locale: starterPlan.locale ?? defaults.locale,
            templateName: starterPlan.templateName,
            items: starterPlan.items.map((item) => ({
              name: item.name,
              itemType: item.itemType,
              categoryName: item.categoryName,
              amount: (item.amountMinor / 100).toFixed(2),
            })),
          }
        : defaults,
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
        starter: starterSelection
          ? {
              id: starterSelection.id,
              version: starterSelection.version,
              copyKey: starterSelection.copyKey,
            }
          : undefined,
        items: input.items.map((item) => ({
          name: item.name,
          item_type: item.itemType,
          category_name: item.categoryName,
          default_amount: toDatabaseMoney(item.amount),
          ...(starterSelection ? { starter_item_key: item.starterItemKey } : {}),
        })),
      });
      const userId = session?.user.id ?? '';
      const completedAt = new Date().toISOString();
      const preferencesKey = queryKeys.preferences(userId);
      queryClient.setQueryData<UserPreferences>(preferencesKey, (current) => ({
        user_id: userId,
        last_budget_month_id: current?.last_budget_month_id ?? null,
        last_route: current?.last_route ?? null,
        theme: input.theme,
        onboarding_completed_at: current?.onboarding_completed_at ?? completedAt,
        updated_at: completedAt,
      }));
      await queryClient.invalidateQueries({ queryKey: preferencesKey, refetchType: 'none' });
      if (starterPlan) clearApprovedStarterPlan(window.localStorage);
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
          <strong>Buddy Budget</strong>
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
              <Button
                type="button"
                variant="secondary"
                icon={<Library aria-hidden="true" size={18} />}
                onClick={() => setStarterOpen(true)}
              >
                Choose a starter template
              </Button>
              {starterPlan && (
                <div className="inline-alert" role="status">
                  Your approved demo plan is ready. Review it before creating your first month.
                </div>
              )}
              {starterSelection && (
                <div className="inline-alert" role="status">
                  {starterSelection.templateName} is selected. Amounts remain editable; reopen the
                  library to change included items.
                </div>
              )}
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
                      disabled={Boolean(starterSelection)}
                      {...register(`items.${index}.itemType`, {
                        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                          const itemType = event.target.value as 'income' | 'expense';
                          setStarterSelection(null);
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
                      disabled={Boolean(starterSelection)}
                      error={formState.errors.items?.[index]?.name?.message}
                      {...register(`items.${index}.name`, {
                        onChange: () => setStarterSelection(null),
                      })}
                    />
                    <SelectField
                      label="Category"
                      className="field--compact"
                      disabled={Boolean(starterSelection)}
                      error={formState.errors.items?.[index]?.categoryName?.message}
                      {...register(`items.${index}.categoryName`, {
                        onChange: () => setStarterSelection(null),
                      })}
                    >
                      {[
                        ...new Set([
                          ...categoryOptions[
                            values.items?.[index]?.itemType === 'expense' ? 'expense' : 'income'
                          ],
                          values.items?.[index]?.categoryName ?? '',
                        ]),
                      ]
                        .filter(Boolean)
                        .map((category) => (
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
                    {!starterSelection && (
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove ${field.name}`}
                        onClick={() => items.remove(index)}
                      >
                        <Trash2 aria-hidden="true" size={19} />
                      </button>
                    )}
                  </fieldset>
                ))}
              </div>
              {!starterSelection && (
                <div className="split-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<Plus aria-hidden="true" size={18} />}
                    onClick={() => {
                      setStarterSelection(null);
                      items.append({
                        name: '',
                        itemType: 'income',
                        categoryName: 'Earnings',
                        amount: '0.00',
                      });
                    }}
                  >
                    Add income
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    icon={<Plus aria-hidden="true" size={18} />}
                    onClick={() => {
                      setStarterSelection(null);
                      items.append({
                        name: '',
                        itemType: 'expense',
                        categoryName: 'Housing',
                        amount: '0.00',
                      });
                    }}
                  >
                    Add expense
                  </Button>
                </div>
              )}
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
                Buddy Budget will copy <strong>{values.items?.length ?? 0} recurring items</strong>{' '}
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
      {starterOpen && (
        <Modal
          className="modal--starter"
          open
          title="Starter template library"
          onClose={() => setStarterOpen(false)}
        >
          <StarterTemplatePicker
            currency={values.currencyCode ?? defaults.currencyCode}
            locale={values.locale ?? defaults.locale}
            submitLabel="Use this starting point"
            onSubmit={(selection) => {
              setStarterSelection(selection);
              setValue('templateName', selection.templateName, { shouldValidate: true });
              items.replace(
                selection.items.map((item) => ({
                  name: item.name,
                  itemType: item.itemType,
                  categoryName: item.categoryName,
                  amount: item.amount,
                  starterItemKey: item.itemKey,
                })),
              );
              setStarterOpen(false);
            }}
          />
        </Modal>
      )}
    </main>
  );
};
