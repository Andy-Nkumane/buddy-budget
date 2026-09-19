import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layout/AppLayout';
import {
  AppHome,
  RedirectAuthenticated,
  RequireAuthentication,
  RequireOnboarding,
} from '../../features/auth/RouteGuards';
import { AuthLayout } from '../../features/auth/AuthLayout';
import { LandingPage } from '../../features/landing/LandingPage';
import { LoadingState } from '../../shared/ui/AsyncState';

const AuthCallbackPage = lazy(() =>
  import('../../features/auth/AuthCallbackPage').then((module) => ({
    default: module.AuthCallbackPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import('../../features/auth/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const RegisterPage = lazy(() =>
  import('../../features/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const ResetPasswordPage = lazy(() =>
  import('../../features/auth/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const SignInPage = lazy(() =>
  import('../../features/auth/SignInPage').then((module) => ({ default: module.SignInPage })),
);
const BudgetPage = lazy(() =>
  import('../../features/budgets/BudgetPage').then((module) => ({ default: module.BudgetPage })),
);
const MonthsPage = lazy(() =>
  import('../../features/budgets/MonthsPage').then((module) => ({ default: module.MonthsPage })),
);
const CategoriesPage = lazy(() =>
  import('../../features/categories/CategoriesPage').then((module) => ({
    default: module.CategoriesPage,
  })),
);
const HelpPage = lazy(() =>
  import('../../features/help/HelpPage').then((module) => ({ default: module.HelpPage })),
);
const OnboardingPage = lazy(() =>
  import('../../features/onboarding/OnboardingPage').then((module) => ({
    default: module.OnboardingPage,
  })),
);
const SettingsPage = lazy(() =>
  import('../../features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);
const TemplatesPage = lazy(() =>
  import('../../features/templates/TemplatesPage').then((module) => ({
    default: module.TemplatesPage,
  })),
);

const restorePagesRoute = () => {
  const query = window.location.search;
  if (!query.startsWith('?/')) return;
  const decoded = query
    .slice(2)
    .split('&')
    .map((part) => part.replace(/~and~/g, '&'));
  const route = `/${decoded.shift() ?? ''}`;
  const search = decoded.length ? `?${decoded.join('&')}` : '';
  window.history.replaceState(
    null,
    '',
    `${import.meta.env.BASE_URL}${route.replace(/^\//, '')}${search}${window.location.hash}`,
  );
};

restorePagesRoute();

export const AppRouter = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<RedirectAuthenticated />}>
          <Route path="/" element={<LandingPage />} />
        </Route>
        <Route path="/auth" element={<AuthLayout />}>
          <Route index element={<Navigate replace to="sign-in" />} />
          <Route element={<RedirectAuthenticated />}>
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="callback" element={<AuthCallbackPage />} />
        </Route>
        <Route element={<RequireAuthentication />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/app" element={<AppHome />} />
          <Route element={<RequireOnboarding />}>
            <Route path="/app" element={<AppLayout />}>
              <Route path="budget/:monthStart" element={<BudgetPage />} />
              <Route path="months" element={<MonthsPage />} />
              <Route path="templates" element={<TemplatesPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="help" element={<HelpPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
