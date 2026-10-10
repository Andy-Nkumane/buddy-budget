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
const publicRoute = window.location.search.match(/^\?\/(demo|calculator)\/?(?:&|$)/)?.[1];
const isDirectPublicVisit =
  normalizedPath === demoPath ||
  normalizedPath === calculatorPath ||
  publicRoute === 'demo' ||
  publicRoute === 'calculator';

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
