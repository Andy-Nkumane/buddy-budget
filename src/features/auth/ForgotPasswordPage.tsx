import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { z } from 'zod';
import { requireSupabase } from '../../data/supabase/client';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { forgotPasswordSchema } from '../../shared/validation/schemas';
import { passwordResetUrl } from './authUrls';

type ForgotValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage = () => {
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const submit = async ({ email }: ForgotValues) => {
    setSubmitError(null);
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: passwordResetUrl(),
    });
    if (error) setSubmitError(error.message);
    else setSent(true);
  };

  return (
    <div className="auth-card">
      {sent ? (
        <>
          <span className="success-icon">
            <MailCheck aria-hidden="true" />
          </span>
          <h2>Check your email</h2>
          <p>
            If an account exists for that address, we sent a password reset link. The message may
            take a minute to arrive.
          </p>
          <Link className="button button--secondary" to="/auth/sign-in">
            Back to sign in
          </Link>
        </>
      ) : (
        <>
          <p className="eyebrow">Account recovery</p>
          <h2>Reset your password</h2>
          <p className="muted">We’ll send a secure, single-use link to your email.</p>
          {submitError && (
            <div className="inline-alert inline-alert--error" role="alert">
              {submitError}
            </div>
          )}
          <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
            <FormField
              label="Email address"
              autoComplete="email"
              inputMode="email"
              error={formState.errors.email?.message}
              {...register('email')}
            />
            <Button className="button--wide" loading={formState.isSubmitting} type="submit">
              Send reset link
            </Button>
          </form>
          <p className="auth-card__footer">
            <Link to="/auth/sign-in">Back to sign in</Link>
          </p>
        </>
      )}
    </div>
  );
};
