import { ArrowRight, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  currencyOptions,
  includePreferenceOption,
  localeOptions,
} from '../../shared/localization/preferenceOptions';
import { formatMoney, moneyToMinorUnits } from '../../shared/formatting/money';
import { BrandMark } from '../../shared/ui/BrandMark';
import { Button } from '../../shared/ui/Button';
import { saveApprovedLocalPlan } from '../demo/demoModel';
import {
  calculateCalculatorTotals,
  createCalculatorRows,
  isCalculatorRowValid,
  type CalculatorItemType,
  type CalculatorRow,
} from './calculatorModel';

const categories = {
  income: ['Earnings', 'Salary', 'Freelance', 'Other income'],
  expense: [
    'Housing',
    'Utilities',
    'Groceries',
    'Transport',
    'Healthcare',
    'Debt',
    'Savings',
    'Other expense',
  ],
} as const;

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const resolveLocale = () => {
  const locale = navigator.language || 'en-ZA';
  return Intl.DateTimeFormat.supportedLocalesOf([locale])[0] ?? 'en-ZA';
};

export const PublicBudgetCalculatorPage = () => {
  const [initialLocale] = useState(resolveLocale);
  const [rows, setRows] = useState(createCalculatorRows);
  const [currency, setCurrency] = useState('ZAR');
  const [locale, setLocale] = useState(initialLocale);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const totals = useMemo(() => calculateCalculatorTotals(rows), [rows]);
  const hasInvalidRows = rows.some((row) => !isCalculatorRowValid(row));

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    const previousCanonical = canonical?.href;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    document.title = 'Monthly Budget Calculator | Buddy Budget';
    if (description)
      description.content =
        'Calculate monthly income, expenses, remaining money, and savings rate privately in your browser.';
    canonical.href = new URL(`${import.meta.env.BASE_URL}calculator`, window.location.origin).href;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.title = previousTitle;
      if (description && previousDescription !== undefined)
        description.content = previousDescription;
      if (createdCanonical) canonical?.remove();
      else if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, []);

  const updateRow = (id: string, changes: Partial<CalculatorRow>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  const addRow = (itemType: CalculatorItemType) =>
    setRows((current) => [
      ...current,
      {
        id: createId(),
        name: '',
        categoryName: categories[itemType][0],
        itemType,
        amount: '0.00',
      },
    ]);

  const reset = () => {
    setRows(createCalculatorRows());
    setCurrency('ZAR');
    setLocale(initialLocale);
    setConversionError(null);
  };

  const approvePlan = () => {
    if (!online) {
      setConversionError('Account creation will be available when you are back online.');
      return;
    }
    if (!rows.length) {
      setConversionError('Add at least one income or expense row before continuing.');
      return;
    }
    if (hasInvalidRows) {
      setConversionError('Fix the highlighted rows before continuing.');
      return;
    }
    try {
      saveApprovedLocalPlan(window.localStorage, {
        currencyCode: currency,
        locale,
        templateName: 'My monthly plan',
        items: rows.map((row) => ({
          name: row.name.trim(),
          categoryName: row.categoryName.trim(),
          itemType: row.itemType,
          amountMinor: moneyToMinorUnits(row.amount),
        })),
      });
      window.location.assign(`${import.meta.env.BASE_URL}auth/register?starter=calculator`);
    } catch {
      setConversionError(
        'This browser could not save the plan locally. Check storage permissions and try again.',
      );
    }
  };

  return (
    <main className="calculator-page">
      <header className="calculator-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <BrandMark />
          <strong>Buddy Budget</strong>
        </a>
        <a className="button button--ghost" href={`${import.meta.env.BASE_URL}auth/sign-in`}>
          Sign in
        </a>
      </header>
      <section className="calculator-hero" aria-labelledby="calculator-title">
        <div>
          <p className="eyebrow">Free monthly budget calculator</p>
          <h1 id="calculator-title">See where your month stands.</h1>
          <p>
            Add expected income and expenses. Everything stays in this browser unless you choose to
            save the plan.
          </p>
        </div>
        <aside>
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Private by default</strong>No account or bank details required.
          </span>
        </aside>
      </section>
      <section className="calculator-workspace">
        <div className="calculator-controls">
          <label className="field">
            <span className="field__label">Currency</span>
            <select
              className="input"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {includePreferenceOption(currencyOptions, currency).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Number and date format</span>
            <select
              className="input"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
            >
              {includePreferenceOption(localeOptions, locale).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            variant="secondary"
            icon={<RotateCcw aria-hidden="true" size={18} />}
            onClick={reset}
          >
            Reset
          </Button>
        </div>
        <div className="calculator-summary" aria-live="polite">
          <article>
            <span>Income</span>
            <strong className="amount-positive">
              + {formatMoney(totals.incomeMinor / 100, currency, locale)}
            </strong>
          </article>
          <article>
            <span>Expenses</span>
            <strong className="amount-negative">
              − {formatMoney(totals.expenseMinor / 100, currency, locale)}
            </strong>
          </article>
          <article>
            <span>Remaining</span>
            <strong className={totals.remainingMinor < 0 ? 'amount-negative' : 'amount-positive'}>
              {formatMoney(totals.remainingMinor / 100, currency, locale)}
            </strong>
          </article>
          <article>
            <span>Savings rate</span>
            <strong>
              {totals.savingsRate === null ? 'Not available' : `${totals.savingsRate.toFixed(1)}%`}
            </strong>
          </article>
        </div>
        {(['income', 'expense'] as const).map((itemType) => (
          <section
            className="calculator-group"
            key={itemType}
            aria-labelledby={`${itemType}-heading`}
          >
            <header>
              <div>
                <p className="eyebrow">{itemType}</p>
                <h2 id={`${itemType}-heading`}>
                  {itemType === 'income' ? 'Money coming in' : 'Money going out'}
                </h2>
              </div>
              <Button
                variant="secondary"
                icon={<Plus aria-hidden="true" size={17} />}
                onClick={() => addRow(itemType)}
              >
                Add {itemType}
              </Button>
            </header>
            <div className="calculator-rows">
              {rows
                .filter((row) => row.itemType === itemType)
                .map((row) => {
                  const valid = isCalculatorRowValid(row);
                  return (
                    <fieldset className="calculator-row" key={row.id}>
                      <legend className="visually-hidden">{itemType} entry</legend>
                      <label>
                        <span>Name</span>
                        <input
                          className="input"
                          value={row.name}
                          maxLength={100}
                          aria-invalid={!row.name.trim()}
                          onChange={(event) => updateRow(row.id, { name: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>Category</span>
                        <select
                          className="input"
                          value={row.categoryName}
                          onChange={(event) =>
                            updateRow(row.id, { categoryName: event.target.value })
                          }
                        >
                          {categories[itemType].map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Monthly amount</span>
                        <input
                          className="input"
                          inputMode="decimal"
                          value={row.amount}
                          aria-invalid={!valid}
                          onChange={(event) => updateRow(row.id, { amount: event.target.value })}
                        />
                      </label>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Remove ${row.name || itemType}`}
                        onClick={() =>
                          setRows((current) => current.filter((entry) => entry.id !== row.id))
                        }
                      >
                        <Trash2 aria-hidden="true" size={18} />
                      </button>
                      {!valid && (
                        <span className="field__error" role="alert">
                          Enter a name and a non-negative amount with up to two decimals.
                        </span>
                      )}
                    </fieldset>
                  );
                })}
            </div>
          </section>
        ))}
        <section className="calculator-conversion">
          <div>
            <p className="eyebrow">Keep your plan</p>
            <h2>Ready to use this every month?</h2>
            <p>
              Create an account only when you are ready. We transfer these plan rows once—never
              browsing activity or bank data.
            </p>
          </div>
          <Button
            disabled={!online}
            icon={<ArrowRight aria-hidden="true" size={18} />}
            onClick={approvePlan}
          >
            Create an account and save this plan
          </Button>
          {conversionError && (
            <p className="field__error" role="alert">
              {conversionError}
            </p>
          )}
          {!online && !conversionError && (
            <p className="field__error" role="status">
              Account creation will be available when you are back online.
            </p>
          )}
        </section>
      </section>
      <section className="calculator-explanation">
        <h2>What these numbers mean</h2>
        <div>
          <article>
            <h3>Remaining money</h3>
            <p>
              Expected income minus expected expenses. A negative result means the entered expenses
              are greater than the entered income.
            </p>
          </article>
          <article>
            <h3>Savings rate</h3>
            <p>
              Remaining money divided by income. It is unavailable when income is zero and is only a
              planning summary, not financial advice.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
};
