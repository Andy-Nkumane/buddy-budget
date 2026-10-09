import { ArrowRight, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BrandMark } from '../../shared/ui/BrandMark';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { SelectField } from '../../shared/ui/SelectField';
import {
  calculateDemoTotals,
  createDemoState,
  parseDemoMoney,
  saveApprovedStarterPlan,
  type DemoState,
} from './demoModel';

const formatMoney = (minor: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(minor / 100);

const DemoServiceWorker = () => {
  useRegisterSW();
  return null;
};

const PlanAmountInput = ({
  name,
  plannedMinor,
  update,
}: {
  name: string;
  plannedMinor: number;
  update: (amountMinor: number) => void;
}) => {
  const [draft, setDraft] = useState((plannedMinor / 100).toFixed(2));
  return (
    <label>
      <span>Planned</span>
      <input
        aria-label={`Planned ${name}`}
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const amountMinor = parseDemoMoney(draft);
          if (amountMinor === null) {
            setDraft((plannedMinor / 100).toFixed(2));
            return;
          }
          setDraft((amountMinor / 100).toFixed(2));
          update(amountMinor);
        }}
      />
    </label>
  );
};

export const DemoPage = () => {
  const [state, setState] = useState<DemoState>(createDemoState);
  const [description, setDescription] = useState('');
  const [itemId, setItemId] = useState('groceries');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const totals = useMemo(() => calculateDemoTotals(state), [state]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const actualByItem = useMemo(
    () =>
      state.transactions.reduce<Record<string, number>>((result, transaction) => {
        result[transaction.itemId] = (result[transaction.itemId] ?? 0) + transaction.amountMinor;
        return result;
      }, {}),
    [state.transactions],
  );

  const addTransaction = (event: FormEvent) => {
    event.preventDefault();
    const amountMinor = parseDemoMoney(amount);
    const item = state.items.find((candidate) => candidate.id === itemId);
    if (!description.trim() || amountMinor === null || amountMinor === 0 || !item) {
      setFormError('Enter a description, budget item, and amount greater than zero.');
      return;
    }
    setState((current) => ({
      ...current,
      transactions: [
        ...current.transactions,
        {
          id: `visitor-${current.transactions.length + 1}`,
          description: description.trim(),
          itemId: item.id,
          itemType: item.itemType,
          amountMinor,
        },
      ],
    }));
    setDescription('');
    setAmount('');
    setFormError(null);
  };

  const approveStarterPlan = () => {
    if (!online) return;
    try {
      saveApprovedStarterPlan(window.localStorage, state.items);
      window.location.assign(`${import.meta.env.BASE_URL}auth/register?starter=demo`);
    } catch {
      setConversionError(
        'This browser could not save the starter plan. Check site storage permissions and try again.',
      );
    }
  };

  return (
    <main className="demo-page">
      <DemoServiceWorker />
      <header className="demo-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <BrandMark />
          <strong>Buddy Budget</strong>
        </a>
        <span className="demo-badge">Interactive fictional demo</span>
      </header>

      <section className="demo-intro">
        <div>
          <p className="eyebrow">Try it before signing up</p>
          <h1>See where the month is going</h1>
          <p>
            Adjust the fictional plan and record sample activity. Nothing here connects to a bank,
            account, or Buddy Budget profile.
          </p>
          {conversionError && (
            <p className="field__error" role="alert">
              {conversionError}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" size={18} />}
          onClick={() => {
            setState(createDemoState());
            setDescription('');
            setAmount('');
            setFormError(null);
          }}
        >
          Reset demo
        </Button>
      </section>

      <section className="demo-summary" aria-label="Demo budget summary">
        <article>
          <span>Planned remaining</span>
          <strong>{formatMoney(totals.plannedRemainingMinor)}</strong>
          <small>Planned income minus planned expenses</small>
        </article>
        <article>
          <span>Actual remaining</span>
          <strong>{formatMoney(totals.actualRemainingMinor)}</strong>
          <small>Sample income minus sample spending</small>
        </article>
        <article>
          <span>Actual spending</span>
          <strong>{formatMoney(totals.actualExpenseMinor)}</strong>
          <small>Against {formatMoney(totals.plannedExpenseMinor)} planned</small>
        </article>
      </section>

      <div className="demo-workspace">
        <section className="demo-panel" aria-labelledby="demo-plan-title">
          <div className="demo-panel__heading">
            <div>
              <p className="eyebrow">Planned versus actual</p>
              <h2 id="demo-plan-title">Sample monthly plan</h2>
            </div>
            <span>Values update immediately</span>
          </div>
          <div className="demo-plan-list">
            {state.items.map((item) => {
              const actual = actualByItem[item.id] ?? 0;
              const variance =
                item.itemType === 'income'
                  ? actual - item.plannedMinor
                  : item.plannedMinor - actual;
              return (
                <article className="demo-plan-item" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.categoryName} · {item.itemType}
                    </small>
                  </div>
                  <PlanAmountInput
                    key={`${item.id}-${item.plannedMinor}`}
                    name={item.name}
                    plannedMinor={item.plannedMinor}
                    update={(plannedMinor) =>
                      setState((current) => ({
                        ...current,
                        items: current.items.map((candidate) =>
                          candidate.id === item.id ? { ...candidate, plannedMinor } : candidate,
                        ),
                      }))
                    }
                  />
                  <dl>
                    <div>
                      <dt>Actual</dt>
                      <dd>{formatMoney(actual)}</dd>
                    </div>
                    <div>
                      <dt>{item.itemType === 'income' ? 'Difference' : 'Available'}</dt>
                      <dd className={variance < 0 ? 'negative-amount' : 'positive-amount'}>
                        {formatMoney(variance)}
                      </dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="demo-panel demo-entry" aria-labelledby="demo-entry-title">
          <p className="eyebrow">Try a change</p>
          <h2 id="demo-entry-title">Add sample activity</h2>
          <p className="muted">This sample transaction stays in memory and is never transferred.</p>
          <form onSubmit={addTransaction} noValidate>
            <FormField
              label="Description"
              value={description}
              maxLength={100}
              onChange={(event) => setDescription(event.target.value)}
            />
            <SelectField
              label="Budget item"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
            >
              {state.items.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} ({item.itemType})
                </option>
              ))}
            </SelectField>
            <FormField
              label="Amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {formError && (
              <p className="field__error" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" icon={<Plus aria-hidden="true" size={18} />}>
              Add sample transaction
            </Button>
          </form>
          <div className="demo-entry__recent">
            <h3>Recent sample activity</h3>
            <ul>
              {state.transactions
                .slice(-4)
                .reverse()
                .map((transaction) => (
                  <li key={transaction.id}>
                    <span>{transaction.description}</span>
                    <strong>
                      {transaction.itemType === 'income' ? '+' : '−'}{' '}
                      {formatMoney(transaction.amountMinor)}
                    </strong>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className="demo-conversion" aria-labelledby="demo-conversion-title">
        <ShieldCheck aria-hidden="true" size={28} />
        <div>
          <h2 id="demo-conversion-title">Start with this setup</h2>
          <p>
            Copy only the plan names, categories, types, and planned amounts into registration.
            Sample transactions are never copied. The approved plan expires from this browser after
            24 hours and is removed after successful setup.
          </p>
          {!online && (
            <p className="demo-conversion__offline" id="demo-conversion-offline" role="status">
              You are offline. This option will become available when you are back online.
            </p>
          )}
        </div>
        <Button
          aria-describedby={!online ? 'demo-conversion-offline' : undefined}
          disabled={!online}
          onClick={approveStarterPlan}
        >
          Start with this setup <ArrowRight aria-hidden="true" size={18} />
        </Button>
      </section>
    </main>
  );
};
