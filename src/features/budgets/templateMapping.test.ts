import { describe, expect, it } from 'vitest';
import type { Category, TemplateItem } from '../../shared/types/domain';
import { mapTemplateItemsToMonthDrafts } from './templateMapping';

const timestamp = '2026-01-01T00:00:00Z';
const category: Category = {
  id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  item_type: 'expense',
  name: 'Housing',
  sort_order: 0,
  archived_at: null,
  created_at: timestamp,
  updated_at: timestamp,
};
const templateItem: TemplateItem = {
  id: crypto.randomUUID(),
  template_id: crypto.randomUUID(),
  user_id: category.user_id,
  category_id: category.id,
  item_type: 'expense',
  name: 'Rent',
  default_amount: '9000.00',
  sort_order: 0,
  archived_at: null,
  created_at: timestamp,
  updated_at: timestamp,
};

describe('template-to-month mapping', () => {
  it('copies values into independent snapshot fields', () => {
    const [snapshot] = mapTemplateItemsToMonthDrafts([templateItem], [category]);
    expect(snapshot).toMatchObject({
      name_snapshot: 'Rent',
      category_snapshot: 'Housing',
      amount: '9000.00',
      default_amount_snapshot: '9000.00',
    });
    const changedTemplate = { ...templateItem, name: 'New rent', default_amount: '9500.00' };
    expect(snapshot.name_snapshot).toBe('Rent');
    expect(mapTemplateItemsToMonthDrafts([changedTemplate], [category])[0].name_snapshot).toBe(
      'New rent',
    );
  });

  it('excludes archived template items', () => {
    expect(
      mapTemplateItemsToMonthDrafts([{ ...templateItem, archived_at: timestamp }], [category]),
    ).toEqual([]);
  });
});
