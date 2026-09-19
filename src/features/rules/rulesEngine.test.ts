import { describe, expect, it } from 'vitest';
import type { CategorisationRule } from '../../shared/types/domain';
import { evaluateCategorisationRules, normalizeRuleText, type RuleInput } from './rulesEngine';

const transaction = {
  id: 'transaction',
  description: '  Corner   SHOP ',
  amount_minor: 1250,
  transaction_type: 'expense',
  transaction_date: '2026-09-18',
  category_id: null,
  budget_month_item_id: null,
  notes: null,
  is_recurring_candidate: false,
} satisfies RuleInput;

const rule = (overrides: Partial<CategorisationRule> = {}): CategorisationRule => ({
  id: 'rule-a',
  user_id: 'user',
  name: 'Shop',
  sort_order: 0,
  enabled: true,
  description_match: 'contains',
  description_value: 'corner shop',
  amount_min_minor: 1000,
  amount_max_minor: 2000,
  transaction_type: 'expense',
  date_from: null,
  date_to: null,
  days_of_week: [],
  action_category_id: 'category-a',
  action_budget_item_name: null,
  action_description: null,
  action_notes: null,
  action_recurring_candidate: null,
  match_count: 0,
  last_matched_at: null,
  created_at: '',
  updated_at: '',
  ...overrides,
});

describe('categorisation rules', () => {
  it('normalizes whitespace and casing deterministically', () => {
    expect(normalizeRuleText('  CORNER   Shop ')).toBe('corner shop');
  });

  it('combines conditions and applies matching actions', () => {
    expect(evaluateCategorisationRules(transaction, [rule()]).changes).toMatchObject([
      { field: 'category_id', after: 'category-a', ruleId: 'rule-a' },
    ]);
  });

  it('uses ascending order then id and explains conflicts', () => {
    const result = evaluateCategorisationRules(transaction, [
      rule({ id: 'later', sort_order: 2, action_category_id: 'category-b' }),
      rule({ id: 'winner', sort_order: 1 }),
    ]);
    expect(result.changes[0]).toMatchObject({ after: 'category-a', ruleId: 'winner' });
    expect(result.conflicts).toEqual([
      { field: 'category_id', winnerRuleId: 'winner', ignoredRuleId: 'later' },
    ]);
  });

  it('is idempotent when the winning value is already present', () => {
    expect(
      evaluateCategorisationRules({ ...transaction, category_id: 'category-a' }, [rule()]).changes,
    ).toEqual([]);
  });

  it('supports exact, amount, type, date, and weekday mismatches', () => {
    expect(
      evaluateCategorisationRules(transaction, [
        rule({ description_match: 'exact', description_value: 'another shop' }),
      ]).changes,
    ).toHaveLength(0);
    expect(
      evaluateCategorisationRules(transaction, [rule({ amount_min_minor: 1300 })]).changes,
    ).toHaveLength(0);
    expect(
      evaluateCategorisationRules(transaction, [rule({ transaction_type: 'income' })]).changes,
    ).toHaveLength(0);
    expect(
      evaluateCategorisationRules(transaction, [rule({ date_from: '2026-09-19' })]).changes,
    ).toHaveLength(0);
    expect(
      evaluateCategorisationRules(transaction, [rule({ days_of_week: [1] })]).changes,
    ).toHaveLength(0);
  });
});
