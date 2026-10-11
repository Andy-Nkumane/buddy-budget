import { z } from 'zod';

export type OnboardingPath = 'starter' | 'csv' | 'transfer' | 'blank';

export type OnboardingDraft = {
  version: 1;
  userId: string;
  updatedAt: string;
  setupKey: string;
  path: OnboardingPath | null;
  step: number;
  displayName: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  templateName: string;
  items: Array<{
    name: string;
    itemType: 'income' | 'expense';
    categoryName: string;
    amount: string;
    starterItemKey?: string;
  }>;
  starter?: { id: string; version: number; copyKey: string };
};

const draftSchema = z.object({
  version: z.literal(1),
  userId: z.string().uuid(),
  updatedAt: z.string().datetime(),
  setupKey: z.string().uuid(),
  path: z.enum(['starter', 'csv', 'transfer', 'blank']).nullable(),
  step: z.number().int().min(1).max(4),
  displayName: z.string().max(80),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  locale: z.string().min(2).max(35),
  timezone: z.string().min(1).max(80),
  templateName: z.string().max(80),
  items: z
    .array(
      z.object({
        name: z.string().max(100),
        itemType: z.enum(['income', 'expense']),
        categoryName: z.string().max(80),
        amount: z.string().max(32),
        starterItemKey: z.string().max(80).optional(),
      }),
    )
    .max(50),
  starter: z
    .object({
      id: z.string().max(80),
      version: z.number().int().positive(),
      copyKey: z.string().uuid(),
    })
    .optional(),
});

const keyFor = (userId: string) => `buddy-budget-onboarding:${userId}`;

export const createSetupKey = (): string => crypto.randomUUID();

export const retrieveOnboardingDraft = (
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  userId: string,
): OnboardingDraft | null => {
  const key = keyFor(userId);
  try {
    const result = draftSchema.safeParse(JSON.parse(storage.getItem(key) ?? 'null'));
    if (result.success && result.data.userId === userId) return result.data;
    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      return null;
    }
  }
  return null;
};

export const saveOnboardingDraft = (
  storage: Pick<Storage, 'setItem'>,
  draft: OnboardingDraft,
): void => {
  try {
    storage.setItem(keyFor(draft.userId), JSON.stringify(draft));
  } catch {
    return;
  }
};

export const clearOnboardingDraft = (
  storage: Pick<Storage, 'removeItem'>,
  userId: string,
): void => {
  try {
    storage.removeItem(keyFor(userId));
  } catch {
    return;
  }
};
