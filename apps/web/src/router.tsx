import { lazy, Suspense } from 'react';
import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { LabPage } from './features/lab/LabPage';
import { QuestBoardPage } from './features/quests/QuestBoardPage';
import { SessionsPage } from './features/sessions/SessionsPage';
import { AppLayout } from './layouts/AppLayout';
import { BattleLayout } from './layouts/BattleLayout';
import { ComingSoon } from './pages/ComingSoon';
import { Login } from './pages/Login';

// Development-only art review. The `lazy` import lives inside a function that is only called when
// `import.meta.env.DEV` is true, so production builds drop the whole chunk.
function devArtRoute(): RouteObject {
  const DevArtPage = lazy(() => import('./features/art/dev/DevArtPage'));
  return {
    path: 'dev/art',
    element: (
      <Suspense fallback={<p>Loading art review...</p>}>
        <DevArtPage />
      </Suspense>
    ),
  };
}
const devRoutes: RouteObject[] = import.meta.env.DEV ? [devArtRoute()] : [];

export const routes: RouteObject[] = [
  { path: 'login', element: <Login /> },
  ...devRoutes,
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: (
              <ComingSoon
                title="Dashboard"
                icon="dashboard"
                phase="Phase 6"
                description="Level, XP, streak, active session, quests and your next best action will appear here once the API and game systems exist."
              />
            ),
          },
          { path: 'quests', element: <QuestBoardPage /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'lab', element: <LabPage /> },
          {
            path: 'camp',
            element: (
              <ComingSoon
                title="Camp"
                icon="camp"
                phase="Phase 6"
                description="Hero, class, inventory and skill tree."
              />
            ),
          },
          {
            path: 'dungeons',
            element: (
              <ComingSoon
                title="Dungeons"
                icon="dungeons"
                phase="Phase 5"
                description="Dungeon select, energy cost and boss gates."
              />
            ),
          },
          {
            path: 'stats',
            element: (
              <ComingSoon
                title="Stats"
                icon="stats"
                phase="Phase 6"
                description="Real study, accuracy and battle statistics."
              />
            ),
          },
          {
            path: 'leaderboard',
            element: (
              <ComingSoon
                title="Leaderboard"
                icon="leaderboard"
                phase="Phase 6"
                description="Opt-in, public-only ranking from server-verified XP."
              />
            ),
          },
          {
            path: 'settings',
            element: (
              <ComingSoon
                title="Settings"
                icon="settings"
                phase="Phase 6"
                description="Sound, animation, privacy, data export and reset."
              />
            ),
          },
          {
            path: '*',
            element: (
              <ComingSoon
                title="Page not found"
                phase="n/a"
                description="That route does not exist."
              />
            ),
          },
        ],
      },
      {
        element: <BattleLayout />,
        children: [
          {
            path: 'battle/:battleId',
            element: (
              <ComingSoon
                title="Battle"
                icon="dungeons"
                phase="Phase 5"
                description="Full-screen, server-authoritative battle screen."
              />
            ),
          },
        ],
      },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
export const createTestRouter = (path: string) =>
  createMemoryRouter(routes, { initialEntries: [path] });
