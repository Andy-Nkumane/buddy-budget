import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { requireSupabase } from '../../data/supabase/client';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { passwordSchema } from '../../shared/validation/schemas';
import { getAuthErrorMessage } from './authErrors';

const resetSchema = z
  .object({ password: passwordSchema, confirmation: z.string() })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'Passwords do not match.',
  });

type ResetValues = z.infer<typeof resetSchema>;

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('code');
  const [ready, setReady] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(() =>
    code ? null : 'The reset link is missing or invalid. Request a new password reset email.',
  );
  const { register, handleSubmit, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    if (!code) return;
    const client = requireSupabase();
    let active = true;
    let recoveryAuthorized = false;
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') recoveryAuthorized = true;
    });
    void client.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (!active) return;
        if (error || !recoveryAuthorized) setSubmitError(getAuthErrorMessage('password-reset'));
        else setReady(true);
      })
      .catch(() => {
        if (active) setSubmitError(getAuthErrorMessage('password-reset'));
      })
      .finally(() => listener.subscription.unsubscribe());
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [code]);

  const submit = async ({ password }: ResetValues) => {
    const { error } = await requireSupabase().auth.updateUser({ password });
    if (error) setSubmitError(getAuthErrorMessage('password-reset'));
    else void navigate('/app', { replace: true });
  };

  return (
    <div className="auth-card">
      <p className="eyebrow">Secure your account</p>
      <h2>Choose a new password</h2>
      {submitError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {submitError}
        </div>
      )}
      {!ready && !submitError && <p role="status">Checking your reset link…</p>}
      {ready && (
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 14 characters"
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <FormField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            error={formState.errors.confirmation?.message}
            {...register('confirmation')}
          />
          <Button className="button--wide" loading={formState.isSubmitting} type="submit">
            Update password
          </Button>
        </form>
      )}
      <p className="auth-card__footer">
        <Link to="/auth/sign-in">Return to sign in</Link>
      </p>
    </div>
  );
};
