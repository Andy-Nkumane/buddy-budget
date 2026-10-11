import { assert, assertEquals, assertMatch } from 'jsr:@std/assert';
import { createShareToken, sanitizeSharedReportSnapshot, sha256Hex } from './sharedReport.ts';

Deno.test('share tokens provide 256 bits and hash deterministically', async () => {
  const token = createShareToken();
  assertMatch(token, /^[A-Za-z0-9_-]{43}$/);
  assertEquals((await sha256Hex(token)).length, 64);
  assert((await sha256Hex(token)) === (await sha256Hex(token)));
});

Deno.test('snapshot sanitizer strips fields outside the approved scope', () => {
  const snapshot = sanitizeSharedReportSnapshot({
    version: 1,
    title: 'Report',
    rangeLabel: 'October 2026',
    snapshotAt: '2026-10-10T10:00:00.000Z',
    locale: 'en-ZA',
    selection: {
      totals: true,
      categories: false,
      transactions: false,
      transactionNames: false,
      notes: false,
      goals: false,
    },
    omitted: ['transaction details'],
    ownerId: 'must-not-survive',
    months: [
      {
        monthStart: '2026-10-01',
        currencyCode: 'ZAR',
        privateNotes: 'must-not-survive',
        totals: {
          plannedIncomeMinor: 100,
          plannedExpenseMinor: 50,
          actualIncomeMinor: 100,
          actualExpenseMinor: 40,
          remainingMinor: 60,
        },
      },
    ],
  }) as Record<string, unknown>;
  assertEquals('ownerId' in snapshot, false);
  assertEquals('privateNotes' in (snapshot.months as Record<string, unknown>[])[0], false);
});
