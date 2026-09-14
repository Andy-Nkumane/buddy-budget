const userRoot = (userId: string) => ['user', userId] as const;

export const queryKeys = {
  profile: (userId: string) => [...userRoot(userId), 'profile'] as const,
  preferences: (userId: string) => [...userRoot(userId), 'preferences'] as const,
  categoryRoot: (userId: string) => [...userRoot(userId), 'categories'] as const,
  categories: (userId: string, includeArchived = false) =>
    [...userRoot(userId), 'categories', includeArchived ? 'all' : 'active'] as const,
  templates: (userId: string) => [...userRoot(userId), 'templates'] as const,
  defaultTemplate: (userId: string) => [...userRoot(userId), 'default-template'] as const,
  months: (userId: string) => [...userRoot(userId), 'months'] as const,
  accounts: (userId: string) => [...userRoot(userId), 'accounts'] as const,
  transactions: (userId: string, page: number) =>
    [...userRoot(userId), 'transactions', page] as const,
  transactionImports: (userId: string) => [...userRoot(userId), 'transaction-imports'] as const,
  month: (userId: string, monthStart: string) =>
    [...userRoot(userId), 'month', monthStart] as const,
};
