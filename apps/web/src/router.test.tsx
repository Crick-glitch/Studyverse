import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from './auth/AuthContext';
import { createTestRouter } from './router';

vi.mock('./lib/api', () => ({
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
  ['/quests', 'Quest Board'],
  ['/sessions', 'Study Sessions'],
  ['/lab', 'Lab'],
  ['/camp', 'Camp'],
  ['/dungeons', 'Dungeons'],
  ['/battle/abc', 'Battle'],
  ['/stats', 'Stats'],
  ['/leaderboard', 'Leaderboard'],
  ['/settings', 'Settings'],
];

describe('route shell (signed in)', () => {
  it.each(placeholders)('%s renders an honest placeholder', (path, title) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText(/Coming in a later phase/)).toBeTruthy();
  });

  it('battle route has no main navigation', () => {
    renderAt('/battle/abc');
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('shows the real player name and level from the API', async () => {
    renderAt('/');
    await waitFor(() => expect(screen.getByText(/Ada · Lv 3/)).toBeTruthy());
  });
});

describe('authentication guard', () => {
  it.each(placeholders.map(([p]) => [p]))(
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
