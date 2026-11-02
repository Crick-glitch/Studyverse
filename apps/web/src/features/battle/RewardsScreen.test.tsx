import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleSummaryDto } from '@studyverse/shared';
import { RewardsScreen } from './RewardsScreen';
import { fakeSummary } from './testFixtures';

afterEach(cleanup);
const show = (s: BattleSummaryDto, over: { addedMessage?: string | null; onAddMissed?: () => void } = {}) =>
  render(
    <MemoryRouter>
      <RewardsScreen summary={s} onAddMissed={over.onAddMissed ?? (() => undefined)} addedMessage={over.addedMessage ?? null} adding={false} />
    </MemoryRouter>,
  );
const missed = (n: number, isCard = false) =>
  Array.from({ length: n }, (_, i) => ({ turnNumber: i + 1, subject: 'Math', text: `Question ${i + 1}?`, choices: ['x', 'y', 'z'], correctIndex: 1, selectedIndex: 0, explanation: i === 0 ? 'Because y.' : null, isCard }));

describe('rewards screen', () => {
  it('shows what the server paid, and says plainly when the daily practice cap cut it', () => {
    show(fakeSummary({ mode: 'practice', xp: { requested: 7, awarded: 0, capped: true, dailyCap: 60 }, energy: 0 }));
    expect(screen.getByText(/Daily practice cap reached \(60 XP\)/)).toBeTruthy();
    expect(screen.getByText('+0')).toBeTruthy();
    expect(screen.queryByTestId('loot')).toBeNull();
    expect(screen.queryByText('Energy')).toBeNull(); // practice never pays energy, so the tile is not shown
    expect(screen.getByRole('link', { name: 'Practice again' })).toBeTruthy();
  });

  it('a defeat is honest and offers to prepare and retry', () => {
    show(fakeSummary({ outcome: 'defeat', correct: 2, asked: 6, energy: 0 }));
    expect(screen.getByRole('heading', { name: 'Defeat' })).toBeTruthy();
    expect(screen.getByText('33%')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Prepare and retry' }).getAttribute('href')).toBe('/dungeons');
  });

  it('first clear: the bonus is announced once, and a repeat says there is none', () => {
    const base = { enemy: { slug: 'procrastination-wyrm', name: 'The Procrastination Wyrm', isBoss: true } };
    show(fakeSummary({ ...base, firstClear: { bossSlug: 'procrastination-wyrm', xp: 100, awarded: true } }));
    expect(screen.getByTestId('first-clear').textContent).toMatch(/First clear.*\+100 bonus XP/);
    cleanup();
    show(fakeSummary({ ...base, firstClear: { bossSlug: 'procrastination-wyrm', xp: 100, awarded: false } }));
    expect(screen.getByTestId('first-clear').textContent).toMatch(/no first-clear bonus/);
  });

  it('missed questions list the right answer and explanation, name the weak spot, and offer to add them as flashcards', () => {
    const add = vi.fn();
    show(fakeSummary({ missed: missed(2), weakSpot: { subject: 'Math', missed: 2 } }), { onAddMissed: add });
    expect(screen.getByText('Question 1?')).toBeTruthy();
    expect(screen.getAllByText(/Answer:/)).toHaveLength(2);
    expect(screen.getByText('Because y.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Review those cards/ }).getAttribute('href')).toBe('/lab');
    fireEvent.click(screen.getByRole('button', { name: 'Add missed questions to my flashcards' }));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('after adding, the button is replaced by the result message; questions that are already cards need no button', () => {
    show(fakeSummary({ missed: missed(1) }), { addedMessage: 'Added 1 card to the deck "Missed in battle".' });
    expect(screen.queryByRole('button', { name: /Add missed/ })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Added 1 card/);
    cleanup();
    show(fakeSummary({ missed: missed(2, true) }));
    expect(screen.queryByRole('button', { name: /Add missed/ })).toBeNull();
    expect(screen.getByText(/already your own flashcards/)).toBeTruthy();
  });

  it('loot: an equipped drop, a kept drop and a duplicate each say what happened', () => {
    const loot = { slug: 'dragon-slayer', name: 'Dragon Slayer', slot: 'weapon' as const, rarity: 'rare' as const, atk: 8, def: 0, effect: 'ignore_def_25', equipped: false, duplicate: false, duplicateXp: 0 };
    show(fakeSummary({ loot }));
    expect(screen.getByTestId('loot').textContent).toMatch(/\+8 ATK.*Ignores 25% of enemy DEF/);
    expect(screen.getByTestId('loot').textContent).toMatch(/Equip it in Camp/);
    cleanup();
    show(fakeSummary({ loot: { ...loot, equipped: true } }));
    expect(screen.getByTestId('loot').textContent).toMatch(/Equipped automatically/);
    cleanup();
    show(fakeSummary({ loot: { ...loot, duplicate: true, duplicateXp: 12 } }));
    expect(screen.getByTestId('loot').textContent).toMatch(/turned into \+12 bonus XP/);
  });

  it('a level-up shows the new level', () => {
    show(fakeSummary({ levelsGained: 1, progress: { ...fakeSummary().progress, level: 4 } }));
    expect(screen.getByText('Level 4')).toBeTruthy();
  });
});
