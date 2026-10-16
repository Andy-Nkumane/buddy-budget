import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/routing/AppRouter';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('BuddyBudget root element is missing.');

const normalizedPath = window.location.pathname.replace(/\/+$/, '');
const demoPath = `${import.meta.env.BASE_URL}demo`.replace(/\/+$/, '');
const calculatorPath = `${import.meta.env.BASE_URL}calculator`.replace(/\/+$/, '');
const sharedReportPath = `${import.meta.env.BASE_URL}shared-report`.replace(/\/+$/, '');
const privacyPath = `${import.meta.env.BASE_URL}privacy`.replace(/\/+$/, '');
const termsPath = `${import.meta.env.BASE_URL}terms`.replace(/\/+$/, '');
const disclaimerPath = `${import.meta.env.BASE_URL}disclaimer`.replace(/\/+$/, '');
const contactPath = `${import.meta.env.BASE_URL}contact`.replace(/\/+$/, '');
const publicRoute = window.location.search.match(
  /^\?\/(demo|calculator|shared-report|template|privacy|terms|disclaimer|contact)\/?(?:&|$)/,
)?.[1];
const isDirectPublicVisit =
  normalizedPath === demoPath ||
  normalizedPath === calculatorPath ||
  normalizedPath === sharedReportPath ||
  normalizedPath === privacyPath ||
  normalizedPath === termsPath ||
  normalizedPath === disclaimerPath ||
  normalizedPath === contactPath ||
  publicRoute === 'demo' ||
  publicRoute === 'calculator' ||
  publicRoute === 'shared-report' ||
  publicRoute === 'privacy' ||
  publicRoute === 'terms' ||
  publicRoute === 'disclaimer' ||
  publicRoute === 'contact';

createRoot(root).render(
  <StrictMode>
    {isDirectPublicVisit ? (
      <AppRouter />
    ) : (
      <AppProviders>
        <AppRouter />
      </AppProviders>
    )}
  </StrictMode>,
);
