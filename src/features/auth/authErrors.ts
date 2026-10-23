export type AuthOperation = 'callback' | 'password-reset' | 'register' | 'sign-in';

const messages: Record<AuthOperation, string> = {
  callback: 'This link is invalid or expired. Request a new email and try again.',
  'password-reset': 'The password reset could not be completed. Request a new link and try again.',
  register:
    'We could not create this account. If you already registered, sign in instead. Otherwise, confirm that you are an authorised tester, check the password requirements, and try again or contact the test administrator.',
  'sign-in': 'The email or password is incorrect, or sign-in is temporarily unavailable.',
};

export const getAuthErrorMessage = (operation: AuthOperation): string => messages[operation];

export const getRegistrationErrorMessage = (
  errorCode: string | undefined,
  isLocalDevelopment: boolean,
): string => {
  if (isLocalDevelopment && errorCode === 'user_already_exists') {
    return 'An account already exists for this email on localhost. Sign in or use a different email.';
  }
  return getAuthErrorMessage('register');
};
