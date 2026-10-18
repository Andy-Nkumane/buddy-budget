import { describe, expect, it } from 'vitest';
import { assertPortableHouseholdScope, removePortableOwnership } from './portableBackup';

describe('removePortableOwnership', () => {
  it('removes personal and household ownership IDs at every nesting level', () => {
    expect(
      removePortableOwnership({
        user_id: 'user',
        active_household_id: 'active',
        categories: [{ id: 'category', household_id: 'household', user_id: 'owner' }],
      }),
    ).toEqual({ categories: [{ id: 'category' }] });
  });

  it('rejects records collected from a different household scope', () => {
    expect(() =>
      assertPortableHouseholdScope(
        { categories: [{ household_id: 'household-b' }] },
        'household-a',
      ),
    ).toThrow(/active household changed/i);
    expect(() =>
      assertPortableHouseholdScope(
        { categories: [{ household_id: 'household-a' }], preferences: { household_id: null } },
        'household-a',
      ),
    ).not.toThrow();
  });
});
