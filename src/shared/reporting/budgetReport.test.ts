import { describe, expect, it } from 'vitest';
import { formatSignedReportAmount } from './budgetReport';

describe('formatSignedReportAmount', () => {
  it('prefixes income with a plus sign', () => {
    expect(formatSignedReportAmount(1250, 'income', 'USD', 'en-US')).toBe('+ $1,250.00');
  });

  it('prefixes expenses with a minus sign', () => {
    expect(formatSignedReportAmount(89.5, 'expense', 'USD', 'en-US')).toBe('- $89.50');
  });
});
