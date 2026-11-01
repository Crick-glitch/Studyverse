import { lazy, Suspense } from 'react';
import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { LabPage } from './features/lab/LabPage';
import { QuestBoardPage } from './features/quests/QuestBoardPage';
import { SessionsPage } from './features/sessions/SessionsPage';
import { AppLayout } from './layouts/AppLayout';
import { BattleLayout } from './layouts/BattleLayout';
import { BattlePage } from './features/battle/BattlePage';
import { DungeonsPage } from './features/dungeons/DungeonsPage';
import { ComingSoon } from './pages/ComingSoon';
import { HomePage } from './pages/HomePage';
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
            element: <HomePage />,
          },
          { path: 'quests', element: <QuestBoardPage /> },
          { path: 'sessions', element: <SessionsPage /> },
          { path: 'lab', element: <LabPage /> },
          {
            path: 'camp',
            element: (
              <ComingSoon
                title="Hero"
                icon="camp"
                phase="Phase 6"
                description="Your hero: class, inventory, skill tree and cosmetics."
              />
            ),
          },
          {
            path: 'dungeons',
            element: <DungeonsPage />,
          },
          {
            path: 'stats',
            element: (
              <ComingSoon
                title="Progress"
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
            element: <BattlePage />,
          },
        ],
      },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
export const createTestRouter = (path: string) =>
  createMemoryRouter(routes, { initialEntries: [path] });
