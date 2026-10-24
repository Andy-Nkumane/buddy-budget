export type AuthOperation = 'callback' | 'password-reset' | 'register' | 'sign-in';

type AuthErrorDetails = {
  code?: string;
  reasons?: string[];
  status?: number;
};

const rateLimitCodes = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
]);

const rateLimitMessage = 'Too many attempts. Wait a little while before trying again.';

const messages: Record<AuthOperation, string> = {
  callback: 'This link is invalid or expired. Request a new email and try again.',
  'password-reset': 'The password reset could not be completed. Request a new link and try again.',
  register:
    'We could not create this account. If you already registered, sign in instead. Otherwise, confirm that you are an authorised tester, check the password requirements, and try again or contact the test administrator.',
  'sign-in': 'The email or password is incorrect, or sign-in is temporarily unavailable.',
};

export const getAuthErrorMessage = (operation: AuthOperation, error?: AuthErrorDetails): string =>
  error?.status === 429 || (error?.code && rateLimitCodes.has(error.code))
    ? rateLimitMessage
    : messages[operation];

export const getNewPasswordErrorMessage = (
  operation: 'password-reset' | 'register',
  error: AuthErrorDetails,
): string => {
  if (error.code === 'weak_password' && error.reasons?.includes('pwned')) {
    return 'This password has appeared in a known data breach. Choose a different password.';
  }
  return getAuthErrorMessage(operation, error);
};

export const getRegistrationErrorMessage = (
  error: AuthErrorDetails,
  isLocalDevelopment: boolean,
): string => {
  if (isLocalDevelopment && error.code === 'user_already_exists') {
    return 'An account already exists for this email on localhost. Sign in or use a different email.';
  }
  return getNewPasswordErrorMessage('register', error);
};
