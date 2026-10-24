import type { Factor } from '@supabase/supabase-js';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import {
  createTotpEnrollment,
  deleteTotpFactor,
  retrieveMfaAssurance,
  retrieveTotpFactors,
  verifyTotpFactor,
  type TotpEnrollment,
} from '../auth/mfa';

export const MfaSettings = () => {
  const [factors, setFactors] = useState<Factor<'totp', 'verified'>[]>([]);
  const [assurance, setAssurance] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [removeFactorId, setRemoveFactorId] = useState<string | null>(null);
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

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      setEnrollment(await createTotpEnrollment());
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
      setCode('');
    } catch (cancelError) {
      setError(
        cancelError instanceof Error ? cancelError.message : 'Setup could not be cancelled.',
      );
    } finally {
      setBusy(false);
    }
  };

  const removeFactor = async () => {
    if (!removeFactorId) return;
    setBusy(true);
    setError(null);
    try {
      await deleteTotpFactor(removeFactorId);
      setRemoveFactorId(null);
      await load();
      setStatus('Authenticator app removed.');
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
        {factors.map((factor, index) => (
          <li key={factor.id}>
            <span>{factor.friendly_name || `Authenticator app ${index + 1}`}</span>
            {removeFactorId === factor.id ? (
              <span className="mfa-factor-list__actions">
                <Button variant="danger" disabled={busy} onClick={() => void removeFactor()}>
                  Confirm removal
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setRemoveFactorId(null)}>
                  Keep it
                </Button>
              </span>
            ) : (
              <Button
                variant="secondary"
                disabled={busy || assurance !== 'aal2'}
                onClick={() => setRemoveFactorId(factor.id)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
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
      ) : (
        <Button variant="secondary" loading={busy} onClick={() => void startEnrollment()}>
          {factors.length ? 'Add another authenticator' : 'Set up authenticator'}
        </Button>
      )}
      <p className="privacy-note">
        Add a second authenticator before replacing or losing your current device. If every device
        is lost, recovery requires the test administrator; Buddy Budget does not issue recovery
        codes yet.
      </p>
      {error && !enrollment && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {status && <div role="status">{status}</div>}
    </section>
  );
};
