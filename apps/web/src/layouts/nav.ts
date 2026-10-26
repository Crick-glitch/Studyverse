import type { NavIconId } from '../features/art/sprites/icons';

export interface NavItem {
  to: string;
  label: string;
  icon: NavIconId;
  /** Match only the exact path (the dashboard lives at "/"). */
  end?: boolean;
}

/** Every route that appears in the sidebar, in order. The pixel icon is looked up by the same id in the manifest. */
export const NAV: readonly NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/quests', label: 'Quest Board', icon: 'quests' },
  { to: '/sessions', label: 'Sessions', icon: 'sessions' },
  { to: '/lab', label: 'Lab', icon: 'lab' },
  { to: '/camp', label: 'Camp', icon: 'camp' },
  { to: '/dungeons', label: 'Dungeons', icon: 'dungeons' },
  { to: '/stats', label: 'Stats', icon: 'stats' },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];
