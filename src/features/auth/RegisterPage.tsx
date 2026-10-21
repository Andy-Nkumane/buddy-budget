import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/providers/AuthProvider';
import { requireSupabase } from '../../data/supabase/client';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { authSchema } from '../../shared/validation/schemas';
import { authenticationCallbackUrl } from './authUrls';
import { CollectionNotice } from '../legal/CollectionNotice';
import { getAuthErrorMessage } from './authErrors';

const registrationSchema = authSchema.extend({
  termsAcknowledged: z
    .boolean()
    .refine((acknowledged) => acknowledged, 'Acknowledge the testing terms to continue.'),
});

type AuthValues = z.infer<typeof registrationSchema>;

export const RegisterPage = () => {
  const { session } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<AuthValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { termsAcknowledged: false },
  });

  if (session) return <Navigate replace to="/onboarding" />;

  const submit = async (values: AuthValues) => {
    setSubmitError(null);
    const { data, error } = await requireSupabase().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: authenticationCallbackUrl(),
        data: {
          testing_terms_acknowledged_version: 'draft-0.1',
          privacy_notice_seen_version: 'draft-0.1',
          acknowledged_at: new Date().toISOString(),
        },
      },
    });
    if (error) {
      setSubmitError(getAuthErrorMessage('register'));
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
      <p className="muted">Accounts are only for people authorised to test Buddy Budget.</p>
      {submitError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {submitError}
        </div>
      )}
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <CollectionNotice title="Before you create a test account">
          Supabase receives your email, password credential, and account/session metadata to create
          and secure the account. Use only test data you are authorised to provide.
        </CollectionNotice>
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
          hint="At least 14 characters"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <label className="check-row">
          <input type="checkbox" {...register('termsAcknowledged')} />
          <span>
            <strong>I acknowledge the Terms of Use and have read the Privacy notice.</strong>
            <small>
              Required for authorised testing. This is not blanket consent to optional processing or
              marketing; no marketing consent is requested here.
            </small>
          </span>
        </label>
        {formState.errors.termsAcknowledged && (
          <span className="field__error" role="alert">
            {formState.errors.termsAcknowledged.message}
          </span>
        )}
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
