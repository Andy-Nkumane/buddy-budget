import { describe, expect, it } from 'vitest';
import {
  canRestoreBudgetItem,
  formatBudgetItemRestoreCountdown,
  getBudgetItemRestoreDeadline,
} from './removedBudgetItems';

describe('removed budget item restore window', () => {
  const archivedAt = '2026-10-31T08:00:00.000Z';

  it('keeps an item restorable for exactly 24 hours', () => {
    expect(getBudgetItemRestoreDeadline(archivedAt)).toBe(
      new Date('2026-11-01T08:00:00.000Z').getTime(),
    );
    expect(canRestoreBudgetItem(archivedAt, new Date('2026-11-01T07:59:59.999Z').getTime())).toBe(
      true,
    );
    expect(canRestoreBudgetItem(archivedAt, new Date('2026-11-01T08:00:00.000Z').getTime())).toBe(
      false,
    );
  });

  it('shows a concise countdown without reaching zero early', () => {
    expect(
      formatBudgetItemRestoreCountdown(archivedAt, new Date('2026-10-31T08:30:30.000Z').getTime()),
    ).toBe('23h 30m remaining');
    expect(
      formatBudgetItemRestoreCountdown(archivedAt, new Date('2026-11-01T07:59:30.000Z').getTime()),
    ).toBe('1m remaining');
  });
});
