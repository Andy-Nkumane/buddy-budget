import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { Factor } from '@supabase/supabase-js';
import { Button } from '../../shared/ui/Button';
import { FormField } from '../../shared/ui/FormField';
import { LoadingState } from '../../shared/ui/AsyncState';
import { retrieveMfaAssurance, retrieveTotpFactors, verifyTotpFactor } from './mfa';
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
  const destination = (location.state as { from?: string } | null)?.from;
  const safeDestination =
    destination === '/app' || destination?.startsWith('/app/') ? destination : '/app';

  useEffect(() => {
    let active = true;
    void Promise.all([retrieveMfaAssurance(), retrieveTotpFactors()])
      .then(([assurance, availableFactors]) => {
        if (!active) return;
        if (assurance.currentLevel === 'aal2' || assurance.nextLevel !== 'aal2') {
          setComplete(true);
          return;
        }
        setFactors(availableFactors);
        setSelectedFactorId(availableFactors[0]?.id ?? '');
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
    if (!selectedFactorId || !/^\d{6}$/.test(code)) {
      setError('Enter the six-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await verifyTotpFactor(selectedFactorId, code);
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
      <h2>Verify with your authenticator</h2>
      <p className="muted">
        Enter the current code from an authenticator app you added to Buddy Budget.
      </p>
      {factors && factors.length > 1 && (
        <label className="field">
          <span className="field__label">Authenticator app</span>
          <select
            className="input"
            value={selectedFactorId}
            onChange={(event) => setSelectedFactorId(event.target.value)}
          >
            {factors.map((factor, index) => (
              <option key={factor.id} value={factor.id}>
                {factor.friendly_name || `Authenticator app ${index + 1}`}
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
      {factors && factors.length === 0 ? (
        <p>There is no verified authenticator available. Contact the test administrator.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} noValidate>
          <FormField
            label="Six-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button className="button--wide" loading={submitting} type="submit">
            Verify and continue
          </Button>
        </form>
      )}
      <Button variant="ghost" onClick={() => void leaveSession()}>
        Sign out
      </Button>
    </div>
  );
};
