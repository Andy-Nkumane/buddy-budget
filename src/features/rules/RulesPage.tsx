import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, FlaskConical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';
import {
  deleteCategorisationRule,
  dismissCategorisationSuggestion,
  moveCategorisationRule,
  processCategorisationRules,
  retrieveCategorisationSuggestions,
  searchBudgetTransactions,
  searchCategorisationRules,
  searchCategories,
  searchTemplates,
  upsertCategorisationRule,
  type CategorisationProcessResult,
} from '../../data/repositories/budgetRepository';
import type { CategorisationRule } from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { Modal } from '../../shared/ui/Modal';

const emptyRule = (): Partial<CategorisationRule> => ({
  name: '',
  enabled: true,
  description_match: 'contains',
  description_value: '',
  amount_min_minor: null,
  amount_max_minor: null,
  transaction_type: null,
  date_from: null,
  date_to: null,
  days_of_week: [],
  action_category_id: null,
  action_budget_item_name: null,
  action_description: null,
  action_notes: null,
  action_recurring_candidate: null,
});

const optionalNumber = (value: string): number | null => (value === '' ? null : Number(value));

export const RulesPage = () => {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const queryClient = useQueryClient();
  const rules = useQuery({
    queryKey: queryKeys.categorisationRules(userId),
    queryFn: searchCategorisationRules,
  });
  const suggestions = useQuery({
    queryKey: queryKeys.categorisationSuggestions(userId),
    queryFn: retrieveCategorisationSuggestions,
  });
  const categories = useQuery({
    queryKey: queryKeys.categories(userId),
    queryFn: () => searchCategories(),
  });
  const templates = useQuery({
    queryKey: queryKeys.templates(userId),
    queryFn: searchTemplates,
  });
  const transactions = useQuery({
    queryKey: queryKeys.transactions(userId, 0),
    queryFn: () => searchBudgetTransactions(0),
  });
  const [editing, setEditing] = useState<Partial<CategorisationRule> | null>(null);
  const [preview, setPreview] = useState<CategorisationProcessResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => queryClient.invalidateQueries({ queryKey: ['user', userId] });
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      setMessage(success);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
    }
  };
  const testRules = async () => {
    const ids = (transactions.data?.records ?? []).map((transaction) => transaction.id);
    if (!ids.length) {
      setPreview({ dry_run: true, selected_count: 0, changed_count: 0, changes: [] });
      return;
    }
    await act(
      async () => setPreview(await processCategorisationRules(ids, true)),
      'Dry run complete. Nothing was changed.',
    );
  };
  const applyRules = async () => {
    if (!preview) return;
    const ids = preview.changes.map((change) => change.transaction_id);
    if (!ids.length) return;
    await act(
      async () => {
        const result = await processCategorisationRules(ids, false);
        setPreview(null);
        return result;
      },
      `Rules applied to ${ids.length} transaction${ids.length === 1 ? '' : 's'}.`,
    );
  };

  if (
    rules.isLoading ||
    suggestions.isLoading ||
    categories.isLoading ||
    templates.isLoading ||
    transactions.isLoading
  )
    return <LoadingState label="Loading categorisation rules…" />;
  const queryError =
    rules.error ?? suggestions.error ?? categories.error ?? templates.error ?? transactions.error;
  if (queryError) return <ErrorState message={queryError.message} retry={() => void refresh()} />;

  return (
    <section className="page rules-page">
      <header className="page-heading">
        <div>
          <Link className="back-link" to="/app/settings">
            <ArrowLeft size={17} /> Settings
          </Link>
          <p className="eyebrow">Automation you control</p>
          <h1>Categorisation rules</h1>
          <p>Rules run from top to bottom. The first matching action for each field wins.</p>
        </div>
        <div className="page-heading__actions">
          <Button
            variant="secondary"
            icon={<FlaskConical size={18} />}
            onClick={() => void testRules()}
            loading={busy}
          >
            Test rules
          </Button>
          <Button icon={<Plus size={18} />} onClick={() => setEditing(emptyRule())}>
            New rule
          </Button>
        </div>
      </header>
      {message && (
        <div className="inline-alert" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}

      {(suggestions.data ?? []).length > 0 && (
        <section className="management-card" aria-labelledby="suggestions-heading">
          <header>
            <div>
              <h2 id="suggestions-heading">Suggested rules</h2>
              <p>
                Suggested after at least three identical descriptions were consistently categorised.
                Nothing is created automatically.
              </p>
            </div>
          </header>
          <div className="rule-list">
            {suggestions.data?.map((suggestion) => (
              <article
                className="rule-card"
                key={`${suggestion.transaction_type}-${suggestion.normalized_description}`}
              >
                <div>
                  <strong>{suggestion.normalized_description}</strong>
                  <span>{suggestion.occurrence_count} consistent transactions</span>
                </div>
                <div className="rule-card__actions">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setEditing({
                        ...emptyRule(),
                        name: suggestion.normalized_description,
                        description_value: suggestion.normalized_description,
                        transaction_type: suggestion.transaction_type,
                        action_category_id: suggestion.category_id,
                        action_budget_item_name: suggestion.budget_item_name,
                      })
                    }
                  >
                    Review
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void act(
                        () => dismissCategorisationSuggestion(suggestion),
                        'Suggestion dismissed permanently.',
                      )
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="management-card" aria-labelledby="rules-heading">
        <header>
          <div>
            <h2 id="rules-heading">Your rules</h2>
            <p>Disabled rules remain visible but do not match transactions.</p>
          </div>
        </header>
        {(rules.data ?? []).length ? (
          <ol className="rule-list">
            {rules.data?.map((rule, index) => (
              <li className="rule-card" key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                  <span>
                    {rule.enabled ? 'Enabled' : 'Disabled'} · matched {rule.match_count} times
                  </span>
                  <small>
                    {rule.description_match
                      ? `Description ${rule.description_match} “${rule.description_value}”`
                      : 'Other conditions'}
                    ; winning fields follow list order.
                  </small>
                </div>
                <div className="rule-card__actions">
                  <button
                    className="icon-button"
                    disabled={index === 0 || busy}
                    aria-label={`Move ${rule.name} up`}
                    onClick={() =>
                      void act(() => moveCategorisationRule(rule.id, -1), 'Rule order updated.')
                    }
                  >
                    <ArrowUp />
                  </button>
                  <button
                    className="icon-button"
                    disabled={index === (rules.data?.length ?? 0) - 1 || busy}
                    aria-label={`Move ${rule.name} down`}
                    onClick={() =>
                      void act(() => moveCategorisationRule(rule.id, 1), 'Rule order updated.')
                    }
                  >
                    <ArrowDown />
                  </button>
                  <Button variant="ghost" onClick={() => setEditing(rule)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void act(
                        () => upsertCategorisationRule({ ...rule, enabled: !rule.enabled }),
                        rule.enabled ? 'Rule disabled.' : 'Rule enabled.',
                      )
                    }
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${rule.name}`}
                    onClick={() =>
                      void act(() => deleteCategorisationRule(rule.id), 'Rule deleted.')
                    }
                  >
                    <Trash2 />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-card rule-empty-state">
            <FlaskConical aria-hidden="true" size={30} />
            <h3>No categorisation rules yet</h3>
            <p>Create a rule to categorise repeated transactions automatically.</p>
            <Button
              icon={<Plus aria-hidden="true" size={17} />}
              onClick={() => setEditing(emptyRule())}
            >
              Create your first rule
            </Button>
          </div>
        )}
      </section>

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Edit rule' : 'Create rule'}
        description="Choose at least one condition and one action."
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form
            className="modal-form"
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                await upsertCategorisationRule(editing);
                setEditing(null);
              }, 'Rule saved.');
            }}
          >
            <fieldset>
              <legend>Rule</legend>
              <label className="field">
                <span className="field__label">Name</span>
                <input
                  className="input"
                  required
                  maxLength={80}
                  value={editing.name ?? ''}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={editing.enabled ?? true}
                  onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })}
                />{' '}
                Enabled
              </label>
            </fieldset>
            <fieldset>
              <legend>Conditions</legend>
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Description match</span>
                  <select
                    className="input"
                    value={editing.description_match ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        description_match: (event.target.value ||
                          null) as CategorisationRule['description_match'],
                      })
                    }
                  >
                    <option value="">Any description</option>
                    <option value="contains">Contains</option>
                    <option value="exact">Exact</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Description value</span>
                  <input
                    className="input"
                    disabled={!editing.description_match}
                    value={editing.description_value ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, description_value: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">Type</span>
                  <select
                    className="input"
                    value={editing.transaction_type ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        transaction_type: (event.target.value ||
                          null) as CategorisationRule['transaction_type'],
                      })
                    }
                  >
                    <option value="">Either</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Minimum amount (minor units)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={editing.amount_min_minor ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        amount_min_minor: optionalNumber(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">Maximum amount (minor units)</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={editing.amount_max_minor ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        amount_max_minor: optionalNumber(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">From date</span>
                  <input
                    className="input"
                    type="date"
                    value={editing.date_from ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, date_from: event.target.value || null })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">To date</span>
                  <input
                    className="input"
                    type="date"
                    value={editing.date_to ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, date_to: event.target.value || null })
                    }
                  />
                </label>
              </div>
              <fieldset className="weekday-fieldset">
                <legend>Days of week (optional)</legend>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <label className="checkbox-row" key={day}>
                    <input
                      type="checkbox"
                      checked={(editing.days_of_week ?? []).includes(index)}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          days_of_week: event.target.checked
                            ? [...(editing.days_of_week ?? []), index].sort()
                            : (editing.days_of_week ?? []).filter((value) => value !== index),
                        })
                      }
                    />
                    {day}
                  </label>
                ))}
              </fieldset>
            </fieldset>
            <fieldset>
              <legend>Actions</legend>
              <div className="form-grid">
                <label className="field">
                  <span className="field__label">Category</span>
                  <select
                    className="input"
                    value={editing.action_category_id ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, action_category_id: event.target.value || null })
                    }
                  >
                    <option value="">Do not change</option>
                    {categories.data
                      ?.filter(
                        (category) =>
                          !editing.transaction_type ||
                          category.item_type === editing.transaction_type,
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">Budget item</span>
                  <select
                    className="input"
                    value={editing.action_budget_item_name ?? ''}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        action_budget_item_name: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Match from category or leave unassigned</option>
                    {Array.from(
                      new Set([
                        ...(editing.action_budget_item_name
                          ? [editing.action_budget_item_name]
                          : []),
                        ...(templates.data ?? []).flatMap((template) =>
                          template.template_items
                            .filter(
                              (item) =>
                                item.archived_at === null &&
                                (!editing.transaction_type ||
                                  item.item_type === editing.transaction_type),
                            )
                            .map((item) => item.name),
                        ),
                      ]),
                    )
                      .sort((left, right) => left.localeCompare(right))
                      .map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                  </select>
                  <span className="field__hint">
                    If left blank, Buddy Budget uses the first active month item in the selected
                    category.
                  </span>
                </label>
                <label className="field">
                  <span className="field__label">Cleaned description</span>
                  <input
                    className="input"
                    value={editing.action_description ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, action_description: event.target.value || null })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">Notes</span>
                  <textarea
                    className="input"
                    value={editing.action_notes ?? ''}
                    onChange={(event) =>
                      setEditing({ ...editing, action_notes: event.target.value || null })
                    }
                  />
                </label>
                <label className="field">
                  <span className="field__label">Recurring candidate</span>
                  <select
                    className="input"
                    value={
                      editing.action_recurring_candidate === null
                        ? ''
                        : String(editing.action_recurring_candidate)
                    }
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        action_recurring_candidate:
                          event.target.value === '' ? null : event.target.value === 'true',
                      })
                    }
                  >
                    <option value="">Do not change</option>
                    <option value="true">Mark recurring</option>
                    <option value="false">Clear recurring</option>
                  </select>
                </label>
              </div>
            </fieldset>
            <div className="modal-form__actions">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save rule
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={preview !== null}
        title="Rule dry run"
        description="Review every proposed field change. No transaction has been changed."
        onClose={() => setPreview(null)}
      >
        {preview && (
          <div className="modal-form">
            <p>
              <strong>{preview.changed_count}</strong> of {preview.selected_count} checked
              transactions would change.
            </p>
            {preview.changes.length ? (
              <ul className="rule-preview-list">
                {preview.changes.map((change) => (
                  <li key={change.transaction_id}>
                    <strong>{change.transaction_id}</strong>
                    <span>
                      {Object.keys(change)
                        .filter((key) => !['transaction_id', 'winning_rules'].includes(key))
                        .join(', ')}
                    </span>
                    <small>Winning rules: {change.winning_rules.join(', ')}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No matching changes.</p>
            )}
            <div className="modal-form__actions">
              <Button variant="ghost" onClick={() => setPreview(null)}>
                Close
              </Button>
              <Button
                disabled={!preview.changes.length}
                loading={busy}
                onClick={() => void applyRules()}
              >
                Apply shown changes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
