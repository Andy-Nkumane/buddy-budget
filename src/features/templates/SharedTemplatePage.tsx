import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  copySharedTemplate,
  retrievePublicSharedTemplate,
} from '../../data/repositories/budgetRepository';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { parseMoney, toDatabaseMoney } from '../../shared/validation/schemas';
import {
  clearPendingSharedTemplateToken,
  retrievePendingSharedTemplateToken,
  savePendingSharedTemplateToken,
  type SharedTemplateSnapshot,
} from './sharedTemplate';

const readToken = () => window.location.hash.slice(1) || retrievePendingSharedTemplateToken();

export const SharedTemplatePage = () => {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [token] = useState(readToken);
  const [snapshot, setSnapshot] = useState<SharedTemplateSnapshot | null>(null);
  const [name, setName] = useState('');
  const [items, setItems] = useState<SharedTemplateSnapshot['items']>([]);
  const [copyKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(
    token ? null : 'This template link is unavailable.',
  );
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.content;
    const robots = existing ?? document.head.appendChild(document.createElement('meta'));
    robots.name = 'robots';
    robots.content = 'noindex,nofollow,noarchive';
    return () => {
      if (!existing) robots.remove();
      else robots.content = previous ?? '';
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    void retrievePublicSharedTemplate(token)
      .then(({ snapshot: next }) => {
        setSnapshot(next);
        setName(next.name);
        setItems(next.items);
      })
      .catch(() => setError('This template link is unavailable or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  const continueToAuth = (path: '/auth/sign-in' | '/auth/register') => {
    savePendingSharedTemplateToken(token);
    void navigate(path, { state: { from: '/template' } });
  };

  const copy = async () => {
    if (!snapshot || !items.length) return;
    if (!name.trim() || items.some((item) => !item.name.trim() || !item.categoryName.trim())) {
      setError('Add a template name, item name, and category for every included item.');
      return;
    }
    if (items.some((item) => parseMoney(item.amount ?? '0.00') === null)) {
      setError('Enter non-negative amounts with no more than two decimal places.');
      return;
    }
    setCopying(true);
    setError(null);
    try {
      await copySharedTemplate({
        token,
        copyKey,
        templateName: name,
        items: items.map((item) => ({
          key: item.key,
          name: item.name,
          itemType: item.itemType,
          categoryName: item.categoryName,
          amount: toDatabaseMoney(item.amount ?? '0.00'),
        })),
      });
      clearPendingSharedTemplateToken();
      void navigate('/app/templates', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The template could not be copied.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <main className="public-template-page">
      <header>
        <Link to="/">Buddy Budget</Link>
        <span>Shared template · no financial history</span>
      </header>
      {loading || authLoading ? (
        <p role="status">Opening the shared template…</p>
      ) : error && !snapshot ? (
        <section className="shared-report-unavailable">
          <h1>Template unavailable</h1>
          <p>{error}</p>
        </section>
      ) : snapshot ? (
        <section className="public-template-card">
          <p className="eyebrow">Version {snapshot.version}</p>
          <h1>{snapshot.name}</h1>
          <p>Preview and customise this structure before copying it into your household.</p>
          {!snapshot.includesAmounts && (
            <div className="inline-alert" role="status">
              The owner kept their amounts private. Your copy starts with zero amounts.
            </div>
          )}
          <FormField
            label="Your template name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="public-template-items">
            {items.map((item, index) => (
              <fieldset key={item.key}>
                <legend>
                  {item.itemType === 'income' ? 'Income' : 'Expense'} item {index + 1}
                </legend>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked
                    onChange={() =>
                      setItems((current) => current.filter((entry) => entry.key !== item.key))
                    }
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.categoryName}</small>
                  </span>
                </label>
                <FormField
                  label="Name"
                  value={item.name}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.key === item.key ? { ...entry, name: event.target.value } : entry,
                      ),
                    )
                  }
                />
                <FormField
                  label="Category"
                  value={item.categoryName}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.key === item.key
                          ? { ...entry, categoryName: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <FormField
                  label="Monthly amount"
                  inputMode="decimal"
                  value={item.amount ?? '0.00'}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.key === item.key ? { ...entry, amount: event.target.value } : entry,
                      ),
                    )
                  }
                />
              </fieldset>
            ))}
          </div>
          {error && (
            <div className="inline-alert inline-alert--error" role="alert">
              {error}
            </div>
          )}
          {session ? (
            <Button
              disabled={!items.length || !name.trim()}
              loading={copying}
              onClick={() => void copy()}
            >
              Copy to my templates
            </Button>
          ) : (
            <div className="button-row">
              <Button onClick={() => continueToAuth('/auth/register')}>
                Create account to copy
              </Button>
              <Button variant="secondary" onClick={() => continueToAuth('/auth/sign-in')}>
                Sign in to copy
              </Button>
            </div>
          )}
          <p className="muted">
            No transactions, notes, goals, household members, profile details, or historical months
            are included.
          </p>
        </section>
      ) : null}
    </main>
  );
};
