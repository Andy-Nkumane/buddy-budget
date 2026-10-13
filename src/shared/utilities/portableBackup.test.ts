import { describe, expect, it } from 'vitest';
import { removePortableOwnership } from './portableBackup';

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
});
