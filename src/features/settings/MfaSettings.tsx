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
  generateRecoveryCodes,
  getTotpFactorDisplayName,
  regenerateRecoveryCodes,
  refreshMfaSessionAssurance,
  retrieveMfaAssurance,
  retrieveRecoveryCodesStatus,
  retrieveTotpFactors,
  validateMfaFriendlyName,
  verifyRecoveryCode,
  verifyTotpFactor,
  type TotpEnrollment,
  type GeneratedRecoveryCodes,
  type RecoveryCodesStatus,
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
  const [removalMethod, setRemovalMethod] = useState<'totp' | 'recovery'>('totp');
  const [removalConfirmation, setRemovalConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryCodesStatus | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<GeneratedRecoveryCodes | null>(null);
  const [recoveryCodesAvailable, setRecoveryCodesAvailable] = useState<boolean | null>(null);
  const [showRegeneration, setShowRegeneration] = useState(false);
  const [regenerationPassword, setRegenerationPassword] = useState('');
  const [regenerationCode, setRegenerationCode] = useState('');
  const [regenerationFactorId, setRegenerationFactorId] = useState('');

  const load = async () => {
    const [availableFactors, currentAssurance, recoveryResult] = await Promise.all([
      retrieveTotpFactors(),
      retrieveMfaAssurance(),
      retrieveRecoveryCodesStatus()
        .then((currentRecoveryStatus) => ({ currentRecoveryStatus, available: true }))
        .catch(() => ({ currentRecoveryStatus: null, available: false })),
    ]);
    setFactors(availableFactors);
    setAssurance(currentAssurance.currentLevel);
    setRecoveryStatus(recoveryResult.currentRecoveryStatus);
    setRecoveryCodesAvailable(recoveryResult.available);
  };

  useEffect(() => {
    void Promise.all([
      retrieveTotpFactors(),
      retrieveMfaAssurance(),
      retrieveRecoveryCodesStatus()
        .then((currentRecoveryStatus) => ({ currentRecoveryStatus, available: true }))
        .catch(() => ({ currentRecoveryStatus: null, available: false })),
    ])
      .then(([availableFactors, currentAssurance, recoveryResult]) => {
        setFactors(availableFactors);
        setAssurance(currentAssurance.currentLevel);
        setRecoveryStatus(recoveryResult.currentRecoveryStatus);
        setRecoveryCodesAvailable(recoveryResult.available);
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
      let recoveryCodeCreationFailed = false;
      const generatedCodes = recoveryStatus
        ? null
        : await generateRecoveryCodes().catch(() => {
            recoveryCodeCreationFailed = true;
            setRecoveryCodesAvailable(false);
            return null;
          });
      setEnrollment(null);
      setShowNameField(false);
      setFriendlyName('');
      setCode('');
      await load();
      if (generatedCodes) {
        setRecoveryCodes(generatedCodes);
        setRecoveryStatus(generatedCodes);
      }
      setStatus(
        generatedCodes
          ? 'Authenticator app added. Save your recovery codes now.'
          : recoveryCodeCreationFailed
            ? 'Authenticator app added, but recovery codes could not be created. Try again below.'
            : 'Authenticator app added. Other sessions were signed out by Supabase.',
      );
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : 'The code could not be verified.',
      );
    } finally {
      setBusy(false);
    }
  };

  const replaceRecoveryCodes = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!regenerationPassword) {
      setError('Enter your current password.');
      return;
    }
    if (!/^\d{6}$/.test(regenerationCode) || !regenerationFactorId) {
      setError('Enter a current six-digit authenticator code.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithPassword(regenerationPassword);
      await verifyTotpFactor(regenerationFactorId, regenerationCode);
      const generatedCodes = await regenerateRecoveryCodes();
      setRecoveryCodes(generatedCodes);
      setRecoveryStatus(generatedCodes);
      setRecoveryCodesAvailable(true);
      setShowRegeneration(false);
      setRegenerationPassword('');
      setRegenerationCode('');
      setRegenerationFactorId('');
      setStatus('Recovery codes replaced. Save the new codes now; every old code is invalid.');
    } catch (replaceError) {
      setError(
        replaceError instanceof Error
          ? replaceError.message
          : 'Recovery codes could not be replaced.',
      );
    } finally {
      setBusy(false);
    }
  };

  const copyRecoveryCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.codes.join('\n'));
      setStatus('Recovery codes copied. Store them in a secure password manager.');
    } catch {
      setError('Recovery codes could not be copied. Select and copy them manually.');
    }
  };

  const createRecoveryCodeSet = async () => {
    setBusy(true);
    setError(null);
    try {
      const generatedCodes = await generateRecoveryCodes();
      setRecoveryCodes(generatedCodes);
      setRecoveryStatus(generatedCodes);
      setRecoveryCodesAvailable(true);
      setStatus('Recovery codes created. Save them now.');
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : 'Recovery codes could not be created.',
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadRecoveryCodes = () => {
    if (!recoveryCodes) return;
    const url = URL.createObjectURL(
      new Blob([`${recoveryCodes.codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'buddy-budget-recovery-codes.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printRecoveryCodes = () => {
    const cleanup = () => document.documentElement.classList.remove('print-recovery-codes');
    document.documentElement.classList.add('print-recovery-codes');
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } catch {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
      setError('The print dialog could not be opened. Download the codes instead.');
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
    setRemovalMethod('totp');
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
      setRemovalMethod('totp');
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
    if (
      (removalMethod === 'totp' && !/^\d{6}$/.test(removalCode)) ||
      (removalMethod === 'recovery' &&
        (!removalCode.trim() || removalCode.length > 64 || !/^[a-z0-9 -]+$/i.test(removalCode)))
    ) {
      setError(
        removalMethod === 'recovery'
          ? 'Enter a valid unused recovery code.'
          : 'Enter the six-digit code from the named authenticator.',
      );
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
        (removalMethod === 'totp' && !currentVerificationFactor) ||
        (removalMethod === 'recovery' &&
          (!removal.isLastFactor || (recoveryStatus?.remaining ?? 0) < 2)) ||
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
        if (removalMethod === 'recovery') await verifyRecoveryCode(removalCode);
        else await verifyTotpFactor(removal.verificationFactorId, removalCode);
      } catch {
        clearRemoval();
        void navigate('/auth/mfa', {
          replace: true,
          state: {
            from: '/app/settings',
            reason:
              removalMethod === 'recovery'
                ? 'reauthentication-recovery-code-rejected'
                : 'reauthentication-code-rejected',
          },
        });
        return;
      }
      if (removalMethod === 'recovery') {
        const recoveryStatusAfterVerification = await retrieveRecoveryCodesStatus();
        if (!recoveryStatusAfterVerification?.remaining) {
          setRecoveryStatus(recoveryStatusAfterVerification);
          setError(
            'That was the final recovery code, so the authenticator was not removed. Contact the authorised test administrator if the authenticator is lost.',
          );
          return;
        }
        setRecoveryStatus(recoveryStatusAfterVerification);
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
      const requiresRecoveryChallenge = removal.isLastFactor && Boolean(recoveryStatus?.remaining);
      clearRemoval();
      await load();
      setAssurance(refreshedAssurance.currentLevel);
      if (requiresRecoveryChallenge) {
        void navigate('/auth/mfa', {
          replace: true,
          state: {
            from: '/app/settings',
            reason: 'authenticator-removed',
          },
        });
        return;
      }
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
              {recoveryStatus?.remaining
                ? 'This is your last authenticator app. Recovery codes will remain as your second sign-in method. Add a replacement authenticator immediately after removal.'
                : 'This is your last second sign-in method. Removing it turns off your extra sign-in check.'}
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
          {removal.isLastFactor && (recoveryStatus?.remaining ?? 0) > 1 && (
            <fieldset className="mfa-removal__method">
              <legend>Confirm with</legend>
              <label>
                <input
                  type="radio"
                  name="mfa-removal-method"
                  value="totp"
                  checked={removalMethod === 'totp'}
                  onChange={() => {
                    setRemovalMethod('totp');
                    setRemovalCode('');
                    setError(null);
                  }}
                />
                Authenticator app
              </label>
              <label>
                <input
                  type="radio"
                  name="mfa-removal-method"
                  value="recovery"
                  checked={removalMethod === 'recovery'}
                  onChange={() => {
                    setRemovalMethod('recovery');
                    setRemovalCode('');
                    setError(null);
                  }}
                />
                Unused recovery code
              </label>
            </fieldset>
          )}
          {removal.isLastFactor && recoveryStatus?.remaining === 1 && (
            <p className="muted">
              Your final recovery code cannot be used for removal because no second sign-in method
              would remain to add a replacement authenticator.
            </p>
          )}
          <FormField
            id="mfa-removal-code"
            label={
              removalMethod === 'recovery'
                ? 'Recovery code'
                : `Six-digit code from ${removal.verificationFactorName}`
            }
            inputMode={removalMethod === 'recovery' ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            pattern={removalMethod === 'recovery' ? '[A-Za-z0-9 -]+' : '[0-9]{6}'}
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
        Add a second authenticator before replacing or losing your current device. Store recovery
        codes in a secure password manager, never in Buddy Budget. If every option is lost, contact
        the test administrator; email codes are not used to bypass MFA.
      </p>
      {recoveryCodes && (
        <section className="mfa-recovery-codes" aria-labelledby="recovery-codes-heading">
          <h3 id="recovery-codes-heading">Save your recovery codes now</h3>
          <div className="inline-alert inline-alert--warning" role="status">
            Each code works once. These codes cannot be shown again after you leave this screen.
          </div>
          <ol>
            {recoveryCodes.codes.map((recoveryCode) => (
              <li key={recoveryCode}>
                <code>{recoveryCode}</code>
              </li>
            ))}
          </ol>
          <div className="settings-card__actions">
            <Button type="button" onClick={() => void copyRecoveryCodes()}>
              Copy all
            </Button>
            <Button type="button" variant="secondary" onClick={downloadRecoveryCodes}>
              Download
            </Button>
            <Button type="button" variant="secondary" onClick={printRecoveryCodes}>
              Print codes
            </Button>
            <Button type="button" variant="ghost" onClick={() => setRecoveryCodes(null)}>
              I saved them
            </Button>
          </div>
        </section>
      )}
      {!recoveryCodes && recoveryCodesAvailable && recoveryStatus && (
        <section className="mfa-recovery-summary" aria-labelledby="recovery-summary-heading">
          <h3 id="recovery-summary-heading">Recovery codes</h3>
          <p>
            {recoveryStatus.remaining} of {recoveryStatus.total} unused codes remain.
          </p>
          {showRegeneration ? (
            <form onSubmit={(event) => void replaceRecoveryCodes(event)}>
              <div className="inline-alert inline-alert--warning">
                Replacing the set immediately invalidates every old recovery code.
              </div>
              <PasswordField
                id="recovery-regeneration-password"
                label="Current password"
                autoComplete="current-password"
                value={regenerationPassword}
                onChange={(event) => setRegenerationPassword(event.target.value)}
              />
              {factors.length > 1 && (
                <label className="field">
                  <span className="field__label">Authenticator app</span>
                  <select
                    className="input"
                    value={regenerationFactorId}
                    onChange={(event) => setRegenerationFactorId(event.target.value)}
                  >
                    {factors.map((factor) => (
                      <option key={factor.id} value={factor.id}>
                        {getTotpFactorDisplayName(factor)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <FormField
                id="recovery-regeneration-code"
                label="Current six-digit authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                value={regenerationCode}
                onChange={(event) => setRegenerationCode(event.target.value)}
              />
              <div className="settings-card__actions">
                <Button type="submit" loading={busy} variant="danger">
                  Replace recovery codes
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowRegeneration(false)}>
                  Keep current codes
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={assurance !== 'aal2' || factors.length === 0}
              onClick={() => {
                setRegenerationFactorId(factors[0]?.id ?? '');
                setShowRegeneration(true);
              }}
            >
              Replace recovery codes
            </Button>
          )}
        </section>
      )}
      {!recoveryCodes && recoveryCodesAvailable && !recoveryStatus && factors.length > 0 && (
        <section className="mfa-recovery-summary" aria-labelledby="recovery-create-heading">
          <h3 id="recovery-create-heading">Recovery codes</h3>
          <p>Create one-time codes to use if your authenticator is unavailable.</p>
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            disabled={assurance !== 'aal2'}
            onClick={() => void createRecoveryCodeSet()}
          >
            Create recovery codes
          </Button>
        </section>
      )}
      {recoveryCodesAvailable === false && factors.length > 0 && (
        <p className="muted">
          Recovery codes are not enabled for this Supabase project. Add a second authenticator as
          your backup method.
        </p>
      )}
      {error && !enrollment && !showNameField && !removal && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {status && <div role="status">{status}</div>}
    </section>
  );
};
