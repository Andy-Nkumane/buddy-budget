import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowDown, ArrowUp, Check, Pencil, Plus, X } from 'lucide-react';
import { useState } from 'react';
import {
  createCategory,
  searchCategories,
  updateCategory,
} from '../../data/repositories/budgetRepository';
import type { Category, ItemType } from '../../shared/types/domain';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { Modal } from '../../shared/ui/Modal';

const CategoryRow = ({ category, refresh }: { category: Category; refresh: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const save = async () => {
    if (!name.trim()) return;
    await updateCategory(category.id, { name: name.trim() });
    setEditing(false);
    refresh();
  };
  return (
    <div className="category-row">
      <span className={`category-swatch category-swatch--${category.item_type}`} />
      {editing ? (
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      ) : (
        <strong>{category.name}</strong>
      )}
      <div className="category-row__actions">
        {editing ? (
          <>
            <button className="icon-button" aria-label="Save category" onClick={() => void save()}>
              <Check size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Cancel edit"
              onClick={() => setEditing(false)}
            >
              <X size={17} />
            </button>
          </>
        ) : (
          <button
            className="icon-button"
            aria-label={`Rename ${category.name}`}
            onClick={() => setEditing(true)}
          >
            <Pencil size={17} />
          </button>
        )}
        <button
          className="icon-button"
          aria-label={`Move ${category.name} up`}
          onClick={() =>
            void updateCategory(category.id, {
              sort_order: Math.max(0, category.sort_order - 1),
            }).then(refresh)
          }
        >
          <ArrowUp size={17} />
        </button>
        <button
          className="icon-button"
          aria-label={`Move ${category.name} down`}
          onClick={() =>
            void updateCategory(category.id, { sort_order: category.sort_order + 1 }).then(refresh)
          }
        >
          <ArrowDown size={17} />
        </button>
        <button
          className="icon-button"
          aria-label={`Archive ${category.name}`}
          onClick={() => {
            if (!window.confirm(`Archive ${category.name}? Existing month snapshots stay intact.`))
              return;
            void updateCategory(category.id, { archived_at: new Date().toISOString() }).then(
              refresh,
            );
          }}
        >
          <Archive size={17} />
        </button>
      </div>
    </div>
  );
};

export const CategoriesPage = () => {
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => searchCategories() });
  const [addType, setAddType] = useState<ItemType | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['categories'] });
  const add = async () => {
    if (!name.trim() || !addType) {
      setError('Enter a category name.');
      return;
    }
    try {
      await createCategory({ name: name.trim(), itemType: addType });
      setName('');
      setAddType(null);
      setError(null);
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add category.');
    }
  };
  if (categories.isLoading) return <LoadingState label="Loading categories…" />;
  if (categories.error) return <ErrorState message={categories.error.message} retry={refresh} />;
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Stay organised</p>
          <h1>Categories</h1>
          <p>Categories group items without changing whether they are income or expenses.</p>
        </div>
      </div>
      <div className="two-column-cards">
        {(['income', 'expense'] as const).map((type) => (
          <section className="management-card" key={type}>
            <header>
              <div>
                <h2>{type === 'income' ? 'Income categories' : 'Expense categories'}</h2>
                <p>
                  {categories.data?.filter((category) => category.item_type === type).length} active
                </p>
              </div>
              <Button
                variant="secondary"
                icon={<Plus size={17} />}
                onClick={() => setAddType(type)}
              >
                Add
              </Button>
            </header>
            <div>
              {categories.data
                ?.filter((category) => category.item_type === type)
                .map((category) => (
                  <CategoryRow category={category} key={category.id} refresh={refresh} />
                ))}
              {!categories.data?.some((category) => category.item_type === type) && (
                <p className="empty-row">No categories yet.</p>
              )}
            </div>
          </section>
        ))}
      </div>
      <Modal
        open={addType !== null}
        title={`Add ${addType ?? ''} category`}
        onClose={() => setAddType(null)}
      >
        <div className="modal-form">
          <FormField
            label="Category name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          {error && <div className="inline-alert inline-alert--error">{error}</div>}
          <Button onClick={() => void add()}>Add category</Button>
        </div>
      </Modal>
    </section>
  );
};
