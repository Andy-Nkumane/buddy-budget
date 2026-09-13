const userRoot = (userId: string) => ['user', userId] as const;

export const queryKeys = {
  profile: (userId: string) => [...userRoot(userId), 'profile'] as const,
  preferences: (userId: string) => [...userRoot(userId), 'preferences'] as const,
  categories: (userId: string) => [...userRoot(userId), 'categories'] as const,
  templates: (userId: string) => [...userRoot(userId), 'templates'] as const,
  defaultTemplate: (userId: string) => [...userRoot(userId), 'default-template'] as const,
  months: (userId: string) => [...userRoot(userId), 'months'] as const,
  month: (userId: string, monthStart: string) =>
    [...userRoot(userId), 'month', monthStart] as const,
};
