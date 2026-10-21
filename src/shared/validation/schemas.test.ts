import { describe, expect, it } from 'vitest';
import {
  itemSchema,
  parseMoney,
  passwordSchema,
  profileSchema,
  signInSchema,
  toDatabaseMoney,
} from './schemas';

describe('money validation', () => {
  it.each([
    ['0', 0],
    ['1,234.50', 1234.5],
    ['999999999999.99', 999999999999.99],
  ])('parses %s', (raw, expected) => expect(parseMoney(raw)).toBe(expected));

  it.each(['', '-1', '1.234', '1000000000000', 'not money'])('rejects %s', (raw) =>
    expect(parseMoney(raw)).toBeNull(),
  );

  it('normalizes valid values for numeric database columns', () => {
    expect(toDatabaseMoney('12.5')).toBe('12.50');
  });

  it('validates template and month item fields', () => {
    expect(itemSchema.safeParse({ name: '', amount: '12', itemType: 'expense' }).success).toBe(
      false,
    );
  });

  it('rejects non-ISO-like currency codes', () => {
    expect(
      profileSchema.safeParse({
        displayName: '',
        currencyCode: 'zar',
        locale: 'en-ZA',
        timezone: 'UTC',
        theme: 'system',
      }).success,
    ).toBe(false);
  });
});

describe('password validation', () => {
  it('requires 14 characters for a new password', () => {
    expect(passwordSchema.safeParse('thirteen-char').success).toBe(false);
    expect(passwordSchema.safeParse('fourteen-chars!').success).toBe(true);
  });

  it('allows an existing shorter password to reach server-side sign-in validation', () => {
    expect(
      signInSchema.safeParse({ email: 'tester@example.test', password: 'legacy' }).success,
    ).toBe(true);
  });
});
