import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  FileSpreadsheet,
  Library,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import { setupFirstBudget } from '../../data/repositories/budgetRepository';
import { currentMonthStart } from '../../shared/formatting/money';
import {
  currencyOptions,
  includePreferenceOption,
  localeOptions,
  timezoneOptions,
} from '../../shared/localization/preferenceOptions';
import type { UserPreferences } from '../../shared/types/domain';
import { BrandMark } from '../../shared/ui/BrandMark';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { Modal } from '../../shared/ui/Modal';
import { SelectField } from '../../shared/ui/SelectField';
import { parseMoney, profileSchema, toDatabaseMoney } from '../../shared/validation/schemas';
import { clearApprovedStarterPlan, retrieveApprovedStarterPlan } from '../demo/demoModel';
import {
  createImportBatchKey,
  normalizeCsvRows,
  readCsvFile,
  suggestCsvMapping,
  type CsvColumnMapping,
  type CsvPreviewRow,
  type CsvTable,
} from '../transactions/import/csvParser';
import {
  StarterTemplatePicker,
  type StarterTemplateSelection,
} from '../templates/StarterTemplatePicker';
import {
  clearOnboardingDraft,
  createSetupKey,
  retrieveOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingPath,
} from './onboardingState';
import { claimAndAnnounceMilestone } from '../../shared/milestones/milestones';
import { retrievePendingSharedTemplateToken } from '../templates/sharedTemplate';

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Enter an item name.').max(100),
  itemType: z.enum(['income', 'expense']),
  categoryName: z.string().trim().min(1, 'Choose a category.').max(80),
  amount: z.string().refine((value) => parseMoney(value) !== null, 'Enter a valid amount.'),
  starterItemKey: z.string().optional(),
});
const onboardingSchema = profileSchema.omit({ theme: true }).extend({
  templateName: z.string().trim().min(1, 'Name your template.').max(80),
  items: z.array(itemSchema).min(1, 'Add at least one budget item.').max(50),
});
type OnboardingValues = z.infer<typeof onboardingSchema>;
const defaultItems: OnboardingValues['items'] = [
  { name: 'Salary', itemType: 'income', categoryName: 'Earnings', amount: '0.00' },
  { name: 'Rent', itemType: 'expense', categoryName: 'Housing', amount: '0.00' },
  { name: 'Groceries', itemType: 'expense', categoryName: 'Groceries', amount: '0.00' },
];
const defaults: OnboardingValues = {
  displayName: '',
  currencyCode: 'ZAR',
  locale: navigator.language || 'en-ZA',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg',
  templateName: 'My monthly plan',
  items: defaultItems,
};
const categoryOptions = {
  income: ['Earnings', 'Imported income'],
  expense: ['Housing', 'Utilities', 'Groceries', 'Transport', 'Entertainment', 'Imported expenses'],
} as const;
const pathOptions: Array<{
  id: OnboardingPath;
  title: string;
  description: string;
  icon: typeof Library;
}> = [
  {
    id: 'starter',
    title: 'Use a curated starter',
    description: 'Choose a proven structure and keep only the items that fit.',
    icon: Library,
  },
  {
    id: 'transfer',
    title: 'Use my saved plan',
    description: 'Review the plan approved in the demo or public calculator.',
    icon: Sparkles,
  },
  {
    id: 'csv',
    title: 'Import a bank statement',
    description: 'Turn current-month CSV activity into a first plan and actuals.',
    icon: FileSpreadsheet,
  },
  {
    id: 'blank',
    title: 'Build a simple plan',
    description: 'Start with a few editable essentials and shape it yourself.',
    icon: Calculator,
  },
];
const retrieveTransfer = () => {
  try {
    return retrieveApprovedStarterPlan(window.localStorage);
  } catch {
    return null;
  }
};

export const OnboardingPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [transferPlan] = useState(retrieveTransfer);
  const [savedDraft] = useState(() =>
    userId ? retrieveOnboardingDraft(window.localStorage, userId) : null,
  );
  const [path, setPath] = useState<OnboardingPath | null>(savedDraft?.path ?? null);
  const [step, setStep] = useState(savedDraft?.step ?? 1);
  const [setupKey] = useState(savedDraft?.setupKey ?? createSetupKey);
  const [starterOpen, setStarterOpen] = useState(false);
  const [starter, setStarter] = useState(savedDraft?.starter);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvTable, setCsvTable] = useState<CsvTable | null>(null);
  const [csvMapping, setCsvMapping] = useState<CsvColumnMapping | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initialValues = savedDraft
    ? {
        displayName: savedDraft.displayName,
        currencyCode: savedDraft.currencyCode,
        locale: savedDraft.locale,
        timezone: savedDraft.timezone,
        templateName: savedDraft.templateName,
        items: savedDraft.items.length ? savedDraft.items : defaultItems,
      }
    : defaults;
  const { control, register, handleSubmit, setValue, getValues, trigger, formState } =
    useForm<OnboardingValues>({
      resolver: zodResolver(onboardingSchema),
      defaultValues: initialValues,
      mode: 'onBlur',
    });
  const items = useFieldArray({ control, name: 'items' });
  const values = useWatch({ control });
  const currencyChoices = includePreferenceOption(
    currencyOptions,
    values.currencyCode ?? defaults.currencyCode,
  );
  const localeChoices = includePreferenceOption(localeOptions, values.locale ?? defaults.locale);
  const timezoneChoices = includePreferenceOption(
    timezoneOptions,
    values.timezone ?? defaults.timezone,
  );

  useEffect(() => {
    if (!userId) return;
    saveOnboardingDraft(window.localStorage, {
      version: 1,
      userId,
      updatedAt: new Date().toISOString(),
      setupKey,
      path,
      step,
      displayName: values.displayName ?? '',
      currencyCode: values.currencyCode ?? defaults.currencyCode,
      locale: values.locale ?? defaults.locale,
      timezone: values.timezone ?? defaults.timezone,
      templateName: values.templateName ?? defaults.templateName,
      items: (values.items ?? []).map((item) => ({
        name: item?.name ?? '',
        itemType: item?.itemType ?? 'expense',
        categoryName: item?.categoryName ?? '',
        amount: item?.amount ?? '0.00',
        ...(item?.starterItemKey ? { starterItemKey: item.starterItemKey } : {}),
      })),
      ...(starter ? { starter } : {}),
    });
  }, [path, setupKey, starter, step, userId, values]);

  useEffect(() => {
    if (step > 1) headingRef.current?.focus();
  }, [step]);

  const choosePath = (nextPath: OnboardingPath) => {
    setPath(nextPath);
    setStarter(undefined);
    setCsvPreview(null);
    setCsvTable(null);
    setCsvMapping(null);
    setCsvFileName('');
    if (nextPath === 'transfer' && transferPlan) {
      setValue('currencyCode', transferPlan.currencyCode);
      if (transferPlan.locale) setValue('locale', transferPlan.locale);
      setValue('templateName', transferPlan.templateName);
      items.replace(
        transferPlan.items.map((item) => ({
          name: item.name,
          itemType: item.itemType,
          categoryName: item.categoryName,
          amount: (item.amountMinor / 100).toFixed(2),
        })),
      );
    } else if (nextPath === 'blank') {
      setValue('templateName', defaults.templateName);
      items.replace(defaultItems);
    } else if (nextPath === 'csv') {
      setValue('templateName', 'Imported monthly plan');
      items.replace(defaultItems.slice(0, 1));
    } else items.replace([]);
    setStep(2);
  };

  const next = async () => {
    setSubmitError(null);
    if (step === 2) {
      if (await trigger(['displayName', 'currencyCode', 'locale', 'timezone'])) setStep(3);
      return;
    }
    if (path === 'starter' && !starter) {
      setSubmitError('Choose and customise a starter template before continuing.');
      return;
    }
    if (path === 'csv' && !csvPreview?.some((row) => row.status === 'valid')) {
      setSubmitError('Choose a CSV file and prepare a valid preview before continuing.');
      return;
    }
    if (await trigger(['templateName', 'items'])) setStep(4);
  };

  const chooseCsv = async (file: File | undefined) => {
    if (!file) return;
    setCsvError(null);
    try {
      const table = await readCsvFile(file);
      setCsvFileName(file.name);
      setCsvTable(table);
      setCsvMapping(suggestCsvMapping(table));
      setCsvPreview(null);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'The CSV file could not be read.');
    }
  };

  const prepareCsv = async () => {
    if (!csvTable || !csvMapping) return;
    setCsvError(null);
    try {
      const preview = await normalizeCsvRows(
        csvTable,
        csvMapping,
        currentMonthStart(values.timezone),
        userId,
      );
      const valid = preview.filter((row) => row.status === 'valid' && row.normalized);
      setCsvPreview(preview);
      if (!valid.length) {
        setCsvError(
          'No valid rows belong to the current month. Check the mapping and date format.',
        );
        return;
      }
      const incomeMinor = valid.reduce(
        (sum, row) =>
          sum + (row.normalized?.transaction_type === 'income' ? row.normalized.amount_minor : 0),
        0,
      );
      const expenseMinor = valid.reduce(
        (sum, row) =>
          sum + (row.normalized?.transaction_type === 'expense' ? row.normalized.amount_minor : 0),
        0,
      );
      items.replace([
        ...(incomeMinor
          ? [
              {
                name: 'Imported income',
                itemType: 'income' as const,
                categoryName: 'Imported income',
                amount: (incomeMinor / 100).toFixed(2),
              },
            ]
          : []),
        ...(expenseMinor
          ? [
              {
                name: 'Imported expenses',
                itemType: 'expense' as const,
                categoryName: 'Imported expenses',
                amount: (expenseMinor / 100).toFixed(2),
              },
            ]
          : []),
      ]);
    } catch (error) {
      setCsvError(
        error instanceof Error ? error.message : 'The CSV preview could not be prepared.',
      );
    }
  };

  const submit = async (input: OnboardingValues) => {
    if (!path) return;
    setSubmitError(null);
    try {
      let csvImport: Parameters<typeof setupFirstBudget>[0]['csvImport'];
      if (path === 'csv' && csvPreview && csvMapping) {
        const rows = csvPreview
          .filter((row) => row.status === 'valid' && row.normalized)
          .map((row) => ({
            ...row.normalized!,
            category_name:
              row.normalized!.transaction_type === 'income'
                ? 'Imported income'
                : 'Imported expenses',
          }));
        csvImport = {
          file_name: csvFileName,
          batch_key: await createImportBatchKey(userId, setupKey, null, csvPreview),
          mapping_metadata: {
            delimiter: csvTable?.delimiter,
            date_format: csvMapping.dateFormat,
            decimal_format: csvMapping.decimalFormat,
            amount_mode: csvMapping.amountMode,
            date_column: csvMapping.dateColumn,
            description_column: csvMapping.descriptionColumn,
            reference_column: csvMapping.referenceColumn,
            amount_column: csvMapping.amountColumn,
            debit_column: csvMapping.debitColumn,
            credit_column: csvMapping.creditColumn,
          },
          rows,
          invalid_count: csvPreview.filter((row) => row.status === 'invalid').length,
          excluded_count: csvPreview.filter((row) => row.status === 'excluded').length,
        };
      }
      const month = await setupFirstBudget({
        setupKey,
        path,
        displayName: input.displayName,
        currencyCode: input.currencyCode,
        locale: input.locale,
        timezone: input.timezone,
        templateName: input.templateName,
        starter,
        items: input.items.map((item) => ({
          name: item.name,
          item_type: item.itemType,
          category_name: item.categoryName,
          default_amount: toDatabaseMoney(item.amount),
          ...(item.starterItemKey ? { starter_item_key: item.starterItemKey } : {}),
        })),
        csvImport,
      });
      const completedAt = new Date().toISOString();
      await queryClient.cancelQueries({ queryKey: ['user', userId] });
      queryClient.removeQueries({ queryKey: ['user', userId] });
      queryClient.setQueryData<UserPreferences>(queryKeys.preferences(userId), {
        user_id: userId,
        last_budget_month_id: month.id,
        last_route: `/app/budget/${month.month_start}`,
        theme: 'system',
        onboarding_completed_at: completedAt,
        updated_at: completedAt,
      });
      clearOnboardingDraft(window.localStorage, userId);
      if (path === 'transfer') clearApprovedStarterPlan(window.localStorage);
      void claimAndAnnounceMilestone('first_budget').catch(() => undefined);
      const pendingTemplate = retrievePendingSharedTemplateToken();
      void navigate(pendingTemplate ? '/template' : `/app/budget/${month.month_start}`, {
        replace: true,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Setup failed. Please try again.');
    }
  };

  const renderItems = path !== 'starter' && path !== 'csv';
  const headers = csvTable?.headers ?? [];
  const columnOptions = headers.map((header, index) => (
    <option key={`${header}:${index}`} value={index}>
      {header}
    </option>
  ));

  return (
    <main className="onboarding">
      <header className="onboarding__header">
        <span className="brand">
          <BrandMark />
          <strong>Buddy Budget</strong>
        </span>
        <span>Step {step} of 4</span>
      </header>
      <div className="onboarding__progress" aria-label={`Step ${step} of 4`}>
        {[1, 2, 3, 4].map((number) => (
          <i className={number <= step ? 'active' : ''} key={number} />
        ))}
      </div>
      <section className="onboarding__card">
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          {step === 1 && (
            <div className="onboarding__step">
              <p className="eyebrow">Choose your quickest start</p>
              <h1>How would you like to build your first month?</h1>
              <p className="muted">Each path ends at the same editable dashboard.</p>
              <div className="onboarding-paths">
                {pathOptions.map((option) => {
                  const Icon = option.icon;
                  const disabled = option.id === 'transfer' && !transferPlan;
                  return (
                    <button
                      className="onboarding-path"
                      disabled={disabled}
                      key={option.id}
                      onClick={() => choosePath(option.id)}
                      type="button"
                    >
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{option.title}</strong>
                        <small>
                          {disabled
                            ? 'No approved demo or calculator plan found.'
                            : option.description}
                        </small>
                      </span>
                      <ArrowRight aria-hidden="true" size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="onboarding__step">
              <p className="eyebrow">Budget basics</p>
              <h1 ref={headingRef} tabIndex={-1}>
                Set your money and date format
              </h1>
              <p className="muted">Theme and advanced preferences can wait until Settings.</p>
              <div className="form-grid">
                <FormField
                  label="Display name (optional)"
                  error={formState.errors.displayName?.message}
                  {...register('displayName')}
                />
                <SelectField label="Currency" {...register('currencyCode')}>
                  {currencyChoices.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Locale" {...register('locale')}>
                  {localeChoices.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Timezone" {...register('timezone')}>
                  {timezoneChoices.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="onboarding__step">
              <p className="eyebrow">Build your first month</p>
              <h1 ref={headingRef} tabIndex={-1}>
                {path === 'csv' ? 'Preview your current-month activity' : 'Review your plan'}
              </h1>
              {path === 'starter' && (
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Library size={18} />}
                  onClick={() => setStarterOpen(true)}
                >
                  {starter ? 'Change starter template' : 'Choose a starter template'}
                </Button>
              )}
              {path === 'csv' && (
                <div className="onboarding-csv">
                  <FormField
                    label="Bank statement CSV"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => void chooseCsv(event.target.files?.[0])}
                  />
                  {csvTable && csvMapping && (
                    <>
                      <div className="form-grid">
                        <SelectField
                          label="Date column"
                          value={csvMapping.dateColumn}
                          onChange={(event) =>
                            setCsvMapping({ ...csvMapping, dateColumn: Number(event.target.value) })
                          }
                        >
                          {columnOptions}
                        </SelectField>
                        <SelectField
                          label="Description column"
                          value={csvMapping.descriptionColumn}
                          onChange={(event) =>
                            setCsvMapping({
                              ...csvMapping,
                              descriptionColumn: Number(event.target.value),
                            })
                          }
                        >
                          {columnOptions}
                        </SelectField>
                        <SelectField
                          label="Date format"
                          value={csvMapping.dateFormat}
                          onChange={(event) =>
                            setCsvMapping({
                              ...csvMapping,
                              dateFormat: event.target.value as CsvColumnMapping['dateFormat'],
                            })
                          }
                        >
                          <option value="ymd">YYYY-MM-DD</option>
                          <option value="dmy">DD-MM-YYYY</option>
                          <option value="mdy">MM-DD-YYYY</option>
                        </SelectField>
                        <SelectField
                          label="Amount layout"
                          value={csvMapping.amountMode}
                          onChange={(event) =>
                            setCsvMapping({
                              ...csvMapping,
                              amountMode: event.target.value as CsvColumnMapping['amountMode'],
                            })
                          }
                        >
                          <option value="signed">One signed amount column</option>
                          <option value="debit_credit">Separate debit and credit</option>
                        </SelectField>
                        {csvMapping.amountMode === 'signed' ? (
                          <SelectField
                            label="Amount column"
                            value={csvMapping.amountColumn ?? ''}
                            onChange={(event) =>
                              setCsvMapping({
                                ...csvMapping,
                                amountColumn: Number(event.target.value),
                              })
                            }
                          >
                            <option value="">Choose column</option>
                            {columnOptions}
                          </SelectField>
                        ) : (
                          <>
                            <SelectField
                              label="Debit column"
                              value={csvMapping.debitColumn ?? ''}
                              onChange={(event) =>
                                setCsvMapping({
                                  ...csvMapping,
                                  debitColumn: Number(event.target.value),
                                })
                              }
                            >
                              <option value="">Choose column</option>
                              {columnOptions}
                            </SelectField>
                            <SelectField
                              label="Credit column"
                              value={csvMapping.creditColumn ?? ''}
                              onChange={(event) =>
                                setCsvMapping({
                                  ...csvMapping,
                                  creditColumn: Number(event.target.value),
                                })
                              }
                            >
                              <option value="">Choose column</option>
                              {columnOptions}
                            </SelectField>
                          </>
                        )}
                      </div>
                      <Button type="button" variant="secondary" onClick={() => void prepareCsv()}>
                        Prepare preview
                      </Button>
                    </>
                  )}
                  {csvPreview && (
                    <p role="status">
                      {csvPreview.filter((row) => row.status === 'valid').length} valid rows ·{' '}
                      {csvPreview.filter((row) => row.status === 'invalid').length} need attention
                    </p>
                  )}
                  {csvError && (
                    <div className="inline-alert inline-alert--error" role="alert">
                      {csvError}
                    </div>
                  )}
                  <p className="muted">
                    The raw file stays in this browser and is never uploaded. Refreshing requires
                    selecting it again.
                  </p>
                </div>
              )}
              {(renderItems || starter) && (
                <>
                  {path === 'transfer' && (
                    <div className="inline-alert" role="status">
                      Your approved plan is ready. Only these plan items—not demo transactions—will
                      be saved.
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
                        <legend className="visually-hidden">Budget item {index + 1}</legend>
                        <SelectField
                          label="Type"
                          className="field--compact"
                          disabled={Boolean(starter)}
                          {...register(`items.${index}.itemType`, {
                            onChange: (event: ChangeEvent<HTMLSelectElement>) =>
                              setValue(
                                `items.${index}.categoryName`,
                                categoryOptions[event.target.value as 'income' | 'expense'][0],
                              ),
                          })}
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </SelectField>
                        <FormField
                          label="Item name"
                          className="field--compact"
                          disabled={Boolean(starter)}
                          error={formState.errors.items?.[index]?.name?.message}
                          {...register(`items.${index}.name`)}
                        />
                        <SelectField
                          label="Category"
                          className="field--compact"
                          disabled={Boolean(starter)}
                          {...register(`items.${index}.categoryName`)}
                        >
                          {categoryOptions[
                            values.items?.[index]?.itemType === 'income' ? 'income' : 'expense'
                          ].map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </SelectField>
                        <FormField
                          label="Monthly amount"
                          className="field--compact"
                          inputMode="decimal"
                          error={formState.errors.items?.[index]?.amount?.message}
                          {...register(`items.${index}.amount`)}
                        />
                        {!starter && (
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
                  {!starter && renderItems && (
                    <div className="split-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        icon={<Plus size={18} />}
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
                        icon={<Plus size={18} />}
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
                  )}
                </>
              )}
              {submitError && (
                <div className="inline-alert inline-alert--error" role="alert">
                  {submitError}
                </div>
              )}
            </div>
          )}
          {step === 4 && (
            <div className="onboarding__step onboarding__review">
              <span className="step-icon">
                <Check aria-hidden="true" />
              </span>
              <p className="eyebrow">Final review</p>
              <h1 ref={headingRef} tabIndex={-1}>
                Ready for your first dashboard
              </h1>
              <p>
                <strong>{getValues('templateName')}</strong> will start with{' '}
                <strong>{getValues('items').length} budget items</strong>
                {path === 'csv'
                  ? ` and ${csvPreview?.filter((row) => row.status === 'valid').length ?? 0} posted transactions`
                  : ''}
                .
              </p>
              <div className="review-note">
                <strong>Safe to retry.</strong>
                <span>
                  If setup is interrupted, submitting again will return the same first month without
                  duplicates.
                </span>
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
                icon={<ArrowLeft size={18} />}
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </Button>
            )}
            {step > 1 && step < 4 && (
              <Button type="button" onClick={() => void next()}>
                Continue <ArrowRight size={18} />
              </Button>
            )}
            {step === 4 && (
              <Button type="submit" loading={formState.isSubmitting}>
                Create my dashboard <ArrowRight size={18} />
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
            onSubmit={(selection: StarterTemplateSelection) => {
              setStarter({
                id: selection.id,
                version: selection.version,
                copyKey: selection.copyKey,
              });
              setValue('templateName', selection.templateName);
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
