import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthValue {
  status: AuthStatus;
  email: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Resolves to an error message, or null. `needsConfirmation` when the project requires email confirmation. */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
