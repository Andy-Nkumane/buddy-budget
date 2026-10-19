const ownershipFields = new Set(['user_id', 'household_id', 'active_household_id']);

export const assertPortableHouseholdScope = (value: unknown, expectedHouseholdId: string): void => {
  if (Array.isArray(value)) {
    value.forEach((entry) => assertPortableHouseholdScope(entry, expectedHouseholdId));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (key === 'household_id' && entry !== null && entry !== expectedHouseholdId) {
      throw new Error('The active household changed during export. Try the export again.');
    }
    assertPortableHouseholdScope(entry, expectedHouseholdId);
  });
};

export const removePortableOwnership = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(removePortableOwnership) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !ownershipFields.has(key))
      .map(([key, entry]) => [key, removePortableOwnership(entry)]),
  ) as T;
};
