import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleDto } from '@studyverse/shared';
import { BattlePage } from './BattlePage';
import { fakeBattle, fakeResult, fakeSummary } from './testFixtures';

const b = vi.hoisted(() => ({ get: vi.fn(), move: vi.fn(), ability: vi.fn(), answer: vi.fn(), retreat: vi.fn(), finish: vi.fn(), missedToCards: vi.fn() }));
vi.mock('../../lib/api', () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
  },
  api: { battles: b },
}));

const QUESTION = { text: 'What is 6 x 7?', choices: ['42', '48', '36'] };
const asked = (over: Partial<BattleDto> = {}) => fakeBattle({ phase: 'awaitingAnswer', move: 'steady', question: QUESTION, ...over });

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/battle/b1']}>
        <Routes>
          <Route path="/battle/:battleId" element={<BattlePage />} />
          <Route path="/dungeons" element={<p>Adventure page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  Object.values(b).forEach((m) => m.mockReset());
});
afterEach(cleanup);

describe('battle screen', () => {
  it('opens with the enemy intro, then asks for a move BEFORE any question exists on screen', async () => {
    b.get.mockResolvedValue(fakeBattle());
    renderScreen();
    expect(await screen.findByRole('heading', { name: /Goblin Chieftain/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    const moves = screen.getByRole('group', { name: 'Choose your move' });
    expect(moves.textContent).toMatch(/Steady/);
    expect(moves.textContent).toMatch(/Easier question/); // Brace's exact effect text
    expect(moves.textContent).toMatch(/Harder question/); // Bold's exact effect text
    expect(screen.queryByTestId('question')).toBeNull();
    expect(screen.getByTestId('intent').textContent).toMatch(/Strike/);
    expect(screen.getByRole('button', { name: /Steady/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('plays a turn: Bold -> question -> answer -> explanation -> Continue, all through the server', async () => {
    b.get.mockResolvedValue(fakeBattle());
    b.move.mockResolvedValue({ turnNumber: 1, question: QUESTION, battle: asked({ move: 'bold' }) });
    const result = fakeResult({ correct: true, selectedIndex: 0, correctIndex: 0, damageDealt: 19, explanation: '6 times 7 is 42.', events: [{ type: 'hit', text: 'You hit for 19.' }] });
    b.answer.mockResolvedValue({ result, battle: fakeBattle({ turn: 2, lastResult: result, enemy: { ...fakeBattle().enemy, hp: 53 } }) });
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Begin' }));
    fireEvent.click(screen.getByRole('button', { name: /Bold/ }));
    expect(await screen.findByTestId('question')).toBeTruthy();
    expect(b.move).toHaveBeenCalledWith('b1', 1, 'bold');
    expect(screen.getByTestId('question').textContent).toBe('What is 6 x 7?');
    fireEvent.click(screen.getByRole('button', { name: '42' }));
    expect(await screen.findByText('Correct!')).toBeTruthy();
    expect(b.answer).toHaveBeenCalledWith('b1', 1, 0);
    expect(screen.getByTestId('explanation').textContent).toBe('6 times 7 is 42.');
    expect(screen.getByText(/You deal 19 damage/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByRole('group', { name: 'Choose your move' })).toBeTruthy();
    expect(screen.queryByTestId('question')).toBeNull();
  });

  it('a wrong answer without an explanation says so honestly', async () => {
    b.get.mockResolvedValue(asked());
    const result = fakeResult({ correct: false, selectedIndex: 1, correctIndex: 0, damageTaken: 8 });
    b.answer.mockResolvedValue({ result, battle: fakeBattle({ turn: 2, lastResult: result }) });
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: '48' }));
    expect(await screen.findByText('Not quite.')).toBeTruthy();
    expect(screen.getByTestId('explanation').textContent).toMatch(/No explanation yet/);
    expect(screen.getByText(/You take 8 damage/)).toBeTruthy();
  });

  it('refreshing at awaitingAnswer resumes the same question without the intro', async () => {
    b.get.mockResolvedValue(asked({ turn: 3, lastResult: fakeResult() }));
    renderScreen();
    expect((await screen.findByTestId('question')).textContent).toBe('What is 6 x 7?');
    expect(screen.queryByRole('button', { name: 'Begin' })).toBeNull();
  });

  it('keyboard: W highlights Brace, Enter confirms; 1/2/3 answer', async () => {
    b.get.mockResolvedValue(fakeBattle({ turn: 2, lastResult: fakeResult() }));
    b.move.mockResolvedValue({ turnNumber: 2, question: QUESTION, battle: asked({ turn: 2, move: 'brace' }) });
    renderScreen();
    await screen.findByRole('group', { name: 'Choose your move' });
    fireEvent.keyDown(window, { key: 'w' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Brace/ }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(await screen.findByTestId('question')).toBeTruthy();
    expect(b.move).toHaveBeenCalledWith('b1', 2, 'brace');
    b.answer.mockResolvedValue({ result: fakeResult({ turnNumber: 2 }), battle: fakeBattle({ turn: 3 }) });
    fireEvent.keyDown(window, { key: '3' });
    await waitFor(() => expect(b.answer).toHaveBeenCalledWith('b1', 2, 2));
  });

  it('Auto-Steady sends Steady by itself and shows no move buttons', async () => {
    window.localStorage.setItem('studyverse.skipTactics', 'on');
    b.get.mockResolvedValue(fakeBattle({ turn: 2, lastResult: fakeResult() }));
    b.move.mockResolvedValue({ turnNumber: 2, question: QUESTION, battle: asked({ turn: 2 }) });
    renderScreen();
    expect(await screen.findByTestId('question')).toBeTruthy();
    expect(b.move).toHaveBeenCalledWith('b1', 2, 'steady');
    expect(screen.queryByRole('group', { name: 'Choose your move' })).toBeNull();
  });

  it('a failed answer shows a retry message and keeps the question; it is never skipped', async () => {
    b.get.mockResolvedValue(asked());
    b.answer.mockRejectedValueOnce(new Error('Network down'));
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: '42' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Network down/);
    expect(screen.getByTestId('question')).toBeTruthy();
    expect((screen.getByRole('button', { name: '42' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('the final answer leads to rewards from the server summary (finish is called once)', async () => {
    b.get.mockResolvedValue(asked());
    const result = fakeResult({ correct: true, damageDealt: 30, ended: true, outcome: 'victory' });
    b.answer.mockResolvedValue({ result, battle: fakeBattle({ phase: 'ended', status: 'victory', lastResult: result, endedAt: 'x' }) });
    b.finish.mockResolvedValue(fakeSummary({ loot: { slug: 'steel-sword', name: 'Steel Sword', slot: 'weapon', rarity: 'uncommon', atk: 5, def: 0, effect: null, equipped: false, duplicate: false, duplicateXp: 0 }, levelsGained: 1 }));
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: '42' }));
    fireEvent.click(await screen.findByRole('button', { name: /See rewards/ }));
    expect(await screen.findByRole('heading', { name: 'Victory!' })).toBeTruthy();
    expect(screen.getByTestId('loot').textContent).toMatch(/Steel Sword/);
    expect(screen.getByText('Level up')).toBeTruthy();
    expect(b.finish).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Return to dungeon' }).getAttribute('href')).toBe('/dungeons');
  });

  it('Retreat asks first, then goes to a rewards screen that shows nothing was paid', async () => {
    b.get.mockResolvedValue(fakeBattle({ turn: 2, lastResult: fakeResult() }));
    b.retreat.mockResolvedValue(fakeBattle({ phase: 'ended', status: 'retreated' }));
    b.finish.mockResolvedValue(fakeSummary({ outcome: 'retreated', xp: { requested: 0, awarded: 0, capped: false, dailyCap: null }, energy: 0, asked: 1, correct: 0 }));
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'Retreat' }));
    expect(screen.getByRole('dialog').textContent).toMatch(/not refunded/);
    expect(b.retreat).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Retreat' }));
    expect(await screen.findByRole('heading', { name: 'You retreated' })).toBeTruthy();
    expect(b.retreat).toHaveBeenCalledTimes(1);
    expect(b.finish).toHaveBeenCalledTimes(1);
    expect(screen.getByText('+0')).toBeTruthy();
  });

  it('a battle that does not belong to you is a clear "not found" with a way out', async () => {
    const { ApiError } = await import('../../lib/api');
    b.get.mockRejectedValue(new ApiError(404, 'BATTLE_NOT_FOUND', 'Battle not found'));
    renderScreen();
    expect((await screen.findByRole('alert')).textContent).toMatch(/not found/i);
    expect(screen.getByRole('link', { name: 'Back to Adventure' })).toBeTruthy();
  });

  it('has no HUD, hotbar or navigation of its own', async () => {
    b.get.mockResolvedValue(fakeBattle());
    renderScreen();
    await screen.findByRole('button', { name: 'Begin' });
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
