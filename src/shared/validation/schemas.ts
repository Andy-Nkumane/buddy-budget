import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email address.');

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  .max(128, 'Password is too long.');

export const authSchema = z.object({ email: emailSchema, password: passwordSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const profileSchema = z.object({
  displayName: z.string().trim().max(80, 'Keep the name under 80 characters.'),
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'Use a three-letter currency code.'),
  locale: z.string().trim().min(2).max(35),
  timezone: z.string().trim().min(1).max(80),
  theme: z.enum(['system', 'light', 'dark']),
});

export const itemSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(100, 'Keep the name under 100 characters.'),
  amount: z
    .string()
    .trim()
    .refine((value) => parseMoney(value) !== null, {
      message: 'Enter an amount between 0 and 999,999,999,999.99.',
    }),
  itemType: z.enum(['income', 'expense']),
  categoryId: z.string().uuid().nullable().optional(),
});

export const parseMoney = (rawValue: string): number | null => {
  const normalized = rawValue.trim().replace(/\s/g, '').replace(/,/g, '');
  if (!/^\d{0,12}(?:\.\d{0,2})?$/.test(normalized) || normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value <= 999_999_999_999.99 ? value : null;
};

export const toDatabaseMoney = (value: string | number): string => {
  const parsed = typeof value === 'number' ? value : parseMoney(value);
  if (parsed === null || !Number.isFinite(parsed)) throw new Error('Invalid monetary amount.');
  return parsed.toFixed(2);
};
