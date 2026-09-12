const absoluteAppUrl = (path: string): string => {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(path.replace(/^\//, ''), base).toString();
};

export const authenticationCallbackUrl = () => absoluteAppUrl('auth/callback');
export const passwordResetUrl = () => absoluteAppUrl('auth/reset-password');
