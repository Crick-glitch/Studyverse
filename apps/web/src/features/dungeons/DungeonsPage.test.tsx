import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DungeonsDto } from '@studyverse/shared';
import { DungeonsPage } from './DungeonsPage';

const api = vi.hoisted(() => ({ dungeons: vi.fn(), start: vi.fn() }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string, public details?: unknown) {
      super(message);
    }
  },
  api: { battles: api },
}));
vi.mock('../../lib/useMediaQuery', () => ({ useMediaQuery: () => true }));

const dungeon = (tier: 1 | 2 | 3, over = {}) => ({
  tier, slug: (['archive', 'library', 'foundry'] as const)[tier - 1]!, name: ['The Whispering Archive', 'The Sunken Library', 'The Clockwork Foundry'][tier - 1]!,
  background: `dungeon.${['archive', 'library', 'foundry'][tier - 1]}`, open: tier === 1, lockedReason: tier === 1 ? null : tier === 2 ? 'Reach level 5 and defeat The Procrastination Wyrm' : 'Reach level 9 and defeat The Archivist Lich',
  bossSlug: ['procrastination-wyrm', 'archivist-lich', 'clockwork-titan'][tier - 1]!, bossName: ['The Procrastination Wyrm', 'The Archivist Lich', 'The Clockwork Titan'][tier - 1]!,
  bossOpen: false, bossLockedReason: 'Reach level 3 and win 2 more raids here', bossDefeated: false, raidWins: 1, raidWinsNeeded: 3, ...over,
});
const map = (over: Partial<DungeonsDto> = {}): DungeonsDto => ({
  level: 2, energy: 6, energyCost: 3, dungeons: [dungeon(1), dungeon(2), dungeon(3)], dueBySubject: { Math: 4, Biology: 1 }, activeBattleId: null, ...over,
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dungeons']}>
        <Routes>
          <Route path="/dungeons" element={<DungeonsPage />} />
          <Route path="/battle/:id" element={<Where />} />
          <Route path="/lab" element={<p>Library</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  api.dungeons.mockReset();
  api.start.mockReset();
});
afterEach(cleanup);

describe('Adventure: region map', () => {
  it('shows three regions as real buttons with their state, and says WHY a locked one is locked', async () => {
    api.dungeons.mockResolvedValue(map());
    show();
    const mapEl = await screen.findByRole('region', { name: 'Region map' });
    const nodes = within(mapEl).getAllByRole('button');
    expect(nodes).toHaveLength(3);
    expect(nodes[0]!.textContent).toMatch(/Whispering Archive.*Open/);
    expect(nodes[1]!.textContent).toMatch(/Sunken Library.*Locked/);
    fireEvent.click(nodes[1]!);
    expect(screen.getByTestId('locked-2').textContent).toBe('Reach level 5 and defeat The Procrastination Wyrm');
    expect(screen.getByTestId('boss-status-2').textContent).toBe('Open this region first.');
    expect((screen.getByRole('button', { name: /Start raid/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Practice/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a cleared boss is labelled cleared; the boss gate shows progress and its reason', async () => {
    api.dungeons.mockResolvedValue(map({ dungeons: [dungeon(1, { bossDefeated: true, bossOpen: true, bossLockedReason: null, raidWins: 3 }), dungeon(2), dungeon(3)] }));
    show();
    await screen.findByRole('heading', { level: 1, name: 'Adventure' });
    expect(within(screen.getByRole('region', { name: 'Region map' })).getAllByRole('button')[0]!.textContent).toMatch(/Cleared/);
    expect(screen.getByTestId('boss-status-1').textContent).toMatch(/Defeated/);
    expect(screen.getByText('Raid wins here: 3 of 3')).toBeTruthy();
  });

  it('a boss still behind its gate is disabled with the real reason', async () => {
    api.dungeons.mockResolvedValue(map());
    show();
    await screen.findByRole('heading', { level: 1, name: 'Adventure' });
    expect(screen.getByTestId('boss-status-1').textContent).toBe('Reach level 3 and win 2 more raids here');
    expect((screen.getByRole('button', { name: /Boss raid/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Raid wins here: 1 of 3')).toBeTruthy();
  });

  it('without enough energy a raid is disabled with the reason, but practice stays available', async () => {
    api.dungeons.mockResolvedValue(map({ energy: 1 }));
    show();
    await screen.findByRole('heading', { level: 1, name: 'Adventure' });
    expect((screen.getByRole('button', { name: /Start raid/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Needs 3 energy \(you have 1\)/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Practice/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('energy').textContent).toMatch(/Energy: 1/);
  });

  it('the prep panel follows the chosen subject, links to the Library and never blocks entering', async () => {
    api.dungeons.mockResolvedValue(map());
    show();
    await screen.findByRole('heading', { level: 1, name: 'Adventure' });
    expect(screen.getByTestId('prep-due').textContent).toMatch(/5 cards are due in any subject/);
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Math' } });
    expect(screen.getByTestId('prep-due').textContent).toMatch(/4 cards are due in Math/);
    expect(screen.getByRole('link', { name: 'Review these cards first' }).getAttribute('href')).toBe('/lab');
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'History' } });
    expect(screen.getByTestId('prep-due').textContent).toMatch(/No cards are due in History/);
    expect((screen.getByRole('button', { name: /Start raid/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('starting a raid sends the chosen subject and tier with an Idempotency-Key, then opens the battle', async () => {
    api.dungeons.mockResolvedValue(map());
    api.start.mockResolvedValue({ created: true, battle: { id: 'b-42' } });
    show();
    await screen.findByRole('heading', { level: 1, name: 'Adventure' });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Biology' } });
    fireEvent.click(screen.getByRole('button', { name: /Start raid/ }));
    await waitFor(() => expect(screen.getAllByTestId('where').some((n) => n.textContent === '/battle/b-42')).toBe(true));
    expect(api.start).toHaveBeenCalledWith({ mode: 'raid', subject: 'Biology', tier: 1 }, expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  it('a retry of the same fight reuses the same Idempotency-Key (so one battle at most), a different fight gets a new one', async () => {
    api.dungeons.mockResolvedValue(map());
    const { ApiError } = await import('../../lib/api');
    api.start.mockRejectedValueOnce(new ApiError(500, 'X', 'Server hiccup')).mockResolvedValue({ created: true, battle: { id: 'b-1' } });
    show();
    await screen.findByRole('heading', { level: 1, name: 'Adventure' });
    fireEvent.click(screen.getByRole('button', { name: /Practice/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Server hiccup/);
    fireEvent.click(screen.getByRole('button', { name: /Practice/ }));
    await waitFor(() => expect(api.start).toHaveBeenCalledTimes(2));
    expect(api.start.mock.calls[1]![1]).toBe(api.start.mock.calls[0]![1]);
    expect(api.start.mock.calls[0]![0]).toEqual({ mode: 'practice', subject: 'Any', tier: 1 });
  });

  it('an unfinished battle shows a Resume link and blocks starting another, with the reason', async () => {
    api.dungeons.mockResolvedValue(map({ activeBattleId: 'b-9' }));
    show();
    expect((await screen.findByRole('link', { name: 'Resume it' })).getAttribute('href')).toBe('/battle/b-9');
    expect((screen.getByRole('button', { name: /Start raid/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Finish or retreat your current battle first.')).toBeTruthy();
  });

  it('a failed load can be retried', async () => {
    api.dungeons.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(map());
    show();
    fireEvent.click(await screen.findByRole('button', { name: /try again|retry/i }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Adventure' })).toBeTruthy();
  });
});
