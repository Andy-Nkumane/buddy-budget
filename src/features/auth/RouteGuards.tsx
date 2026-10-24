import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { retrievePreferences } from '../../data/repositories/budgetRepository';
import { queryKeys } from '../../data/queryKeys';
import { ErrorState, LoadingState } from '../../shared/ui/AsyncState';
import { retrieveMfaAssurance } from './mfa';

export const RequireAuthentication = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Restoring your session…" />;
  if (!session)
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
        to="/auth/sign-in"
      />
    );
  return <Outlet />;
};

export const RequireMfa = () => {
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'ready' | 'challenge' | 'error'>('checking');

  useEffect(() => {
    let active = true;
    void retrieveMfaAssurance()
      .then(({ currentLevel, nextLevel }) => {
        if (!active) return;
        setState(currentLevel === 'aal1' && nextLevel === 'aal2' ? 'challenge' : 'ready');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (state === 'checking') return <LoadingState label="Checking account security…" />;
  if (state === 'error')
    return <ErrorState message="Your account security could not be verified." />;
  if (state === 'challenge') {
    return (
      <Navigate
        replace
        to="/auth/mfa"
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }
  return <Outlet />;
};

export const RedirectAuthenticated = () => {
  const { session, loading } = useAuth();
  if (loading) return <LoadingState label="Restoring your session…" />;
  if (session) return <Navigate replace to="/app" />;
  return <Outlet />;
};

export const RequireOnboarding = () => {
  const { session } = useAuth();
  const preferences = useQuery({
    queryKey: queryKeys.preferences(session?.user.id ?? ''),
    queryFn: retrievePreferences,
  });
  if (preferences.isLoading) return <LoadingState label="Preparing your budget…" />;
  if (!preferences.data?.onboarding_completed_at) return <Navigate replace to="/onboarding" />;
  return <Outlet />;
};

export const RequireIncompleteOnboarding = () => {
  const { session } = useAuth();
  const preferences = useQuery({
    queryKey: queryKeys.preferences(session?.user.id ?? ''),
    queryFn: retrievePreferences,
  });
  if (preferences.isLoading) return <LoadingState label="Preparing your setup…" />;
  if (preferences.error)
    return (
      <ErrorState
        message="We couldn't verify your setup status."
        retry={() => void preferences.refetch()}
      />
    );
  if (preferences.data?.onboarding_completed_at) return <Navigate replace to="/app" />;
  return <Outlet />;
};

export const AppHome = () => {
  const { session } = useAuth();
  const preferences = useQuery({
    queryKey: queryKeys.preferences(session?.user.id ?? ''),
    queryFn: retrievePreferences,
  });
  if (preferences.isLoading) return <LoadingState />;
  if (!preferences.data?.onboarding_completed_at) return <Navigate replace to="/onboarding" />;
  const lastRoute = preferences.data.last_route;
  const destination = lastRoute?.startsWith('/app/') ? lastRoute : '/app/budget/current';
  return <Navigate replace to={destination} />;
};
