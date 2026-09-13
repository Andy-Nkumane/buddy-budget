import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
import { requireSupabase } from '../../data/supabase/client';
import { authSchema } from '../../shared/validation/schemas';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { useAuth } from '../../app/providers/AuthProvider';

type AuthValues = z.infer<typeof authSchema>;

export const SignInPage = () => {
  const { session, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
  });

  if (session) return <Navigate replace to="/app" />;

  const submit = async (values: AuthValues) => {
    setSubmitError(null);
    const { error } = await requireSupabase().auth.signInWithPassword(values);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    const candidate = (location.state as { from?: string } | null)?.from;
    void navigate(candidate?.startsWith('/app/') ? candidate : '/app', { replace: true });
  };

  return (
    <div className="auth-card">
      <p className="eyebrow">Welcome back</p>
      <h2>Sign in to your budget</h2>
      <p className="muted">Pick up exactly where you left off.</p>
      {(submitError || sessionMessage) && (
        <div className="inline-alert inline-alert--error" role="alert">
          {submitError ?? sessionMessage}
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
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <div className="form-row form-row--end">
          <Link to="/auth/forgot-password">Forgot password?</Link>
        </div>
        <Button
          className="button--wide"
          loading={formState.isSubmitting}
          icon={<ArrowRight aria-hidden="true" size={18} />}
          type="submit"
        >
          Sign in
        </Button>
      </form>
      <p className="auth-card__footer">
        New to Buddy Budget? <Link to="/auth/register">Create an account</Link>
      </p>
    </div>
  );
};
