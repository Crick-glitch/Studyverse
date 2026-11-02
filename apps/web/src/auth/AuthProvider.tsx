import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, supabaseConfigError } from '../lib/supabase';
import { AuthContext, type AuthValue } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthValue['signIn']>(async (email, password) => {
    if (!supabase) return supabaseConfigError;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }, []);

  const signUp = useCallback<AuthValue['signUp']>(async (email, password) => {
    if (!supabase) return { error: supabaseConfigError, needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error: error ? error.message : null, needsConfirmation: !error && !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    queryClient.clear(); // never keep one player's data in memory for the next
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      status: loading ? 'loading' : session ? 'signedIn' : 'signedOut',
      email: session?.user.email ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [loading, session, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
