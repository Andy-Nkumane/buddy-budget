import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/routing/AppRouter';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('BuddyBudget root element is missing.');

const normalizedPath = window.location.pathname.replace(/\/+$/, '');
const demoPath = `${import.meta.env.BASE_URL}demo`.replace(/\/+$/, '');
const isDirectDemoVisit =
  normalizedPath === demoPath ||
  window.location.search === '?/demo' ||
  window.location.search === '?/demo/';

createRoot(root).render(
  <StrictMode>
    {isDirectDemoVisit ? (
      <AppRouter />
    ) : (
      <AppProviders>
        <AppRouter />
      </AppProviders>
    )}
  </StrictMode>,
);
