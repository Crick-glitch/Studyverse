import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthValue } from '../auth/AuthContext';
import { AppLayout } from './AppLayout';
import { MOBILE_QUERY } from './breakpoints';
import { HOTKEYS_STORAGE_KEY } from './hotkeys';

const mocks = vi.hoisted(() => ({ summary: vi.fn(), me: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: null, supabaseConfigError: 'not configured' }));
vi.mock('../lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: { me: mocks.me, summary: mocks.summary },
}));

const ME = {
  user: { id: 'u1', email: 'ada@example.com' },
  profile: { id: 'u1', displayName: 'Ada', avatarKey: null, avatarUrl: null, playerClass: null, showOnLeaderboard: false, createdAt: '' },
  progress: { level: 3, totalXp: 260, currentLevelXp: 10, xpForNextLevel: 200, streak: 5, studyEnergy: 4, skillPoints: 2, raidWins: 0, raidLosses: 0 },
};
const summaryOf = (over: Record<string, unknown> = {}) => ({
  dueCards: 12,
  claimableQuests: 1,
  activeSession: null,
  energy: 4,
  unspentSkillPoints: 2,
  serverNow: '2026-10-26T10:00:00.000Z',
  ...over,
});
const RUNNING = {
  id: 's1',
  status: 'running' as const,
  startedAt: '2026-10-26T09:47:00.000Z',
  pausedAt: null,
  plannedSeconds: 1500,
  pausedTotalSec: 0,
  remainingSec: 780,
};

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
  const page = (title: string) => <h1>{title}</h1>;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={page('Home page')} />
              <Route path="/quests" element={<><h1>Quests page</h1><input aria-label="Notes" /></>} />
              <Route path="/sessions" element={page('Study page')} />
              <Route path="/lab" element={page('Library page')} />
              <Route path="/dungeons" element={page('Adventure page')} />
              <Route path="/camp" element={page('Hero page')} />
              <Route path="/stats" element={page('Progress page')} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const hotbar = () => within(screen.getByRole('navigation', { name: 'Main' }));
const menuButton = () => hotbar().getByRole('button', { name: 'Menu' });
const key = (k: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key: k, ...init });

beforeEach(() => {
  window.localStorage.clear();
  mocks.me.mockReset().mockResolvedValue(ME);
  mocks.summary.mockReset().mockResolvedValue(summaryOf());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // @ts-expect-error remove the matchMedia a test installed
  delete window.matchMedia;
});

describe('hotbar', () => {
  it('has the five daily destinations plus Menu, and marks only the current page', async () => {
    renderLayout('/quests');
    expect(hotbar().getAllByRole('link').map((a) => a.textContent?.replace(/\d\+?|Resume/g, '').trim())).toEqual([
      'Home',
      'Quests',
      'Study',
      'Library',
      'Adventure',
    ]);
    expect(hotbar().getByRole('link', { name: /^Quests/ }).getAttribute('aria-current')).toBe('page');
    expect(hotbar().getByRole('link', { name: /^Home/ }).getAttribute('aria-current')).toBeNull();
    expect(menuButton()).toBeTruthy();
    await screen.findByRole('link', { name: 'Library, 12 cards due' }); // let the summary settle
  });

  it('follows the route when a slot is clicked', async () => {
    renderLayout('/quests');
    fireEvent.click(hotbar().getByRole('link', { name: /^Study/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Study page' })).toBeTruthy();
    expect(hotbar().getByRole('link', { name: /^Study/ }).getAttribute('aria-current')).toBe('page');
    expect(hotbar().getByRole('link', { name: /^Quests/ }).getAttribute('aria-current')).toBeNull();
  });

  it('shows real counts with a hidden text equivalent in the link name', async () => {
    renderLayout();
    expect(await screen.findByRole('link', { name: 'Quests, 1 quest ready to claim' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Library, 12 cards due' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Adventure, 4 energy, enough for a raid' })).toBeTruthy();
    // the drawn cap is 9+, the spoken number is exact
    expect(hotbar().getByText('9+')).toBeTruthy();
  });

  it('shows no badge for zero, no pip below the raid energy cost, and nothing at all when the summary fails', async () => {
    mocks.summary.mockResolvedValue(summaryOf({ dueCards: 0, claimableQuests: 0, energy: 2, unspentSkillPoints: 0 }));
    renderLayout();
    await waitFor(() => expect(mocks.summary).toHaveBeenCalled());
    await screen.findByText(/Ada · Lv 3/);
    expect(hotbar().getAllByRole('link').map((a) => a.getAttribute('aria-label'))).toEqual([null, null, null, null, null]);
    cleanup();

    mocks.summary.mockRejectedValue(new Error('down'));
    renderLayout();
    await screen.findByText(/Ada · Lv 3/);
    expect(hotbar().getAllByRole('link').every((a) => a.getAttribute('aria-label') === null)).toBe(true);
    expect(screen.queryByRole('link', { name: /Study session/ })).toBeNull();
  });

  it('badges have no aria-live region and no red', async () => {
    renderLayout();
    await screen.findByRole('link', { name: /^Library, / });
    expect(screen.getByRole('navigation', { name: 'Main' }).querySelector('[aria-live]')).toBeNull();
  });

  it('marks Study with Resume while a session is running', async () => {
    mocks.summary.mockResolvedValue(summaryOf({ activeSession: RUNNING }));
    renderLayout();
    expect(await screen.findByRole('link', { name: 'Study, session in progress, resume' })).toBeTruthy();
    expect(hotbar().getByText('Resume')).toBeTruthy();
  });

  it('puts the key in each slot tooltip while shortcuts are on', async () => {
    renderLayout();
    await screen.findByText(/Ada · Lv 3/);
    expect(hotbar().getByRole('link', { name: /^Library/ }).getAttribute('title')).toBe('Library (4)');
    expect(menuButton().getAttribute('title')).toBe('Menu (M)');
  });

  it('offers a skip link to the page content', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Skip to main content' }).getAttribute('href')).toBe('#main-content');
    expect(screen.getByRole('main').id).toBe('main-content');
  });
});

describe('hotkeys', () => {
  it.each([
    ['1', 'Home page'],
    ['2', 'Quests page'],
    ['3', 'Study page'],
    ['4', 'Library page'],
    ['5', 'Adventure page'],
    ['h', 'Hero page'],
    ['H', 'Hero page'],
  ])('%s goes to %s', async (k, heading) => {
    renderLayout(k === '2' ? '/lab' : '/quests');
    await screen.findByText(/Ada · Lv 3/);
    key(k);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it('M opens the Menu', async () => {
    renderLayout();
    await screen.findByText(/Ada · Lv 3/);
    key('m');
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy();
  });

  it('are ignored while a text field has focus, and with Ctrl, Alt or Meta held', async () => {
    renderLayout('/quests');
    await screen.findByText(/Ada · Lv 3/);
    const field = screen.getByRole('textbox', { name: 'Notes' });
    field.focus();
    key('3', {}, field);
    key('m', {}, field);
    key('3', { ctrlKey: true });
    key('4', { altKey: true });
    key('5', { metaKey: true });
    expect(screen.getByRole('heading', { level: 1, name: 'Quests page' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('are ignored while a modal dialog is open', async () => {
    renderLayout('/quests');
    await screen.findByText(/Ada · Lv 3/);
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
    key('3');
    modal.remove();
    expect(screen.getByRole('heading', { level: 1, name: 'Quests page' })).toBeTruthy();
  });

  it('can be switched off in the Menu, which is remembered, and then do nothing', async () => {
    renderLayout('/quests');
    await screen.findByText(/Ada · Lv 3/);
    fireEvent.click(menuButton());
    const toggle = screen.getByRole('checkbox', { name: /Keyboard shortcuts/ }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(window.localStorage.getItem(HOTKEYS_STORAGE_KEY)).toBe('0');
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    key('3');
    key('m');
    expect(screen.getByRole('heading', { level: 1, name: 'Quests page' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(hotbar().getByRole('link', { name: /^Library/ }).getAttribute('title')).toBe('Library'); // no key in the tooltip
    cleanup();
    renderLayout('/quests'); // a fresh load reads the stored choice
    await screen.findByText(/Ada · Lv 3/);
    key('3');
    expect(screen.getByRole('heading', { level: 1, name: 'Quests page' })).toBeTruthy();
  });

  it('still work (on by default) when browser storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderLayout('/quests');
    await screen.findByText(/Ada · Lv 3/);
    key('3');
    expect(await screen.findByRole('heading', { level: 1, name: 'Study page' })).toBeTruthy();
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByRole('checkbox', { name: /Keyboard shortcuts/ })); // must not throw
  });
});

describe('Menu overlay', () => {
  const open = async () => {
    renderLayout('/quests');
    await screen.findByText(/Ada · Lv 3/);
    fireEvent.click(menuButton());
    return screen.getByRole('dialog', { name: 'Menu' });
  };
  const inertOf = () => (screen.getByRole('main').parentElement as HTMLElement & { inert: boolean }).inert;

  it('opens as a modal dialog, moves focus inside and makes the page inert', async () => {
    const dialog = await open();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(menuButton().getAttribute('aria-expanded')).toBe('true');
    expect(inertOf()).toBe(true);
    expect(within(dialog).getAllByRole('link').map((a) => a.textContent)).toEqual(['Progress', 'Leaderboard', 'Settings']);
  });

  it('closes on Escape and returns focus to the Menu slot', async () => {
    await open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
    expect(inertOf()).toBe(false);
  });

  it('closes from the close button and from the backdrop', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(menuButton()));
    fireEvent.click(menuButton());
    fireEvent.click(screen.getByTestId('menu-backdrop'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps Tab and Shift+Tab inside', async () => {
    const dialog = await open();
    const close = within(dialog).getByRole('button', { name: 'Close menu' });
    const last = within(dialog).getByRole('button', { name: 'Sign out' });
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes after a link is followed and moves focus to the page', async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole('link', { name: 'Progress' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Progress page' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')));
  });

  it('shows real credits on demand and signs out', async () => {
    const dialog = await open();
    const credits = within(dialog).getByRole('button', { name: 'Credits' });
    expect(credits.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(credits);
    expect(credits.getAttribute('aria-expanded')).toBe('true');
    expect(within(dialog).getByText(/No third-party art is used/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
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
  });

  it('has no sign-out button any more (it lives in the Menu)', async () => {
    renderLayout();
    await screen.findByText(/Ada · Lv 3/);
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('the portrait links to the Hero screen and flags unspent skill points', async () => {
    renderLayout();
    const link = await screen.findByRole('link', { name: 'Hero, 2 unspent skill points' });
    expect(link.getAttribute('href')).toBe('/camp');
    expect(link.getAttribute('title')).toBe('Hero (H)');
  });

  it('shows no "!" when there are no unspent skill points', async () => {
    mocks.summary.mockResolvedValue(summaryOf({ unspentSkillPoints: 0 }));
    renderLayout();
    await screen.findByText(/Ada · Lv 3/);
    expect(await screen.findByRole('link', { name: 'Hero' })).toBeTruthy();
  });

  it('has no session chip without an active session', async () => {
    renderLayout();
    await screen.findByText(/Ada · Lv 3/);
    expect(screen.queryByRole('link', { name: /Study session/ })).toBeNull();
  });

  it('counts the session chip down from the server value, and links to Study', async () => {
    // The countdown measures time since the response with performance.now(), never the browser's wall clock.
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mocks.summary.mockResolvedValue(summaryOf({ activeSession: RUNNING }));
    renderLayout();
    const chip = await screen.findByRole('link', { name: /Study session running/ });
    expect(chip.getAttribute('href')).toBe('/sessions');
    expect(within(chip).getByText('13:00')).toBeTruthy();
    now += 3000; // three seconds later; the chip's own 500 ms tick re-reads the clock
    await waitFor(() => expect(within(chip).getByText('12:57')).toBeTruthy(), { timeout: 3000 });
  });

  it('shows a paused session as Paused and does not tick', async () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    mocks.summary.mockResolvedValue(summaryOf({ activeSession: { ...RUNNING, status: 'paused', pausedAt: '2026-10-26T09:59:00.000Z' } }));
    renderLayout();
    const chip = await screen.findByRole('link', { name: /Study session paused/ });
    expect(within(chip).getByText('Paused')).toBeTruthy();
    now += 5000;
    await new Promise((r) => setTimeout(r, 700));
    expect(within(chip).getByText('Paused')).toBeTruthy();
  });

  it('on a phone keeps the level (as a plate) and the XP bar, and still names the player for screen readers', async () => {
    matchMediaFor(MOBILE_QUERY);
    renderLayout();
    expect(await screen.findByText(/Ada · Lv 3/)).toBeTruthy(); // present in the DOM; hidden visually by CSS
    expect(screen.getByRole('progressbar', { name: 'XP to next level' })).toBeTruthy();
    expect(screen.getByText('LV')).toBeTruthy();
  });
});
