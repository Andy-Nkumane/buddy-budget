import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import type { z } from 'zod';
import { useAuth } from '../../app/providers/AuthProvider';
import { requireSupabase } from '../../data/supabase/client';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { authSchema } from '../../shared/validation/schemas';
import { authenticationCallbackUrl } from './authUrls';

type AuthValues = z.infer<typeof authSchema>;

export const RegisterPage = () => {
  const { session } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
  });

  if (session) return <Navigate replace to="/onboarding" />;

  const submit = async (values: AuthValues) => {
    setSubmitError(null);
    const { data, error } = await requireSupabase().auth.signUp({
      ...values,
      options: { emailRedirectTo: authenticationCallbackUrl() },
    });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if (data.session) return;
    setRegisteredEmail(values.email);
  };

  if (registeredEmail) {
    return (
      <div className="auth-card auth-card--centered">
        <span className="success-icon">
          <MailCheck aria-hidden="true" />
        </span>
        <p className="eyebrow">One quick check</p>
        <h2>Verify your email</h2>
        <p>
          We sent a confirmation link to <strong>{registeredEmail}</strong>. Open it on this device
          to continue securely.
        </p>
        <Link className="button button--secondary" to="/auth/sign-in">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Start calmly</p>
      <h2>Create your account</h2>
      <p className="muted">Your private monthly plan takes only a few minutes to set up.</p>
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
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 10 characters"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button
          className="button--wide"
          loading={formState.isSubmitting}
          type="submit"
          icon={<ArrowRight aria-hidden="true" size={18} />}
        >
          Create account
        </Button>
      </form>
      <p className="auth-card__footer">
        Already have an account? <Link to="/auth/sign-in">Sign in</Link>
      </p>
    </div>
  );
};
