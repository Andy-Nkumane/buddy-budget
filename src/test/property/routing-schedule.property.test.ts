import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { resolvePagesRoute } from '../../app/routing/pagesRoute';
import { generateOccurrenceDates, isOccurrenceDate } from '../../features/schedules/cashFlow';
import type { ScheduleRecurrence } from '../../shared/types/domain';

const seed = 13_040_001;
const routePart = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'), {
    minLength: 1,
    maxLength: 20,
  })
  .map((characters) => characters.join(''));
const dateFromOffset = (offset: number) => {
  const date = new Date(Date.UTC(2026, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
};

describe('route and schedule properties', () => {
  it('restores encoded Pages routes without losing query values or fragments', () => {
    fc.assert(
      fc.property(
        fc.array(routePart, { minLength: 1, maxLength: 5 }),
        fc.array(fc.tuple(routePart, routePart), { maxLength: 5 }),
        fc.option(routePart, { nil: '' }),
        fc.integer({ min: 0, max: 3 }),
        (segments, query, fragment, leadingSlashes) => {
          const route = segments.join('/');
          const queryText = query
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
          const fallbackSearch = `?/${'/'.repeat(leadingSlashes)}${route}${
            queryText ? `&${queryText.replace(/&/g, '~and~')}` : ''
          }`;
          const hash = fragment ? `#${encodeURIComponent(fragment)}` : '';
          const expected = `/buddy-budget/${route}${queryText ? `?${queryText}` : ''}${hash}`;
          expect(resolvePagesRoute(fallbackSearch, hash, '/buddy-budget/')).toBe(expected);
        },
      ),
      { seed, numRuns: 150 },
    );
  });

  it('generates only sorted, unique dates that satisfy the recurrence', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 90 }),
        fc.constantFrom<ScheduleRecurrence>('once', 'weekly', 'fortnightly', 'monthly'),
        (startOffset, duration, recurrence) => {
          const startDate = dateFromOffset(startOffset);
          const endDate = dateFromOffset(startOffset + duration);
          const dates = generateOccurrenceDates({ startDate, endDate, recurrence });
          expect(dates).toEqual([...new Set(dates)].sort());
          expect(dates.every((date) => date >= startDate && date <= endDate)).toBe(true);
          expect(dates.every((date) => isOccurrenceDate(date, startDate, recurrence))).toBe(true);
        },
      ),
      { seed: seed + 1, numRuns: 150 },
    );
  });
});
