import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { requireSupabase } from '../../data/supabase/client';
import { Button } from '../../shared/ui/Button';
import { PasswordField } from '../../shared/ui/PasswordField';
import { passwordSchema } from '../../shared/validation/schemas';
import { getAuthErrorMessage, getNewPasswordErrorMessage } from './authErrors';

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
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(() =>
    code ? null : 'The reset link is missing or invalid. Request a new password reset email.',
  );
  const { register, handleSubmit, formState } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  });

  useEffect(() => {
    if (!code) return;
    const client = requireSupabase();
    const address = new URL(window.location.href);
    if (address.searchParams.has('code')) {
      address.searchParams.delete('code');
      window.history.replaceState(window.history.state, '', address);
    }
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
    const client = requireSupabase();
    const { error } = await client.auth.updateUser({ password });
    if (error) setSubmitError(getNewPasswordErrorMessage('password-reset', error));
    else {
      setReady(false);
      setPasswordUpdated(true);
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        setSubmitError(
          'Your password was updated, but Buddy Budget could not end every existing session. Close this browser and contact the test administrator before continuing.',
        );
      } else {
        void navigate('/auth/sign-in', { replace: true, state: { passwordChanged: true } });
      }
    }
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
      {!ready && !submitError && !passwordUpdated && <p role="status">Checking your reset link…</p>}
      {ready && (
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <PasswordField
            label="New password"
            autoComplete="new-password"
            hint="Use 15 or more characters (maximum 72 UTF-8 bytes). Spaces and passphrases are welcome."
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <PasswordField
            label="Confirm password"
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
