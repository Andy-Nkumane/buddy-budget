import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Factor } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { LoadingState } from '../../shared/ui/AsyncState';
import {
  getTotpFactorDisplayName,
  retrieveMfaAssurance,
  retrieveRecoveryCodesStatus,
  retrieveTotpFactors,
  verifyRecoveryCode,
  verifyTotpFactor,
} from './mfa';
import { useAuth } from '../../app/providers/AuthProvider';

export const MfaChallengePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [factors, setFactors] = useState<Factor<'totp', 'verified'>[] | null>(null);
  const [selectedFactorId, setSelectedFactorId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const challengeState = location.state as {
    from?: string;
    reason?:
      | 'reauthentication-code-rejected'
      | 'reauthentication-recovery-code-rejected'
      | 'authenticator-removed';
  } | null;
  const destination = challengeState?.from;
  const safeDestination =
    destination === '/app' || destination?.startsWith('/app/') ? destination : '/app';

  useEffect(() => {
    let active = true;
    void Promise.all([
      retrieveMfaAssurance(),
      retrieveTotpFactors(),
      retrieveRecoveryCodesStatus().catch(() => null),
    ])
      .then(([assurance, availableFactors, recoveryStatus]) => {
        if (!active) return;
        if (assurance.currentLevel === 'aal2' || assurance.nextLevel !== 'aal2') {
          setComplete(true);
          return;
        }
        setFactors(availableFactors);
        setSelectedFactorId(availableFactors[0]?.id ?? '');
        setRecoveryAvailable(Boolean(recoveryStatus?.remaining));
        setUseRecoveryCode(availableFactors.length === 0 && Boolean(recoveryStatus?.remaining));
      })
      .catch(() => {
        if (active) setError('Your authenticator challenge could not be loaded. Try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (useRecoveryCode) {
      if (!code.trim() || code.length > 64 || !/^[a-z0-9 -]+$/i.test(code)) {
        setError('Enter a valid recovery code.');
        return;
      }
    } else if (!selectedFactorId || !/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (useRecoveryCode) await verifyRecoveryCode(code);
      else await verifyTotpFactor(selectedFactorId, code);
      void navigate(safeDestination, { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'That verification code could not be confirmed.',
      );
    } finally {
      setSubmitting(false);
      setCode('');
    }
  };

  const leaveSession = async () => {
    setError(null);
    try {
      await signOut({ scope: 'local' });
      void navigate('/auth/sign-in', { replace: true });
    } catch {
      setError('This browser could not sign out. Close Buddy Budget and clear this site’s data.');
    }
  };

  if (complete) return <Navigate replace to={safeDestination} />;
  if (!factors && !error) return <LoadingState label="Checking your authenticator…" />;

  return (
    <div className="auth-card">
      <p className="eyebrow">Extra sign-in check</p>
      <h2>{useRecoveryCode ? 'Use a recovery code' : 'Verify with your authenticator'}</h2>
      <p className="muted">
        {useRecoveryCode
          ? 'Enter one unused recovery code. A successful code can never be used again.'
          : 'Enter the current code from an authenticator app you added to Buddy Budget.'}
      </p>
      {challengeState?.reason === 'reauthentication-code-rejected' && (
        <div className="inline-alert inline-alert--warning" role="status">
          Your password was confirmed, but the authenticator code was not. Verify with a current
          code to continue.
        </div>
      )}
      {challengeState?.reason === 'reauthentication-recovery-code-rejected' && (
        <div className="inline-alert inline-alert--warning" role="status">
          Your password was confirmed, but that recovery code was not accepted. Use an unused
          recovery code or an available authenticator to continue.
        </div>
      )}
      {challengeState?.reason === 'authenticator-removed' && (
        <div className="inline-alert inline-alert--warning" role="status">
          The lost authenticator was removed. Use another recovery code to continue, then add a new
          authenticator in Settings.
        </div>
      )}
      {!useRecoveryCode && factors && factors.length > 1 && (
        <label className="field">
          <span className="field__label">Authenticator app</span>
          <select
            className="input"
            value={selectedFactorId}
            onChange={(event) => setSelectedFactorId(event.target.value)}
          >
            {factors.map((factor) => (
              <option key={factor.id} value={factor.id}>
                {getTotpFactorDisplayName(factor)}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <div className="inline-alert inline-alert--error" role="alert">
          {error}
        </div>
      )}
      {!useRecoveryCode && factors && factors.length === 0 ? (
        <p>There is no verified authenticator available. Contact the test administrator.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <FormField
            label={useRecoveryCode ? 'Recovery code' : 'Six-digit code'}
            inputMode={useRecoveryCode ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            pattern={useRecoveryCode ? '[A-Za-z0-9 -]+' : '[0-9]{6}'}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button className="button--wide" loading={submitting} type="submit">
            Verify and continue
          </Button>
        </form>
      )}
      {recoveryAvailable && (
        <Button
          variant="ghost"
          type="button"
          onClick={() => {
            setUseRecoveryCode((current) => !current);
            setCode('');
            setError(null);
          }}
        >
          {useRecoveryCode ? 'Use an authenticator app' : 'Use a recovery code'}
        </Button>
      )}
      <Button variant="ghost" onClick={() => void leaveSession()}>
        Sign out
      </Button>
    </div>
  );
};
