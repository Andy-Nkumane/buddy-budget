import type { BudgetTransaction, CategorisationRule, ItemType } from '../../shared/types/domain';

export type RuleInput = Pick<
  BudgetTransaction,
  | 'id'
  | 'description'
  | 'amount_minor'
  | 'transaction_type'
  | 'transaction_date'
  | 'category_id'
  | 'budget_month_item_id'
  | 'notes'
  | 'is_recurring_candidate'
>;

export type RuleChange = {
  field:
    'category_id' | 'budget_month_item_id' | 'description' | 'notes' | 'is_recurring_candidate';
  before: string | boolean | null;
  after: string | boolean | null;
  ruleId: string;
  ruleName: string;
};

export type RuleEvaluation = {
  transactionId: string;
  changes: RuleChange[];
  matchedRuleIds: string[];
  conflicts: Array<{ field: RuleChange['field']; winnerRuleId: string; ignoredRuleId: string }>;
};

export const normalizeRuleText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

const matchesRule = (rule: CategorisationRule, transaction: RuleInput): boolean => {
  if (!rule.enabled) return false;
  const description = normalizeRuleText(transaction.description);
  const expected = normalizeRuleText(rule.description_value ?? '');
  if (rule.description_match === 'exact' && description !== expected) return false;
  if (rule.description_match === 'contains' && !description.includes(expected)) return false;
  if (rule.amount_min_minor !== null && transaction.amount_minor < rule.amount_min_minor)
    return false;
  if (rule.amount_max_minor !== null && transaction.amount_minor > rule.amount_max_minor)
    return false;
  if (rule.transaction_type !== null && transaction.transaction_type !== rule.transaction_type)
    return false;
  if (rule.date_from !== null && transaction.transaction_date < rule.date_from) return false;
  if (rule.date_to !== null && transaction.transaction_date > rule.date_to) return false;
  if (
    rule.days_of_week.length > 0 &&
    !rule.days_of_week.includes(new Date(`${transaction.transaction_date}T00:00:00Z`).getUTCDay())
  )
    return false;
  return true;
};

const actionEntries = (
  rule: CategorisationRule,
): Array<[RuleChange['field'], string | boolean]> => {
  const entries: Array<[RuleChange['field'], string | boolean]> = [];
  if (rule.action_category_id !== null) entries.push(['category_id', rule.action_category_id]);
  if (rule.action_budget_item_name !== null)
    entries.push(['budget_month_item_id', rule.action_budget_item_name]);
  if (rule.action_description !== null) entries.push(['description', rule.action_description]);
  if (rule.action_notes !== null) entries.push(['notes', rule.action_notes]);
  if (rule.action_recurring_candidate !== null)
    entries.push(['is_recurring_candidate', rule.action_recurring_candidate]);
  return entries;
};

export const evaluateCategorisationRules = (
  transaction: RuleInput,
  rules: CategorisationRule[],
): RuleEvaluation => {
  const ordered = [...rules].sort(
    (left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id),
  );
  const winners = new Map<RuleChange['field'], CategorisationRule>();
  const changes: RuleChange[] = [];
  const matchedRuleIds: string[] = [];
  const conflicts: RuleEvaluation['conflicts'] = [];
  for (const rule of ordered) {
    if (!matchesRule(rule, transaction)) continue;
    matchedRuleIds.push(rule.id);
    for (const [field, after] of actionEntries(rule)) {
      const winner = winners.get(field);
      if (winner) {
        conflicts.push({ field, winnerRuleId: winner.id, ignoredRuleId: rule.id });
        continue;
      }
      winners.set(field, rule);
      const before = transaction[field];
      if (before !== after)
        changes.push({ field, before, after, ruleId: rule.id, ruleName: rule.name });
    }
  }
  return { transactionId: transaction.id, changes, matchedRuleIds, conflicts };
};

export const createRuleDraft = (transactionType: ItemType): Partial<CategorisationRule> => ({
  transaction_type: transactionType,
  enabled: true,
  days_of_week: [],
});
