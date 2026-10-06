const ownershipFields = new Set(['user_id', 'household_id', 'active_household_id']);

export const removePortableOwnership = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(removePortableOwnership) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !ownershipFields.has(key))
      .map(([key, entry]) => [key, removePortableOwnership(entry)]),
  ) as T;
};
