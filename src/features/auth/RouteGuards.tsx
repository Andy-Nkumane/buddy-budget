import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider';
import { retrievePreferences } from '../../data/repositories/budgetRepository';
import { queryKeys } from '../../data/queryKeys';
import { LoadingState } from '../../shared/ui/AsyncState';

export const RequireAuthentication = () => {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Restoring your session…" />;
  if (!session) return <Navigate replace state={{ from: location.pathname }} to="/auth/sign-in" />;
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
