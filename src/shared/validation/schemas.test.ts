import { describe, expect, it } from 'vitest';
import {
  countPasswordCodePoints,
  countPasswordUtf8Bytes,
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
  it('requires 15 Unicode code points for a newly set password', () => {
    expect(passwordSchema.safeParse('12345678901234').success).toBe(false);
    expect(passwordSchema.safeParse('123456789012345').success).toBe(true);
    expect(passwordSchema.safeParse('😀'.repeat(14)).success).toBe(false);
    expect(passwordSchema.safeParse('😀'.repeat(15)).success).toBe(true);
  });

  it('accepts passphrases, spaces, and passwords without composition rules', () => {
    expect(passwordSchema.safeParse('a calm long phrase').success).toBe(true);
    expect(passwordSchema.safeParse(' '.repeat(15)).success).toBe(true);
    expect(passwordSchema.safeParse('lowercaseonlypwd').success).toBe(true);
  });

  it('accepts at least 64 ASCII characters and enforces the provider 72-byte limit', () => {
    expect(passwordSchema.safeParse('a'.repeat(64)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse('a'.repeat(73)).success).toBe(false);
    expect(passwordSchema.safeParse('😀'.repeat(18)).success).toBe(true);
    expect(passwordSchema.safeParse('😀'.repeat(19)).success).toBe(false);
  });

  it('counts code points, measures UTF-8 bytes, and preserves the exact password', () => {
    const password = `  ${'e\u0301'.repeat(7)}x  `;
    expect(countPasswordCodePoints('😀')).toBe(1);
    expect(countPasswordUtf8Bytes('😀')).toBe(4);
    expect(passwordSchema.parse(password)).toBe(password);
  });

  it('allows an existing shorter password to reach server-side sign-in validation', () => {
    expect(
      signInSchema.safeParse({ email: 'tester@example.test', password: 'legacy' }).success,
    ).toBe(true);
  });
});
