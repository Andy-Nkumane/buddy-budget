import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { createMonthItem, createTemplateItem } from '../../data/repositories/budgetRepository';
import type { Category, ItemType, TemplateWithItems } from '../../shared/types/domain';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { itemSchema, toDatabaseMoney } from '../../shared/validation/schemas';

type ItemValues = z.infer<typeof itemSchema>;

interface AddMonthItemFormProps {
  monthId: string;
  itemType: ItemType;
  categories: Category[];
  defaultTemplate: TemplateWithItems | null;
  onComplete: () => void;
}

export const AddMonthItemForm = ({
  monthId,
  itemType,
  categories,
  defaultTemplate,
  onComplete,
}: AddMonthItemFormProps) => {
  const [addToTemplate, setAddToTemplate] = useState(false);
  const [monthItemCreated, setMonthItemCreated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ItemValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', amount: '0.00', itemType, categoryId: null },
  });

  const submit = async (values: ItemValues) => {
    setSubmitError(null);
    let createdThisAttempt = false;
    try {
      const amount = toDatabaseMoney(values.amount);
      if (!monthItemCreated) {
        await createMonthItem({
          monthId,
          name: values.name,
          itemType,
          amount,
          categoryId: values.categoryId,
        });
        createdThisAttempt = true;
        setMonthItemCreated(true);
      }
      if (addToTemplate && defaultTemplate) {
        await createTemplateItem({
          templateId: defaultTemplate.id,
          name: values.name,
          itemType,
          amount,
          categoryId: values.categoryId,
        });
      }
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The item could not be added.';
      setSubmitError(
        monthItemCreated || createdThisAttempt
          ? `The item is in this month, but the template update failed: ${message}`
          : message,
      );
    }
  };

  return (
    <form className="modal-form" onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
      <input type="hidden" {...register('itemType')} />
      <FormField
        label="Name"
        autoFocus
        placeholder={itemType === 'income' ? 'e.g. Freelance' : 'e.g. Vet bill'}
        error={formState.errors.name?.message}
        {...register('name')}
      />
      <FormField
        label="Amount"
        inputMode="decimal"
        error={formState.errors.amount?.message}
        {...register('amount')}
      />
      <label className="field">
        <span className="field__label">Category</span>
        <select
          className="input"
          {...register('categoryId', {
            setValueAs: (value: unknown) => (typeof value === 'string' && value ? value : null),
          })}
        >
          <option value="">No category</option>
          {categories
            .filter((category) => category.item_type === itemType)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </select>
      </label>
      {defaultTemplate && (
        <label className="check-row">
          <input
            type="checkbox"
            checked={addToTemplate}
            onChange={(event) => setAddToTemplate(event.target.checked)}
          />
          <span>
            <strong>Add to {defaultTemplate.name}</strong>
            <small>Include this item in future months too.</small>
          </span>
        </label>
      )}
      {submitError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {submitError}
        </div>
      )}
      <Button className="button--wide" loading={formState.isSubmitting} type="submit">
        {monthItemCreated ? 'Retry template update' : `Add ${itemType}`}
      </Button>
    </form>
  );
};
