import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/providers/AuthProvider';
import { requireSupabase } from '../../data/supabase/client';
import { Button } from '../../shared/ui/Button';
import { PasswordField } from '../../shared/ui/PasswordField';
import { passwordSchema } from '../../shared/validation/schemas';
import { getNewPasswordErrorMessage } from '../auth/authErrors';

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'Passwords do not match.',
  })
  .refine((value) => value.password !== value.currentPassword, {
    path: ['password'],
    message: 'Choose a password different from your current password.',
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const ChangePasswordForm = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const { register, handleSubmit, formState } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const submit = async ({ currentPassword, password }: ChangePasswordValues) => {
    setSubmitError(null);
    const { error } = await requireSupabase().auth.updateUser({
      current_password: currentPassword,
      password,
    });
    if (error) {
      setSubmitError(getNewPasswordErrorMessage('password-change', error));
      return;
    }

    setPasswordUpdated(true);
    try {
      await signOut();
      void navigate('/auth/sign-in', { replace: true, state: { passwordChanged: true } });
    } catch {
      setSubmitError(
        'Your password was updated, but Buddy Budget could not end every existing session. Close this browser and contact the test administrator before continuing.',
      );
    }
  };

  return (
    <section className="settings-card settings-card--account">
      <h2>Change password</h2>
      <p>
        Confirm your current password, then choose a unique password of at least 15 characters. You
        will sign in again on every device after the change.
      </p>
      {!passwordUpdated && (
        <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={formState.errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            hint="Use 15 or more characters (maximum 72 UTF-8 bytes). Spaces and passphrases are welcome."
            error={formState.errors.password?.message}
            {...register('password')}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={formState.errors.confirmation?.message}
            {...register('confirmation')}
          />
          <Button loading={formState.isSubmitting} type="submit">
            Change password
          </Button>
        </form>
      )}
      {submitError && (
        <div className="inline-alert inline-alert--error" role="alert">
          {submitError}
        </div>
      )}
    </section>
  );
};
