import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowDown, ArrowUp, Check, Pencil, Plus, Star } from 'lucide-react';
import { useState } from 'react';
import {
  createTemplate,
  createTemplateItem,
  retrieveProfile,
  searchCategories,
  searchTemplates,
  setDefaultTemplate,
  updateTemplateItem,
} from '../../data/repositories/budgetRepository';
import type { ItemType, TemplateWithItems } from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { Modal } from '../../shared/ui/Modal';
import { parseMoney, toDatabaseMoney } from '../../shared/validation/schemas';

const TemplateItemRow = ({
  item,
  currency,
  onChanged,
}: {
  item: TemplateWithItems['template_items'][number];
  currency: string;
  onChanged: () => void;
}) => {
  const [amount, setAmount] = useState(item.default_amount);
  const [name, setName] = useState(item.name);
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (amount === item.default_amount) return;
    const parsed = parseMoney(amount);
    if (parsed === null) {
      setError('Enter a valid amount.');
      return;
    }
    try {
      await updateTemplateItem(item.id, { default_amount: toDatabaseMoney(parsed) });
      setError(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.');
    }
  };
  const saveName = async () => {
    if (!name.trim()) {
      setError('Enter an item name.');
      return;
    }
    try {
      await updateTemplateItem(item.id, { name: name.trim() });
      setRenaming(false);
      setError(null);
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rename failed.');
    }
  };
  const archive = () => {
    if (!window.confirm(`Archive ${item.name}? It will remain in existing months.`)) return;
    void updateTemplateItem(item.id, { archived_at: new Date().toISOString() }).then(onChanged);
  };
  return (
    <div className="template-item">
      <div>
        <span className={`item-dot item-dot--${item.item_type}`} />
        {renaming ? (
          <input
            aria-label="Template item name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        ) : (
          <strong>{item.name}</strong>
        )}
        <small>{item.item_type}</small>
      </div>
      <label className="compact-money">
        <span>{currency}</span>
        <input
          aria-label={`${item.name} default amount`}
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={() => void save()}
        />
      </label>
      <div className="reorder-buttons">
        <button
          className="icon-button"
          aria-label={renaming ? `Save ${item.name}` : `Rename ${item.name}`}
          onClick={() => (renaming ? void saveName() : setRenaming(true))}
        >
          {renaming ? <Check size={16} /> : <Pencil size={16} />}
        </button>
        <button
          className="icon-button"
          aria-label={`Move ${item.name} up`}
          onClick={() =>
            void updateTemplateItem(item.id, { sort_order: Math.max(0, item.sort_order - 1) }).then(
              onChanged,
            )
          }
        >
          <ArrowUp size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={`Move ${item.name} down`}
          onClick={() =>
            void updateTemplateItem(item.id, { sort_order: item.sort_order + 1 }).then(onChanged)
          }
        >
          <ArrowDown size={16} />
        </button>
        <button className="icon-button" aria-label={`Archive ${item.name}`} onClick={archive}>
          <Archive size={16} />
        </button>
      </div>
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};

export const TemplatesPage = () => {
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ['templates'], queryFn: searchTemplates });
  const profile = useQuery({ queryKey: ['profile'], queryFn: retrieveProfile });
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => searchCategories() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [addType, setAddType] = useState<ItemType | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('0.00');
  const [categoryId, setCategoryId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['templates'] });
    void queryClient.invalidateQueries({ queryKey: ['default-template'] });
  };
  const selected =
    templates.data?.find((template) => template.id === selectedId) ?? templates.data?.[0];

  const createMutation = useMutation({
    mutationFn: () => createTemplate(newTemplateName.trim(), !templates.data?.length),
    onSuccess: (template) => {
      setCreateOpen(false);
      setNewTemplateName('');
      setSelectedId(template.id);
      refresh();
    },
  });

  const addItem = async () => {
    if (!selected || !itemName.trim() || parseMoney(itemAmount) === null || !addType) {
      setFormError('Enter a name and a valid amount.');
      return;
    }
    try {
      await createTemplateItem({
        templateId: selected.id,
        name: itemName.trim(),
        itemType: addType,
        amount: toDatabaseMoney(itemAmount),
        categoryId: categoryId || null,
      });
      setAddType(null);
      setItemName('');
      setItemAmount('0.00');
      setCategoryId('');
      setFormError(null);
      refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add the item.');
    }
  };

  if (templates.isLoading || categories.isLoading || profile.isLoading)
    return <LoadingState label="Loading templates…" />;
  if (templates.error || categories.error || profile.error)
    return (
      <ErrorState
        message={
          (templates.error ?? categories.error ?? profile.error)?.message ??
          'Templates are unavailable.'
        }
        retry={refresh}
      />
    );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Plan once</p>
          <h1>Budget templates</h1>
          <p>Changes here apply only to months you create later. Existing months never change.</p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
          New template
        </Button>
      </div>
      <div className="notice-card">
        <Check aria-hidden="true" />
        <div>
          <strong>Historical budgets are protected</strong>
          <p>Editing amounts, names, or categories below will not rewrite any existing month.</p>
        </div>
      </div>
      {!templates.data?.length ? (
        <div className="empty-card">
          <h2>Create your recurring plan</h2>
          <p>Add income and expenses you expect most months.</p>
          <Button onClick={() => setCreateOpen(true)}>Create a template</Button>
        </div>
      ) : (
        <div className="templates-layout">
          <aside className="template-tabs" aria-label="Your templates">
            {templates.data.map((template) => (
              <button
                className={template.id === selected?.id ? 'active' : ''}
                key={template.id}
                onClick={() => setSelectedId(template.id)}
              >
                <span>{template.name}</span>
                {template.is_default && (
                  <small>
                    <Star size={13} /> Default
                  </small>
                )}
              </button>
            ))}
          </aside>
          {selected && (
            <div className="template-editor">
              <header>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.template_items.length} recurring items</p>
                </div>
                {!selected.is_default && (
                  <Button
                    variant="secondary"
                    icon={<Star size={17} />}
                    onClick={() => void setDefaultTemplate(selected.id).then(refresh)}
                  >
                    Make default
                  </Button>
                )}
              </header>
              {(['income', 'expense'] as const).map((type) => (
                <section key={type} className="template-group">
                  <div className="template-group__heading">
                    <h3>{type === 'income' ? 'Income' : 'Expenses'}</h3>
                    <button className="text-button" onClick={() => setAddType(type)}>
                      <Plus size={16} /> Add
                    </button>
                  </div>
                  {selected.template_items
                    .filter((item) => item.item_type === type)
                    .map((item) => (
                      <TemplateItemRow
                        currency={profile.data?.currency_code ?? 'ZAR'}
                        item={item}
                        key={item.id}
                        onChanged={refresh}
                      />
                    ))}
                  {!selected.template_items.some((item) => item.item_type === type) && (
                    <p className="muted">No {type} items yet.</p>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      )}
      <Modal open={createOpen} title="Create a template" onClose={() => setCreateOpen(false)}>
        <div className="modal-form">
          <FormField
            label="Template name"
            autoFocus
            value={newTemplateName}
            onChange={(event) => setNewTemplateName(event.target.value)}
          />
          {createMutation.error && (
            <div className="inline-alert inline-alert--error">{createMutation.error.message}</div>
          )}
          <Button
            disabled={!newTemplateName.trim()}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create template
          </Button>
        </div>
      </Modal>
      <Modal
        open={addType !== null}
        title={`Add recurring ${addType ?? 'item'}`}
        onClose={() => setAddType(null)}
      >
        <div className="modal-form">
          <FormField
            label="Name"
            autoFocus
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
          />
          <FormField
            label="Default amount"
            inputMode="decimal"
            value={itemAmount}
            onChange={(event) => setItemAmount(event.target.value)}
          />
          <label className="field">
            <span className="field__label">Category</span>
            <select
              className="input"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">No category</option>
              {categories.data
                ?.filter((category) => category.item_type === addType)
                .map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          {formError && <div className="inline-alert inline-alert--error">{formError}</div>}
          <Button onClick={() => void addItem()}>Add to template</Button>
        </div>
      </Modal>
    </section>
  );
};
