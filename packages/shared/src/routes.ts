/** Route table shared by the web router and any future link generation. */
export const ROUTES = {
  dashboard: '/',
  quests: '/quests',
  sessions: '/sessions',
  lab: '/lab',
  camp: '/camp',
  dungeons: '/dungeons',
  battle: '/battle/:battleId',
  stats: '/stats',
  leaderboard: '/leaderboard',
  settings: '/settings',
  login: '/login',
} as const;
