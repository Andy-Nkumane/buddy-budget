import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ListChecks, LogOut, ShieldAlert, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import {
  requestAccountDeletion,
  retrievePreferences,
  retrieveProfile,
  updateProfileAndPreferences,
} from '../../data/repositories/budgetRepository';
import {
  currencyOptions,
  includePreferenceOption,
  localeOptions,
  timezoneOptions,
} from '../../shared/localization/preferenceOptions';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { Modal } from '../../shared/ui/Modal';
import { SelectField } from '../../shared/ui/SelectField';
import { profileSchema } from '../../shared/validation/schemas';
import { ExportDataForm } from './ExportDataForm';
import { queryKeys } from '../../data/queryKeys';

type SettingsValues = z.infer<typeof profileSchema>;

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { session, signOut } = useAuth();
  const userId = session?.user.id ?? '';
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  const preferences = useQuery({
    queryKey: queryKeys.preferences(userId),
    queryFn: retrievePreferences,
  });
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } = useForm<SettingsValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (!profile.data || !preferences.data) return;
    reset({
      displayName: profile.data.display_name ?? '',
      currencyCode: profile.data.currency_code,
      locale: profile.data.locale,
      timezone: profile.data.timezone,
      theme: preferences.data.theme,
    });
  }, [preferences.data, profile.data, reset]);

  const submit = async (values: SettingsValues) => {
    setSubmitError(null);
    try {
      await updateProfileAndPreferences(values);
      document.documentElement.dataset.theme = values.theme;
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.preferences(userId) });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Settings could not be saved.');
    }
  };

  const deleteAccount = async () => {
    setDeleteError(null);
    try {
      await requestAccountDeletion();
      setDeleteOpen(false);
      await signOut();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Account deletion could not be completed.',
      );
    }
  };
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  if (profile.isLoading || preferences.isLoading)
    return <LoadingState label="Loading your settings…" />;
  if (profile.error || preferences.error || !profile.data || !preferences.data)
    return (
      <ErrorState
        message={(profile.error ?? preferences.error)?.message ?? 'Your settings are unavailable.'}
      />
    );

  const settingsCurrencyOptions = includePreferenceOption(
    currencyOptions,
    profile.data.currency_code,
  );
  const settingsLocaleOptions = includePreferenceOption(localeOptions, profile.data.locale);
  const settingsTimezoneOptions = includePreferenceOption(timezoneOptions, profile.data.timezone);

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your preferences</p>
          <h1>Settings</h1>
          <p>Control how Buddy Budget looks and formats your money.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="settings-card settings-card--profile">
          <h2>Profile and display</h2>
          <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
            <div className="form-grid">
              <FormField
                label="Display name"
                error={formState.errors.displayName?.message}
                {...register('displayName')}
              />
              <SelectField
                label="Currency code"
                error={formState.errors.currencyCode?.message}
                {...register('currencyCode')}
              >
                {settingsCurrencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Locale"
                error={formState.errors.locale?.message}
                {...register('locale')}
              >
                {settingsLocaleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Timezone"
                error={formState.errors.timezone?.message}
                {...register('timezone')}
              >
                {settingsTimezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <label className="field">
                <span className="field__label">Theme</span>
                <select className="input" {...register('theme')}>
                  <option value="system">Follow device</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>
            {submitError && (
              <div className="inline-alert inline-alert--error" role="alert">
                {submitError}
              </div>
            )}
            <div className="settings-card__actions">
              <Button loading={formState.isSubmitting} type="submit">
                Save settings
              </Button>
              {saved && (
                <span className="save-state save-state--saved" role="status">
                  Saved
                </span>
              )}
            </div>
          </form>
        </section>
        <section className="settings-card">
          <h2>Categorisation rules</h2>
          <p>Review and control the rules that clean up repeated transactions.</p>
          <Link className="button button--secondary" to="/app/settings/rules">
            <ListChecks size={18} /> Manage rules
          </Link>
        </section>
        <section className="settings-card settings-card--account">
          <h2>Your data</h2>
          <p>
            Choose a date range and create a PDF report, CSV spreadsheet, or portable JSON backup.
          </p>
          <Button
            variant="secondary"
            icon={<Download size={18} />}
            onClick={() => setExportOpen(true)}
          >
            Create export
          </Button>
          <p className="privacy-note">
            <ShieldAlert size={18} />
            The export contains private financial information. Store it securely.
          </p>
        </section>
        <section className="settings-card">
          <h2>Account</h2>
          <div className="stacked-actions">
            <Button
              variant="secondary"
              icon={<LogOut size={18} />}
              onClick={() => void handleSignOut()}
            >
              Sign out
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={18} />}
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
          </div>
          {accountError && (
            <div className="inline-alert inline-alert--error" role="alert">
              {accountError}
            </div>
          )}
        </section>
      </div>
      <Modal
        open={exportOpen}
        title="Create an export"
        description="Choose the format and the budget months to include."
        onClose={() => setExportOpen(false)}
      >
        {exportOpen && (
          <ExportDataForm profile={profile.data} onComplete={() => setExportOpen(false)} />
        )}
      </Modal>
      <Modal
        open={deleteOpen}
        title="Permanently delete account?"
        description="This removes your profile, templates, categories, and all budget history. It cannot be undone."
        onClose={() => setDeleteOpen(false)}
      >
        <div className="modal-form">
          <FormField
            label="Type DELETE to confirm"
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
          />
          {deleteError && (
            <div className="inline-alert inline-alert--error" role="alert">
              {deleteError}
            </div>
          )}
          <Button
            variant="danger"
            disabled={deleteConfirmation !== 'DELETE'}
            onClick={() => void deleteAccount()}
          >
            Permanently delete my account
          </Button>
        </div>
      </Modal>
    </section>
  );
};
