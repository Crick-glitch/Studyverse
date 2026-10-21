import {
  BookOpen,
  Castle,
  Flame,
  FlaskConical,
  Home,
  Menu,
  ScrollText,
  Settings,
  Swords,
  Trophy,
  BarChart3,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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
          <NavLink to="/login" className={styles.link} onClick={() => setOpen(false)}>
            <Flame aria-hidden size={16} /> Log in
          </NavLink>
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
