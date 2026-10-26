import { zodResolver } from '@hookform/resolvers/zod';
import type { Factor } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  Download,
  ListChecks,
  LogOut,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { useHousehold } from '../../app/providers/HouseholdProvider';
import {
  reauthenticateWithPassword,
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
import { RestoreBackupForm } from './RestoreBackupForm';
import { ShareReportForm } from '../reports/ShareReportForm';
import { queryKeys } from '../../data/queryKeys';
import { LegalLinks } from '../legal/LegalLinks';
import { MfaSettings } from './MfaSettings';
import { ChangePasswordForm } from './ChangePasswordForm';
import { retrieveTotpFactors, verifyTotpFactor } from '../auth/mfa';

type SettingsValues = z.infer<typeof profileSchema>;

export const SettingsPage = () => {
  const queryClient = useQueryClient();
  const { session, signOut } = useAuth();
  const household = useHousehold();
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
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMfaCode, setDeleteMfaCode] = useState('');
  const [deleteMfaFactorId, setDeleteMfaFactorId] = useState<string | null>(null);
  const [deleteMfaFactors, setDeleteMfaFactors] = useState<Factor<'totp', 'verified'>[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteCompleted, setDeleteCompleted] = useState(false);
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
      await reauthenticateWithPassword(deletePassword);
      setDeletePassword('');
    } catch {
      setDeleteError('Your password could not be verified. Check it and try again.');
      return;
    }
    if (deleteMfaFactorId) {
      try {
        await verifyTotpFactor(deleteMfaFactorId, deleteMfaCode);
        setDeleteMfaCode('');
      } catch {
        setDeleteError('Your authenticator code could not be verified. Check it and try again.');
        return;
      }
    }
    try {
      await requestAccountDeletion();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'Account deletion could not be completed.',
      );
      return;
    }
    setDeleteCompleted(true);
    try {
      await signOut({ scope: 'local' });
      setDeleteOpen(false);
    } catch {
      setDeleteError(
        'Your account was deleted, but this browser could not clear its local session. Close Buddy Budget and clear this site’s stored data before another person uses this device.',
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

  const openAccountDeletion = async () => {
    setDeleteError(null);
    try {
      const factors = await retrieveTotpFactors();
      setDeleteMfaFactors(factors);
      setDeleteMfaFactorId(factors[0]?.id ?? null);
      setDeleteOpen(true);
    } catch {
      setAccountError('Your account security could not be checked. Try again.');
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
  const activeHouseholdName =
    household.context?.households.find(
      (entry) => entry.id === household.context?.active_household_id,
    )?.name ?? 'the selected household';

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
          <h2>Weekly budget check-in</h2>
          <p>Get one concise, opt-in summary in the app, by email, or both.</p>
          <Link className="button button--secondary" to="/app/settings/check-ins">
            <BellRing size={18} /> Set up check-ins
          </Link>
        </section>
        {household.role !== 'viewer' && (
          <section className="settings-card">
            <h2>Categorisation rules</h2>
            <p>Review and control the rules that clean up repeated transactions.</p>
            <Link className="button button--secondary" to="/app/settings/rules">
              <ListChecks size={18} /> Manage rules
            </Link>
          </section>
        )}
        <section className="settings-card">
          <h2>Privacy and project status</h2>
          <p>Review how Buddy Budget handles information and the limits of this test project.</p>
          <div className="settings-legal-links">
            <ShieldCheck aria-hidden="true" size={18} />
            <LegalLinks />
          </div>
        </section>
        <MfaSettings />
        <ChangePasswordForm />
        <section className="settings-card settings-card--account">
          <h2>Your data</h2>
          <p>
            Choose a date range and create a PDF report, CSV spreadsheet, or portable JSON backup.
          </p>
          <p>
            <strong>Export scope:</strong> personal display settings and financial records visible
            in {activeHouseholdName}. Switch households before exporting a different shared budget.
          </p>
          <div className="stacked-actions">
            <Button
              variant="secondary"
              icon={<Download size={18} />}
              onClick={() => setExportOpen(true)}
            >
              Create export
            </Button>
            {household.role === 'owner' && (
              <Button
                variant="secondary"
                icon={<Share2 size={18} />}
                onClick={() => setShareOpen(true)}
              >
                Share limited report
              </Button>
            )}
            {household.role === 'owner' && (
              <Button
                variant="secondary"
                icon={<Upload size={18} />}
                onClick={() => setRestoreOpen(true)}
              >
                Restore backup
              </Button>
            )}
          </div>
          <p className="privacy-note">
            <ShieldAlert size={18} />
            The export contains private financial information. Store it securely.
          </p>
          <p>
            Export is an optional portability tool, not a complete legal access response. You can
            correct editable records in the relevant screen; locked history must remain unchanged
            and uses a current-month adjustment. Review the{' '}
            <Link to="/privacy#rights">rights guidance</Link> or{' '}
            <Link to="/contact">contact guidance</Link> for requests the app cannot complete.
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
              onClick={() => void openAccountDeletion()}
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
        open={shareOpen}
        title="Share a limited report"
        description="Choose exactly what another person can see. The original budget remains private."
        onClose={() => setShareOpen(false)}
      >
        {shareOpen && (
          <ShareReportForm profile={profile.data} onComplete={() => setShareOpen(false)} />
        )}
      </Modal>
      <Modal
        open={restoreOpen}
        title="Restore a JSON backup"
        description="Validate the file first, then choose a safe merge or a complete replacement."
        onClose={() => setRestoreOpen(false)}
      >
        {restoreOpen && <RestoreBackupForm onComplete={() => setRestoreOpen(false)} />}
      </Modal>
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
        description="This deletes your sign-in identity and account-owned data from the active database. Shared-household ownership may block deletion, and provider backups or logs can remain for their configured retention periods."
        onClose={() => {
          if (!deleteCompleted) setDeleteOpen(false);
        }}
      >
        <div className="modal-form">
          <p>
            Export anything you need first. If you own a household with other members, transfer
            ownership and remove or relocate its members before deleting your account.
          </p>
          <FormField
            label="Type DELETE to confirm"
            value={deleteConfirmation}
            disabled={deleteCompleted}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
          />
          <FormField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            disabled={deleteCompleted}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
          {deleteMfaFactorId && (
            <>
              {deleteMfaFactors.length > 1 && (
                <label className="field">
                  <span className="field__label">Authenticator app</span>
                  <select
                    className="input"
                    value={deleteMfaFactorId}
                    disabled={deleteCompleted}
                    onChange={(event) => setDeleteMfaFactorId(event.target.value)}
                  >
                    {deleteMfaFactors.map((factor, index) => (
                      <option key={factor.id} value={factor.id}>
                        {factor.friendly_name || `Authenticator app ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <FormField
                label="Authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                value={deleteMfaCode}
                disabled={deleteCompleted}
                onChange={(event) => setDeleteMfaCode(event.target.value)}
              />
            </>
          )}
          {deleteError && (
            <div className="inline-alert inline-alert--error" role="alert">
              {deleteError}
            </div>
          )}
          <Button
            variant="danger"
            disabled={
              deleteConfirmation !== 'DELETE' ||
              !deletePassword ||
              (deleteMfaFactorId !== null && !/^\d{6}$/.test(deleteMfaCode)) ||
              deleteCompleted
            }
            onClick={() => void deleteAccount()}
          >
            {deleteCompleted ? 'Account deleted' : 'Permanently delete my account'}
          </Button>
        </div>
      </Modal>
    </section>
  );
};
