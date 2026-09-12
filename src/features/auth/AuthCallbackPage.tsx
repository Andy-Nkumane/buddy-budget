import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { requireSupabase } from '../../data/supabase/client';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';

export const AuthCallbackPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const code = params.get('code');
  const [error, setError] = useState<string | null>(
    code ? null : 'The verification link is missing its authorization code. Request a new email.',
  );

  useEffect(() => {
    if (!code) return;
    void requireSupabase()
      .auth.exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) setError(exchangeError.message);
        else void navigate('/app', { replace: true });
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Verification failed.'),
      );
  }, [code, navigate]);

  return error ? <ErrorState message={error} /> : <LoadingState label="Verifying your account…" />;
};
