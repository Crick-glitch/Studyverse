import {
  BookOpen,
  Castle,
  FlaskConical,
  LogOut,
  Home,
  Menu,
  ScrollText,
  Settings,
  Swords,
  Trophy,
  BarChart3,
  Timer,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LocalImportPrompt } from '../features/import/LocalImportPrompt';
import { api } from '../lib/api';
import styles from './AppLayout.module.css';

const NAV = [
  { to: '/', label: 'Dashboard', icon: Home, end: true },
  { to: '/quests', label: 'Quest Board', icon: ScrollText },
  { to: '/sessions', label: 'Sessions', icon: Timer },
  { to: '/lab', label: 'Lab', icon: FlaskConical },
  { to: '/camp', label: 'Camp', icon: Castle },
  { to: '/dungeons', label: 'Dungeons', icon: Swords },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

/** Real data from GET /me (the first call also creates the player's profile server-side). */
function PlayerChip() {
  const { signOut } = useAuth();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  return (
    <span className={styles.player}>
      {me.isPending && <span>Loading…</span>}
      {me.isError && (
        <span role="alert" title={me.error.message}>
          Profile unavailable
        </span>
      )}
      {me.data && (
        <span className={styles.playerName}>
          {me.data.profile.displayName} · Lv {me.data.progress.level}
        </span>
      )}
      <button type="button" className={styles.signOut} onClick={() => void signOut()}>
        <LogOut aria-hidden size={14} /> Log out
      </button>
    </span>
  );
}

/** Offers the old-save import once the player's id is known (never imports by itself). */
function ImportGate() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  return me.data ? <LocalImportPrompt userId={me.data.user.id} /> : null;
}

export function AppLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <BookOpen aria-hidden size={22} /> StudyVerse
        </span>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <Menu aria-hidden size={22} />
          <span className={styles.srOnly}>Toggle navigation</span>
        </button>
        <nav id="main-nav" aria-label="Main" className={`${styles.nav} ${open ? styles.open : ''}`}>
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon aria-hidden size={16} /> {label}
            </NavLink>
          ))}
          <PlayerChip />
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <ImportGate />
    </div>
  );
}
