import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from './auth/AuthContext';
import { createTestRouter } from './router';

// The login screen must not depend on the developer's real apps/web/.env, so Supabase is mocked as "not configured".
vi.mock('./lib/supabase', () => ({
  supabase: null,
  supabaseConfigError:
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.',
}));

vi.mock('./lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: {
    me: vi.fn(() =>
      Promise.resolve({
        user: { id: 'u1', email: 'ada@example.com' },
        profile: {
          id: 'u1',
          displayName: 'Ada',
          avatarKey: null,
          avatarUrl: null,
          playerClass: null,
          showOnLeaderboard: false,
          createdAt: '',
        },
        progress: {
          level: 3,
          totalXp: 260,
          currentLevelXp: 10,
          xpForNextLevel: 200,
          streak: 0,
          studyEnergy: 0,
          skillPoints: 2,
          raidWins: 0,
          raidLosses: 0,
        },
      }),
    ),
    summary: vi.fn(() =>
      Promise.resolve({
        dueCards: 0,
        claimableQuests: 0,
        activeSession: null,
        energy: 0,
        unspentSkillPoints: 0,
        serverNow: '2026-01-01T00:00:00Z',
      }),
    ),
    tasks: { list: vi.fn(() => Promise.resolve([])) },
    quests: { list: vi.fn(() => Promise.resolve([])) },
    sessions: {
      active: vi.fn(() => Promise.resolve({ session: null, serverNow: '2026-01-01T00:00:00Z' })),
      list: vi.fn(() => Promise.resolve([])),
    },
    decks: { list: vi.fn(() => Promise.resolve([])) },
  },
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const auth = (status: AuthValue['status']): AuthValue => ({
  status,
  email: status === 'signedIn' ? 'ada@example.com' : null,
  signIn: vi.fn(() => Promise.resolve(null)),
  signUp: vi.fn(() => Promise.resolve({ error: null, needsConfirmation: false })),
  signOut: vi.fn(() => Promise.resolve()),
});

function renderAt(path: string, status: AuthValue['status'] = 'signedIn') {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AuthContext.Provider value={auth(status)}>
        <RouterProvider router={createTestRouter(path)} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const placeholders: [string, string][] = [
  ['/', 'Dashboard'],
  ['/camp', 'Hero'],
  ['/dungeons', 'Adventure'],
  ['/battle/abc', 'Battle'],
  ['/stats', 'Progress'],
  ['/leaderboard', 'Leaderboard'],
  ['/settings', 'Settings'],
];

describe('route shell (signed in)', () => {
  it.each(placeholders)('%s renders an honest placeholder', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText(/Coming in a later phase/)).toBeTruthy();
  });

  // Phase 4: these three are real screens that talk to the API (mocked above), not placeholders.
  const real: [string, string, RegExp][] = [
    ['/quests', 'Quest Board', /No tasks here yet/],
    ['/sessions', 'Study Sessions', /Plan a session/],
    ['/lab', 'Lab', /No decks yet/],
  ];
  it.each(real)('%s is a real screen with an empty state', async (path, title, empty) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.queryByText(/Coming in a later phase/)).toBeNull();
    await waitFor(() => expect(screen.getAllByText(empty).length).toBeGreaterThan(0));
  });

  it('battle route has no main navigation', () => {
    renderAt('/battle/abc');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('login has no hotbar and no HUD', () => {
    renderAt('/login', 'signedOut');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('every signed-in screen has the hotbar with the five daily destinations plus Menu', () => {
    renderAt('/quests');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/quests',
      '/sessions',
      '/lab',
      '/dungeons',
    ]);
    expect(nav.querySelector('button')?.textContent).toBe('Menu');
  });

  it('shows the real player name and level from the API', async () => {
    renderAt('/');
    await waitFor(() => expect(screen.getByText(/Ada · Lv 3/)).toBeTruthy());
  });
});

describe('authentication guard', () => {
  it.each([...placeholders.map(([p]) => [p]), ['/quests'], ['/sessions'], ['/lab']])(
    '%s redirects to the login screen when signed out',
    (path) => {
      renderAt(path as string, 'signedOut');
      expect(screen.getByRole('heading', { level: 1, name: 'Log in' })).toBeTruthy();
    },
  );

  it('shows a loading state, not protected content, while the session is being checked', () => {
    renderAt('/', 'loading');
    expect(screen.getByRole('status').textContent).toMatch(/Checking your session/);
    expect(screen.queryByRole('heading', { level: 1, name: 'Dashboard' })).toBeNull();
  });

  it('a signed-in player on /login is sent on to the app', () => {
    renderAt('/login');
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
  });
});

describe('development art review route', () => {
  it('is reachable without signing in and shows the manifest', async () => {
    renderAt('/dev/art', 'signedOut');
    expect(await screen.findByRole('heading', { level: 1, name: 'Art review' }, { timeout: 15000 })).toBeTruthy();
  }, 20000);
});

describe('login screen', () => {
  it('shows a clear message when Supabase is not configured', () => {
    renderAt('/login', 'signedOut');
    // In the test environment no VITE_SUPABASE_* variables are set.
    expect(screen.getByRole('alert').textContent).toMatch(/Supabase is not configured/);
    expect((screen.getByRole('button', { name: 'Log in' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
