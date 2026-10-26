import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BattleBackground } from '../features/art/components';
import { PixelButton, PixelPanel } from '../features/art/kit';
import { Sprite } from '../features/art/components/Sprite';
import { supabaseConfigError } from '../lib/supabase';
import common from '../ui/common.module.css';
import styles from './Login.module.css';

/** The camp backdrop is 320 art pixels wide; pick the smallest whole scale that covers the window (max 6). */
const sceneScaleFor = (width: number): number => Math.min(6, Math.max(2, Math.ceil(width / 320)));

function useSceneScale(): number {
  const [scale, setScale] = useState(() => sceneScaleFor(typeof window === 'undefined' ? 1280 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setScale(sceneScaleFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

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
  const scale = useSceneScale();

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
      <div className={styles.backdrop} aria-hidden="true">
        <BattleBackground id="scene.camp" scale={scale} label="" />
      </div>
      <div className={styles.column}>
        <p className={styles.brand}>
          <Sprite id="ui.crest" scale={3} decorative />
          StudyVerse
        </p>
        <PixelPanel tone="parchment" className={styles.panel} aria-labelledby="login-title">
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
          <form onSubmit={submit} className={common.stack}>
            <div className={styles.field}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className={common.input}
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
                className={common.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className={styles.actions}>
              <PixelButton type="submit" variant="primary" disabled={disabled}>
                {mode === 'signIn' ? 'Log in' : 'Create account'}
              </PixelButton>
              <PixelButton
                onClick={() => {
                  setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                  setError(null);
                  setNotice(null);
                }}
              >
                {mode === 'signIn' ? 'Need an account?' : 'Have an account?'}
              </PixelButton>
            </div>
          </form>
        </PixelPanel>
      </div>
    </div>
  );
}
