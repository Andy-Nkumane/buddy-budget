import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

const auth = vi.hoisted(() => ({
  listener: null as ((event: AuthChangeEvent, session: Session | null) => void) | null,
  getSession: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../../data/supabase/client', () => ({
  configurationError: null,
  supabase: {
    auth: {
      getSession: auth.getSession,
      signOut: auth.signOut,
      onAuthStateChange: vi.fn(
        (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
          auth.listener = listener;
          return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
        },
      ),
    },
  },
}));

const sessionFor = (id: string) => ({ user: { id } }) as Session;

const SessionView = () => <span>{useAuth().session?.user.id ?? 'signed-out'}</span>;

describe('AuthProvider', () => {
  it('clears private query data when the authenticated account changes', async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessionFor('user-a') }, error: null });
    const queryClient = new QueryClient();
    queryClient.setQueryData(['profile'], { display_name: 'User A' });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SessionView />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText('user-a')).toBeInTheDocument();
    act(() => auth.listener?.('SIGNED_OUT', null));
    expect(queryClient.getQueryData(['profile'])).toBeUndefined();
    expect(screen.getByText('signed-out')).toBeInTheDocument();
  });

  it('uses local-only sign-out after authoritative account deletion', async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessionFor('user-a') }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    const queryClient = new QueryClient();
    queryClient.setQueryData(['budget'], { private: true });
    const ClearSession = () => {
      const { signOut } = useAuth();
      return <button onClick={() => void signOut({ scope: 'local' })}>Clear session</button>;
    };
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ClearSession />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await screen.findByRole('button', { name: 'Clear session' });
    act(() => screen.getByRole('button', { name: 'Clear session' }).click());

    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(queryClient.getQueryData(['budget'])).toBeUndefined();
  });
});
