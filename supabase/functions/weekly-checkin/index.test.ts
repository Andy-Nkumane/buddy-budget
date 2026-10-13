import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import type { WeeklyCheckInSummary } from '../_shared/checkin.ts';
import { createEmail, isDispatchAuthorized } from './index.ts';

const summary: WeeklyCheckInSummary = {
  currencyCode: 'ZAR',
  locale: 'en-ZA',
  position: {
    plannedIncomeMinor: 100_000,
    plannedExpenseMinor: 80_000,
    actualIncomeMinor: 90_000,
    actualExpenseMinor: 70_000,
    plannedRemainingMinor: 20_000,
    actualRemainingMinor: 20_000,
  },
  approachingItems: [],
  exceededItems: [],
  uncategorisedCount: 0,
  upcomingObligations: [],
  goals: [],
  recommendation: {
    title: 'Keep your plan current',
    body: 'Review this week’s activity and keep going.',
    actionPath: '/app/budget/current',
  },
};

Deno.test('dispatch authorization requires the exact server secret', () => {
  assert(isDispatchAuthorized('Bearer server-secret', 'server-secret'));
  assertEquals(isDispatchAuthorized('Bearer browser-token', 'server-secret'), false);
  assertEquals(isDispatchAuthorized(null, 'server-secret'), false);
  assertEquals(isDispatchAuthorized('Bearer ', ''), false);
});

Deno.test('privacy-minimized email omits financial values by default', () => {
  const message = createEmail(
    summary,
    false,
    'https://example.test/app/budget/current',
    'user@example.test',
  ).Messages[0];
  assertStringIncludes(message.HTMLPart, 'Open Buddy Budget');
  assertEquals(message.HTMLPart.includes('1 000'), false);
  assertEquals(message.HTMLPart.includes('700'), false);
});

Deno.test('detailed email includes values only after explicit enablement', () => {
  const message = createEmail(
    summary,
    true,
    'https://example.test/app/budget/current',
    'user@example.test',
  ).Messages[0];
  assertStringIncludes(message.HTMLPart, '1 000');
  assertStringIncludes(message.HTMLPart, '700');
});
