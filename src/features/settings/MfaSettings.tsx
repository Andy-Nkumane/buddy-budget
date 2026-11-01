import type { Factor } from '@supabase/supabase-js';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { PasswordField } from '../../shared/ui/PasswordField';
import { reauthenticateWithPassword } from '../../data/repositories/budgetRepository';
import {
  createTotpEnrollment,
  deleteTotpFactor,
  getTotpFactorDisplayName,
  refreshMfaSessionAssurance,
  retrieveMfaAssurance,
  retrieveTotpFactors,
  validateMfaFriendlyName,
  verifyTotpFactor,
  type TotpEnrollment,
} from '../auth/mfa';

export const MfaSettings = () => {
  const navigate = useNavigate();
  const [factors, setFactors] = useState<Factor<'totp', 'verified'>[]>([]);
  const [assurance, setAssurance] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [showNameField, setShowNameField] = useState(false);
  const [friendlyName, setFriendlyName] = useState('');
  const [code, setCode] = useState('');
  const [removal, setRemoval] = useState<{
    factorId: string;
    factorName: string;
    verificationFactorId: string;
    verificationFactorName: string;
    isLastFactor: boolean;
  } | null>(null);
  const [removalPassword, setRemovalPassword] = useState('');
  const [removalCode, setRemovalCode] = useState('');
  const [removalConfirmation, setRemovalConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    const [availableFactors, currentAssurance] = await Promise.all([
      retrieveTotpFactors(),
      retrieveMfaAssurance(),
    ]);
    setFactors(availableFactors);
    setAssurance(currentAssurance.currentLevel);
  };

  useEffect(() => {
    void Promise.all([retrieveTotpFactors(), retrieveMfaAssurance()])
      .then(([availableFactors, currentAssurance]) => {
        setFactors(availableFactors);
        setAssurance(currentAssurance.currentLevel);
      })
      .catch(() => setError('Authenticator settings could not be loaded.'));
  }, []);

  const startEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    const nameError = validateMfaFriendlyName(friendlyName);
    if (nameError) {
      setError(nameError);
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      setEnrollment(await createTotpEnrollment(friendlyName));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Setup could not be started.');
    } finally {
      setBusy(false);
    }
  };

  const verifyEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollment || !/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyTotpFactor(enrollment.factorId, code);
      setEnrollment(null);
      setShowNameField(false);
      setFriendlyName('');
      setCode('');
      await load();
      setStatus('Authenticator app added. Other sessions were signed out by Supabase.');
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'The code could not be verified.',
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTotpFactor(enrollment.factorId);
      setEnrollment(null);
      setShowNameField(false);
      setFriendlyName('');
      setCode('');
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : 'Setup could not be cancelled.',
      );
    } finally {
      setBusy(false);
    }
  };

  const clearRemoval = () => {
    setRemoval(null);
    setRemovalPassword('');
    setRemovalCode('');
    setRemovalConfirmation('');
    setError(null);
  };

  const beginRemoval = async (factorId: string) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const [availableFactors, currentAssurance] = await Promise.all([
        retrieveTotpFactors(),
        retrieveMfaAssurance(),
      ]);
      setFactors(availableFactors);
      setAssurance(currentAssurance.currentLevel);
      if (currentAssurance.currentLevel !== 'aal2') {
        setError('Verify with an authenticator before starting removal.');
        return;
      }
      const targetFactor = availableFactors.find((factor) => factor.id === factorId);
      if (!targetFactor) {
        setError('This authenticator is no longer available. The list has been refreshed.');
        return;
      }
      const remainingFactor = availableFactors.find((factor) => factor.id !== factorId);
      setRemoval({
        factorId,
        factorName: getTotpFactorDisplayName(targetFactor),
        verificationFactorId: remainingFactor?.id ?? targetFactor.id,
        verificationFactorName: getTotpFactorDisplayName(remainingFactor ?? targetFactor),
        isLastFactor: !remainingFactor,
      });
    } catch {
      setError('Authenticator removal could not be started. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!removal) return;
    if (removalConfirmation !== removal.factorName) {
      setError(`Type “${removal.factorName}” exactly to confirm removal.`);
      return;
    }
    if (!removalPassword) {
      setError('Enter your current password.');
      return;
    }
    if (!/^\d{6}$/.test(removalCode)) {
      setError('Enter the six-digit code from the named authenticator.');
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const [factorsBeforeReauthentication, assuranceBeforeReauthentication] = await Promise.all([
        retrieveTotpFactors(),
        retrieveMfaAssurance(),
      ]);
      const currentTarget = factorsBeforeReauthentication.find(
        (factor) => factor.id === removal.factorId,
      );
      const currentVerificationFactor = factorsBeforeReauthentication.find(
        (factor) => factor.id === removal.verificationFactorId,
      );
      if (
        assuranceBeforeReauthentication.currentLevel !== 'aal2' ||
        !currentTarget ||
        !currentVerificationFactor ||
        getTotpFactorDisplayName(currentTarget) !== removal.factorName
      ) {
        clearRemoval();
        await load();
        setError('Authenticator settings changed. Review the refreshed list and try again.');
        return;
      }
      try {
        await reauthenticateWithPassword(removalPassword);
      } catch {
        setError('Your current password could not be confirmed.');
        return;
      }
      try {
        await verifyTotpFactor(removal.verificationFactorId, removalCode);
      } catch {
        clearRemoval();
        void navigate('/auth/mfa', {
          replace: true,
          state: {
            from: '/app/settings',
            reason: 'reauthentication-code-rejected',
          },
        });
        return;
      }
      const [factorsBeforeRemoval, assuranceBeforeRemoval] = await Promise.all([
        retrieveTotpFactors(),
        retrieveMfaAssurance(),
      ]);
      if (
        assuranceBeforeRemoval.currentLevel !== 'aal2' ||
        !factorsBeforeRemoval.some((factor) => factor.id === removal.factorId)
      ) {
        clearRemoval();
        await load();
        setError('Authenticator settings changed. Review the refreshed list and try again.');
        return;
      }
      await deleteTotpFactor(removal.factorId);
      const refreshedAssurance = await refreshMfaSessionAssurance();
      clearRemoval();
      await load();
      setAssurance(refreshedAssurance.currentLevel);
      setStatus('Authenticator app removed. Your security level has been refreshed.');
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'The authenticator app could not be removed.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-card settings-card--account mfa-settings">
      <h2>Authenticator app</h2>
      <p>
        Add an optional time-based code as a second sign-in step. Authenticator codes reduce account
        takeover risk, but they are not phishing-resistant.
      </p>
      {factors.length > 0 && (
        <p className="mfa-settings__state">
          <ShieldCheck aria-hidden="true" size={18} />
          {factors.length} authenticator {factors.length === 1 ? 'app' : 'apps'} active
          {assurance === 'aal2' ? ' · verified in this session' : ''}
        </p>
      )}
      <ul className="mfa-factor-list" aria-label="Authenticator apps">
        {factors.map((factor) => (
          <li key={factor.id}>
            <span>{getTotpFactorDisplayName(factor)}</span>
            <Button
              variant="secondary"
              aria-label={`Remove ${getTotpFactorDisplayName(factor)}`}
              disabled={busy || assurance !== 'aal2' || Boolean(removal)}
              onClick={() => void beginRemoval(factor.id)}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {factors.length > 0 && assurance !== 'aal2' && (
        <p className="muted">Verify with an authenticator before removing one.</p>
      )}
      {removal && (
        <form className="mfa-removal" onSubmit={(event) => void removeFactor(event)}>
          <h3>Remove {removal.factorName}?</h3>
          {removal.isLastFactor ? (
            <div className="inline-alert inline-alert--warning">
              This is your last authenticator. Removing it turns off your second sign-in step. If
              you no longer have access to it, you cannot remove it here. Contact the authorised
              test administrator for account recovery.
            </div>
          ) : (
            <p>
              Confirm this change with a fresh code from {removal.verificationFactorName}. This
              keeps a different authenticator available after removal.
            </p>
          )}
          <PasswordField
            id="mfa-removal-password"
            label="Current password"
            autoComplete="current-password"
            value={removalPassword}
            onChange={(event) => {
              setRemovalPassword(event.target.value);
              setError(null);
            }}
          />
          <FormField
            id="mfa-removal-code"
            label={`Six-digit code from ${removal.verificationFactorName}`}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            value={removalCode}
            onChange={(event) => {
              setRemovalCode(event.target.value);
              setError(null);
            }}
          />
          <FormField
            id="mfa-removal-confirmation"
            label={`Type ${removal.factorName} to confirm`}
            autoComplete="off"
            value={removalConfirmation}
            onChange={(event) => {
              setRemovalConfirmation(event.target.value);
              setError(null);
            }}
          />
          {error && (
            <div className="inline-alert inline-alert--error" role="alert">
              {error}
            </div>
          )}
          <div className="settings-card__actions">
            <Button
              variant="danger"
              aria-label={`Confirm removal of ${removal.factorName}`}
              loading={busy}
              type="submit"
            >
              Remove {removal.factorName}
            </Button>
            <Button variant="ghost" disabled={busy} type="button" onClick={clearRemoval}>
              Keep authenticator
            </Button>
          </div>
        </form>
      )}
      {enrollment ? (
        <form className="mfa-enrollment" onSubmit={(event) => void verifyEnrollment(event)}>
          <p>
            Scan this code with your authenticator app. If scanning is unavailable, enter the setup
            key manually. Do not save or share the key after setup.
          </p>
          <img src={enrollment.qrCode} alt="Authenticator setup QR code" />
          <div className="mfa-enrollment__secret">
            <span>Manual setup key</span>
            <code>{enrollment.secret}</code>
          </div>
          <FormField
            id="mfa-enrollment-code"
            label="Six-digit verification code"
            error={error ?? undefined}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
          />
          <div className="settings-card__actions">
            <Button loading={busy} type="submit">
              Verify and enable
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              type="button"
              onClick={() => void cancelEnrollment()}
            >
              Cancel setup
            </Button>
          </div>
        </form>
      ) : showNameField ? (
        <form className="mfa-enrollment" onSubmit={(event) => void startEnrollment(event)}>
          <FormField
            id="mfa-friendly-name"
            label="Authenticator name"
            aria-label="Authenticator name"
            hint="Use a name you will recognise, such as “Personal phone”."
            error={error ?? undefined}
            autoComplete="off"
            value={friendlyName}
            onChange={(event) => {
              setFriendlyName(event.target.value);
              setError(null);
            }}
          />
          <div className="settings-card__actions">
            <Button loading={busy} type="submit">
              Continue setup
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              type="button"
              onClick={() => {
                setShowNameField(false);
                setFriendlyName('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => {
            setShowNameField(true);
            setError(null);
          }}
        >
          {factors.length ? 'Add another authenticator' : 'Set up authenticator'}
        </Button>
      )}
      <p className="privacy-note">
        Add a second authenticator before replacing or losing your current device. If every device
        is lost, recovery requires the test administrator; Buddy Budget does not issue recovery
        codes yet.
      </p>
      {error && !enrollment && !showNameField && !removal && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {status && <div role="status">{status}</div>}
    </section>
  );
};
