import { useQuery } from '@tanstack/react-query';
import { Check, Library } from 'lucide-react';
import { useMemo, useState } from 'react';
import { queryKeys } from '../../data/queryKeys';
import { retrieveStarterTemplates } from '../../data/repositories/budgetRepository';
import type { StarterTemplate } from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { formatMoney } from '../../shared/formatting/money';
import { parseMoney, toDatabaseMoney } from '../../shared/validation/schemas';

export type StarterTemplateSelection = {
  id: string;
  version: number;
  templateName: string;
  copyKey: string;
  items: Array<{
    itemKey: string;
    itemType: 'income' | 'expense';
    name: string;
    categoryName: string;
    amount: string;
  }>;
};

type DraftItem = StarterTemplate['items'][number] & { included: boolean; amount: string };

const createDraftItems = (template: StarterTemplate): DraftItem[] =>
  template.items.map((item) => ({
    ...item,
    included: true,
    amount: String(item.default_amount),
  }));

const createCopyKey = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const StarterTemplatePicker = ({
  currency,
  locale,
  submitLabel,
  submitting = false,
  onSubmit,
}: {
  currency: string;
  locale: string;
  submitLabel: string;
  submitting?: boolean;
  onSubmit: (selection: StarterTemplateSelection) => void;
}) => {
  const templates = useQuery({
    queryKey: queryKeys.starterTemplates(),
    queryFn: retrieveStarterTemplates,
    staleTime: 60 * 60 * 1000,
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [copyKey, setCopyKey] = useState(createCopyKey);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => {
    const available = templates.data ?? [];
    return (
      available.find((template) => `${template.id}:${template.version}` === selectedKey) ??
      available[0]
    );
  }, [selectedKey, templates.data]);
  const visibleItems = draftItems.length ? draftItems : selected ? createDraftItems(selected) : [];

  const choose = (template: StarterTemplate) => {
    setSelectedKey(`${template.id}:${template.version}`);
    setTemplateName(template.template_name);
    setDraftItems(createDraftItems(template));
    setCopyKey(createCopyKey());
    setError(null);
  };

  const submit = () => {
    if (!selected) return;
    const included = visibleItems.filter((item) => item.included);
    const selectedName = (templateName || selected.template_name).trim();
    if (!selectedName || !included.length) {
      setError('Name the template and include at least one item.');
      return;
    }
    if (included.some((item) => parseMoney(item.amount) === null)) {
      setError('Enter a valid non-negative amount for every included item.');
      return;
    }
    setError(null);
    onSubmit({
      id: selected.id,
      version: selected.version,
      templateName: selectedName,
      copyKey,
      items: included.map((item) => ({
        itemKey: item.item_key,
        itemType: item.item_type,
        name: item.name,
        categoryName: item.category_name,
        amount: toDatabaseMoney(item.amount),
      })),
    });
  };

  if (templates.isLoading) return <LoadingState label="Loading starter templates…" />;
  if (templates.error)
    return <ErrorState message={templates.error.message} retry={() => void templates.refetch()} />;
  if (!selected) return <p className="muted">No starter templates are currently available.</p>;

  return (
    <div className="starter-library">
      <div className="starter-library__intro">
        <Library aria-hidden="true" />
        <p>
          Choose a structure, then include only what fits. Suggested amounts start at zero and are
          not financial advice.
        </p>
      </div>
      <fieldset className="starter-library__choices">
        <legend>Choose a starting point</legend>
        {(templates.data ?? []).map((template) => {
          const active = template.id === selected.id && template.version === selected.version;
          return (
            <label
              className={active ? 'starter-choice starter-choice--active' : 'starter-choice'}
              key={`${template.id}:${template.version}`}
            >
              <input
                checked={active}
                name="starter-template"
                onChange={() => choose(template)}
                type="radio"
              />
              <span>
                <strong>{template.name}</strong>
                <small>{template.audience}</small>
              </span>
              {active && <Check aria-hidden="true" size={18} />}
            </label>
          );
        })}
      </fieldset>
      <section className="starter-preview" aria-labelledby="starter-preview-title">
        <header>
          <div>
            <h3 id="starter-preview-title">{selected.name} preview</h3>
            <p>{selected.description}</p>
          </div>
          <small>Version {selected.version}</small>
        </header>
        <FormField
          label="Your template name"
          maxLength={80}
          value={templateName || selected.template_name}
          onChange={(event) => setTemplateName(event.target.value)}
        />
        <fieldset className="starter-items">
          <legend>Include items and set monthly amounts</legend>
          {visibleItems.map((item, index) => (
            <div className="starter-item" key={item.item_key}>
              <label className="starter-item__include">
                <input
                  checked={item.included}
                  onChange={(event) =>
                    setDraftItems((current) =>
                      (current.length ? current : visibleItems).map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, included: event.target.checked } : entry,
                      ),
                    )
                  }
                  type="checkbox"
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.category_name} · {item.item_type}
                  </small>
                </span>
              </label>
              <label className="compact-money">
                <span>{currency}</span>
                <input
                  aria-label={`${item.name} monthly amount`}
                  disabled={!item.included}
                  inputMode="decimal"
                  value={item.amount}
                  onChange={(event) =>
                    setDraftItems((current) =>
                      (current.length ? current : visibleItems).map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, amount: event.target.value } : entry,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </fieldset>
        <p className="starter-preview__total">
          Included planned total{' '}
          <strong>
            {formatMoney(
              visibleItems
                .filter((item) => item.included)
                .reduce((sum, item) => sum + (parseMoney(item.amount) ?? 0), 0),
              currency,
              locale,
            )}
          </strong>
        </p>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <Button loading={submitting} onClick={submit}>
          {submitLabel}
        </Button>
      </section>
    </div>
  );
};
