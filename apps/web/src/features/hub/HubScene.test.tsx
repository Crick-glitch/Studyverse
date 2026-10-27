import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../../pages/HomePage';
import type { HubPropId } from '../art/sprites/hub-props';
import { HubScene, WIDE_QUERY } from './HubScene';

const mocks = vi.hoisted(() => ({ summary: vi.fn(), me: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: null, supabaseConfigError: 'not configured' }));
vi.mock('../../lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: { me: mocks.me, summary: mocks.summary },
}));

const ME = {
  user: { id: 'u1', email: 'a@b.c' },
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

function matchMediaFor(...yes: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: yes.includes(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}
const renderScene = (ui = <HubScene />) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  mocks.me.mockReset().mockResolvedValue(ME);
  mocks.summary.mockReset().mockResolvedValue(summaryOf());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // @ts-expect-error remove the matchMedia a test installed
  delete window.matchMedia;
});

describe('HubScene', () => {
  it('puts "Skip scene" before the props and the props are real links named with their live state', async () => {
    renderScene();
    const camp = screen.getByRole('region', { name: 'Camp' });
    expect(within(camp).getAllByRole('link')[0]?.textContent).toBe('Skip scene');
    expect(await screen.findByRole('link', { name: 'Library wagon, Library, 12 cards due' })).toBeTruthy();
    const links = within(camp).getAllByRole('link').slice(1);
    expect(links.map((a) => a.getAttribute('href')).sort()).toEqual(['/camp', '/dungeons', '/lab', '/quests', '/sessions', '/stats']);
    expect(screen.getByRole('link', { name: 'Quest board, Quests, 1 quest ready to claim' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Hero tent, Hero, 2 unspent skill points' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Dungeon gate, Adventure, 4 energy, enough for a raid' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Study tent, Study' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Journal desk, Progress' })).toBeTruthy();
  });

  it('keeps the props as plain links when the summary fails (nothing invented)', async () => {
    mocks.summary.mockRejectedValue(new Error('down'));
    renderScene();
    await screen.findByRole('link', { name: 'Library wagon, Library' });
    expect(screen.getAllByRole('link', { name: /,/ }).every((a) => a.getAttribute('data-state') !== 'due')).toBe(true);
  });

  it('draws the sprite states from the data', async () => {
    renderScene();
    await screen.findByRole('link', { name: /^Library wagon, Library, 12/ });
    const state = (id: string) => document.querySelector(`[data-prop="${id}"]`)?.getAttribute('data-state');
    expect([state('library-wagon'), state('quest-board'), state('hero-tent'), state('gate'), state('study-tent')]).toEqual(['due', 'flags', 'attention', 'ready', 'idle']);
  });

  it('is 1x on a phone and 2x on a wide screen (whole numbers only)', async () => {
    renderScene();
    expect(document.querySelector('section > div[data-scale]')?.getAttribute('data-scale')).toBe('1');
    cleanup();
    matchMediaFor(WIDE_QUERY);
    renderScene();
    expect(document.querySelector('section > div[data-scale]')?.getAttribute('data-scale')).toBe('2');
  });

  it('shows no next-action marker until a destination is chosen, then marks that prop', () => {
    renderScene();
    expect(screen.queryByTestId('next-action-marker')).toBeNull();
    cleanup();
    renderScene(<HubScene nextAction={'quest-board' as HubPropId} />);
    expect(screen.getByTestId('next-action-marker').getAttribute('aria-hidden')).toBe('true');
  });

  it('"Skip scene" moves focus to the page content below the scene', () => {
    renderScene(<HomePage />);
    fireEvent.click(screen.getByRole('link', { name: 'Skip scene' }));
    expect(document.activeElement?.id).toBe('home-content');
  });

  it('gives every prop a target of at least 44 x 44 px', async () => {
    renderScene();
    await screen.findByRole('link', { name: /^Library wagon, Library, 12/ });
    for (const a of Array.from(document.querySelectorAll<HTMLElement>('a[data-prop]'))) {
      expect(parseFloat(a.style.width), a.dataset.prop).toBeGreaterThanOrEqual(44);
      expect(parseFloat(a.style.height), a.dataset.prop).toBeGreaterThanOrEqual(44);
    }
  });
});
