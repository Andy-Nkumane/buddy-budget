import {
  BookOpen,
  CalendarDays,
  CalendarClock,
  CircleDollarSign,
  LayoutTemplate,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Tags,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  retrievePreferences,
  retrieveProfile,
  updateLastLocation,
} from '../../data/repositories/budgetRepository';
import { PwaStatus } from '../../pwa/PwaStatus';
import { useEnsureCurrentMonth } from '../../features/budgets/useEnsureCurrentMonth';
import { Button } from '../../shared/ui/Button';
import { BrandMark } from '../../shared/ui/BrandMark';
import { useAuth } from '../providers/AuthProvider';
import { queryKeys } from '../../data/queryKeys';

const navigation = [
  { to: '/app/budget/current', label: 'Budget', icon: CircleDollarSign },
  { to: '/app/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/app/cash-flow', label: 'Cash flow', icon: CalendarClock },
  { to: '/app/months', label: 'Months', icon: CalendarDays },
  { to: '/app/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/app/categories', label: 'Categories', icon: Tags },
  { to: '/app/settings', label: 'Settings', icon: Settings },
  { to: '/app/help', label: 'How it works', icon: BookOpen },
];

const Navigation = ({ close }: { close?: () => void }) => (
  <nav className="primary-nav" aria-label="Primary navigation">
    {navigation.map(({ to, label, icon: Icon }) => (
      <NavLink
        className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
        key={to}
        onClick={close}
        to={to}
      >
        <Icon aria-hidden="true" size={20} />
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);

export const AppLayout = () => {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const userId = session?.user.id ?? '';
  const preferences = useQuery({
    queryKey: queryKeys.preferences(userId),
    queryFn: retrievePreferences,
  });
  const profile = useQuery({ queryKey: queryKeys.profile(userId), queryFn: retrieveProfile });
  useEnsureCurrentMonth();
  const accountName = profile.data?.display_name?.trim() || session?.user.email || 'Account';
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void updateLastLocation(`${location.pathname}${location.search}`).catch(() => undefined);
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.data?.theme ?? 'system';
  }, [preferences.data?.theme]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/app/budget/current" aria-label="Buddy Budget home">
          <BrandMark />
          <span>
            <strong>Buddy Budget</strong>
            <small>Your month. Under control.</small>
          </span>
        </NavLink>
        <Navigation />
        <footer className="sidebar__account">
          <span className="avatar" aria-hidden="true">
            {accountName.slice(0, 1).toUpperCase()}
          </span>
          <span className="sidebar__account-name" title={accountName}>
            {accountName}
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            onClick={() => void handleSignOut()}
          >
            <LogOut aria-hidden="true" size={19} />
          </button>
        </footer>
      </aside>

      <header className="mobile-header">
        <NavLink className="brand" to="/app/budget/current">
          <BrandMark />
          <strong>Buddy Budget</strong>
        </NavLink>
        <div className="mobile-header__actions">
          <span className="avatar mobile-header__avatar" aria-label={`Signed in as ${accountName}`}>
            {accountName.slice(0, 1).toUpperCase()}
          </span>
          <button
            className="icon-button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-drawer">
          <Navigation close={() => setMenuOpen(false)} />
          <Button
            icon={<LogOut aria-hidden="true" size={18} />}
            onClick={() => void handleSignOut()}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>
      )}

      <main className="app-main" id="main-content">
        {accountError && (
          <div className="inline-alert inline-alert--error" role="alert">
            {accountError}
          </div>
        )}
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink
            className={({ isActive }) =>
              `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
            }
            key={to}
            to={to}
          >
            <Icon aria-hidden="true" size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <PwaStatus />
    </div>
  );
};
