import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from '../auth/AuthContext';
import { AppLayout } from './AppLayout';
import { MOBILE_QUERY, NARROW_QUERY, STORAGE_KEY } from './useSidebar';

vi.mock('../lib/supabase', () => ({ supabase: null, supabaseConfigError: 'not configured' }));
vi.mock('../lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: {
    me: vi.fn(() =>
      Promise.resolve({
        user: { id: 'u1', email: 'ada@example.com' },
        profile: { id: 'u1', displayName: 'Ada', avatarKey: null, avatarUrl: null, playerClass: null, showOnLeaderboard: false, createdAt: '' },
        progress: { level: 3, totalXp: 260, currentLevelXp: 10, xpForNextLevel: 200, streak: 5, studyEnergy: 4, skillPoints: 2, raidWins: 0, raidLosses: 0 },
      }),
    ),
  },
}));

/** jsdom has no matchMedia: install one that answers "yes" to the queries listed. */
function matchMediaFor(...yes: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: yes.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const auth: AuthValue = {
  status: 'signedIn',
  email: 'ada@example.com',
  signIn: vi.fn(() => Promise.resolve(null)),
  signUp: vi.fn(() => Promise.resolve({ error: null, needsConfirmation: false })),
  signOut: vi.fn(() => Promise.resolve()),
};

function renderLayout(path = '/quests') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<h1>Home page</h1>} />
              <Route path="/quests" element={<h1>Quests page</h1>} />
              <Route path="/lab" element={<h1>Lab page</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const sidebar = () => screen.getByRole('navigation', { name: 'Main' }).closest('aside') as HTMLElement;

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // @ts-expect-error remove the matchMedia a test installed
  delete window.matchMedia;
});

describe('sidebar (desktop)', () => {
  it('lists every route in the Main navigation and marks only the current page', () => {
    renderLayout('/quests');
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Dashboard',
      'Quest Board',
      'Sessions',
      'Lab',
      'Camp',
      'Dungeons',
      'Stats',
      'Leaderboard',
      'Settings',
    ]);
    expect(nav.getByRole('link', { name: 'Quest Board' }).getAttribute('aria-current')).toBe('page');
    expect(nav.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
  });

  it('collapses to icons only, keeps the link names, and remembers the choice', () => {
    const first = renderLayout();
    expect(sidebar().dataset.collapsed).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(sidebar().dataset.collapsed).toBe('true');
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Lab' }).getAttribute('title')).toBe('Lab'); // tooltip + accessible name
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1');

    first.unmount();
    renderLayout();
    expect(sidebar().dataset.collapsed).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('0');
  });

  it('starts icons-only on narrow desktops until the player chooses', () => {
    matchMediaFor(NARROW_QUERY);
    renderLayout();
    expect(sidebar().dataset.collapsed).toBe('true');
    // an explicit choice wins over the width default
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(sidebar().dataset.collapsed).toBe('false');
  });

  it('still works when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(sidebar().dataset.collapsed).toBe('true');
  });

  it('offers a skip link to the page content', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main-content');
    expect(screen.getByRole('main').id).toBe('main-content');
  });
});

describe('HUD', () => {
  it('shows the real name, level, XP, energy and streak from /me', async () => {
    renderLayout();
    expect(await screen.findByText(/Ada · Lv 3/)).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'XP to next level' });
    expect(bar.getAttribute('aria-valuenow')).toBe('10');
    expect(bar.getAttribute('aria-valuemax')).toBe('200');
    expect(screen.getByText('Study energy: 4')).toBeTruthy();
    expect(screen.getByRole('img', { name: /5-day streak/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
  });

  it('signs out from the HUD', async () => {
    renderLayout();
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe('navigation drawer (phone)', () => {
  beforeEach(() => matchMediaFor(MOBILE_QUERY));

  const menuButton = () => screen.getByRole('button', { name: 'Open menu' });

  it('has a menu button instead of the collapse control, closed at first', () => {
    renderLayout();
    expect(menuButton().getAttribute('aria-expanded')).toBe('false');
    expect(sidebar().dataset.open).toBe('false');
    expect(screen.queryByRole('button', { name: /collapse menu|expand menu/i })).toBeNull();
  });

  it('opens with focus on the first link and makes the page inert', () => {
    renderLayout();
    fireEvent.click(menuButton());
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    expect(sidebar().dataset.open).toBe('true');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBe(document.activeElement);
    expect((screen.getByRole('main').parentElement as HTMLElement & { inert: boolean }).inert).toBe(true);
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    renderLayout();
    fireEvent.click(menuButton());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(sidebar().dataset.open).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
    expect((screen.getByRole('main').parentElement as HTMLElement & { inert: boolean }).inert).toBe(false);
  });

  it('closes from the close button and from the backdrop', () => {
    renderLayout();
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(sidebar().dataset.open).toBe('false');

    fireEvent.click(menuButton());
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(sidebar().dataset.open).toBe('false');
  });

  it('keeps Tab and Shift+Tab inside the drawer', () => {
    renderLayout();
    fireEvent.click(menuButton());
    const close = screen.getByRole('button', { name: 'Close menu' });
    const last = screen.getByRole('link', { name: 'Settings' });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes after a link is followed and moves focus to the page', async () => {
    renderLayout('/quests');
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole('link', { name: 'Lab' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Lab page' })).toBeTruthy();
    expect(sidebar().dataset.open).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')));
  });
});
