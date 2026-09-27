import { describe, expect, it } from 'vitest';
import { buildWeeklyCheckInSummary, isWeeklyDeliveryDue } from './checkin';

describe('weekly check-ins', () => {
  it('selects the same highest-priority action for the same data', () => {
    const source = {
      position: {
        plannedIncomeMinor: 100_000,
        plannedExpenseMinor: 80_000,
        actualIncomeMinor: 100_000,
        actualExpenseMinor: 70_000,
      },
      expenseItems: [{ name: 'Food', plannedMinor: 10_000, actualMinor: 11_000 }],
      uncategorisedCount: 2,
      upcomingObligations: [],
      goals: [],
    };
    expect(buildWeeklyCheckInSummary(source).recommendation.actionPath).toBe('/app/transactions');
    expect(buildWeeklyCheckInSummary(source)).toEqual(buildWeeklyCheckInSummary(source));
  });

  it('classifies approaching and exceeded items with integer arithmetic', () => {
    const summary = buildWeeklyCheckInSummary({
      position: {
        plannedIncomeMinor: 0,
        plannedExpenseMinor: 0,
        actualIncomeMinor: 0,
        actualExpenseMinor: 0,
      },
      expenseItems: [
        { name: 'Approaching', plannedMinor: 10_000, actualMinor: 8_000 },
        { name: 'Exceeded', plannedMinor: 10_000, actualMinor: 10_001 },
        { name: 'Zero', plannedMinor: 0, actualMinor: 0 },
      ],
      uncategorisedCount: 0,
      upcomingObligations: [],
      goals: [],
    });
    expect(summary.approachingItems.map((item) => item.name)).toEqual(['Approaching']);
    expect(summary.exceededItems.map((item) => item.name)).toEqual(['Exceeded']);
  });

  it('evaluates a local delivery window across timezones', () => {
    const now = new Date('2026-09-28T16:05:00Z');
    expect(
      isWeeklyDeliveryDue({
        now,
        timezone: 'Africa/Johannesburg',
        weekday: 1,
        deliveryTime: '18:00',
      }),
    ).toBe(true);
    expect(
      isWeeklyDeliveryDue({ now, timezone: 'America/New_York', weekday: 1, deliveryTime: '18:00' }),
    ).toBe(false);
  });
});
