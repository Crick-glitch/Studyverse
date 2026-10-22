import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabaseConfigError } from '../lib/supabase';
import styles from './Login.module.css';

type Mode = 'signIn' | 'signUp';

export function Login() {
  const { status, signIn, signUp } = useAuth();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (status === 'signedIn') {
    const from = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === 'signIn') {
      setError(await signIn(email.trim(), password));
    } else {
      const r = await signUp(email.trim(), password);
      setError(r.error);
      if (!r.error && r.needsConfirmation)
        setNotice('Check your email to confirm your account, then log in.');
    }
    setBusy(false);
  };

  const disabled = busy || Boolean(supabaseConfigError);
  return (
    <div className={styles.wrap}>
      <section className={styles.panel} aria-labelledby="login-title">
        <h1 id="login-title">Log in</h1>
        {supabaseConfigError && (
          <p role="alert" className={styles.error}>
            {supabaseConfigError}
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className={styles.notice}>
            {notice}
          </p>
        )}
        <form onSubmit={submit}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.button} disabled={disabled}>
              {mode === 'signIn' ? 'Log in' : 'Create account'}
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.secondary}`}
              onClick={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setError(null);
                setNotice(null);
              }}
            >
              {mode === 'signIn' ? 'Need an account?' : 'Have an account?'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
