import type { Category, TemplateItem } from '../../shared/types/domain';

export const mapTemplateItemsToMonthDrafts = (items: TemplateItem[], categories: Category[]) =>
  items
    .filter((item) => item.archived_at === null)
    .map((item) => {
      const category = categories.find((candidate) => candidate.id === item.category_id);
      return {
        source_template_item_id: item.id,
        category_id: item.category_id,
        item_type: item.item_type,
        name_snapshot: item.name,
        category_snapshot: category?.name ?? null,
        default_amount_snapshot: item.default_amount,
        amount: item.default_amount,
        sort_order: item.sort_order,
      };
    });
