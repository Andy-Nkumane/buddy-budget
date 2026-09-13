import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { configurationError, supabase } from '../../data/supabase/client';
import { BrandMark } from '../../shared/ui/BrandMark';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  sessionMessage: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const manualSignOut = useRef(false);
  const authenticatedUserId = useRef<string | null>(null);

  const applySession = useCallback(
    (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (authenticatedUserId.current && authenticatedUserId.current !== nextUserId) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      authenticatedUserId.current = nextUserId;
      setSession(nextSession);
    },
    [queryClient],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error)
        setSessionMessage('Your saved session could not be restored. Please sign in again.');
      applySession(data.session);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession);
      setLoading(false);
      if (event === 'SIGNED_OUT' && !manualSignOut.current) {
        setSessionMessage('Your session ended. Please sign in again.');
      }
      if (event === 'SIGNED_OUT') manualSignOut.current = false;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setSessionMessage(null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      sessionMessage,
      signOut: async () => {
        if (!supabase) return;
        manualSignOut.current = true;
        const { error } = await supabase.auth.signOut();
        if (error) {
          manualSignOut.current = false;
          throw error;
        }
      },
    }),
    [loading, session, sessionMessage],
  );

  if (configurationError) {
    return (
      <main className="configuration-page">
        <div className="configuration-card">
          <BrandMark />
          <p className="eyebrow">Configuration needed</p>
          <h1>Connect Buddy Budget to Supabase</h1>
          <p>{configurationError}</p>
          <pre>
            VITE_SUPABASE_URL={''}
            {'\n'}VITE_SUPABASE_PUBLISHABLE_KEY={''}
            {'\n'}VITE_BASE_PATH=/
          </pre>
          <p className="muted">
            Only use a browser-safe publishable key. Never add a secret or service-role key.
          </p>
        </div>
      </main>
    );
  }

  return <AuthContext value={value}>{children}</AuthContext>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
};
