export type AuthOperation = 'callback' | 'password-reset' | 'register' | 'sign-in';

const messages: Record<AuthOperation, string> = {
  callback: 'This link is invalid or expired. Request a new email and try again.',
  'password-reset': 'The password reset could not be completed. Request a new link and try again.',
  register:
    'The account could not be created. Check your details or contact the test administrator.',
  'sign-in': 'The email or password is incorrect, or sign-in is temporarily unavailable.',
};

export const getAuthErrorMessage = (operation: AuthOperation): string => messages[operation];
