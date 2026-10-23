import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardsForm, rowsToCards, type Row } from './CardsForm';

const m = vi.hoisted(() => ({ addCards: vi.fn() }));
vi.mock('../../lib/api', () => ({
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error'),
  api: { decks: { addCards: m.addCards } },
}));

const row = (key: number, o: Partial<Row> = {}): Row => ({
  key,
  question: '',
  answer: '',
  wrong1: '',
  wrong2: '',
  ...o,
});

describe('rowsToCards', () => {
  it('skips empty rows and keeps every filled row', () => {
    const r = rowsToCards(
      [row(1, { question: 'A?', answer: 'a' }), row(2), row(3, { question: 'B?', answer: 'b' })],
      'easy',
      'Math',
    );
    expect(r.error).toBeNull();
    expect(r.cards.map((c) => c.question)).toEqual(['A?', 'B?']);
  });

  it('never keeps placeholder or blank wrong answers', () => {
    const r = rowsToCards(
      [row(1, { question: 'Q', answer: 'Paris', wrong1: 'N/A', wrong2: '  ' })],
      'medium',
      'History',
    );
    expect(r.cards[0]?.distractors).toEqual([]);
  });

  it('reports a half-filled row instead of dropping it silently', () => {
    const r = rowsToCards([row(1, { question: 'Q only' })], 'medium', 'Other');
    expect(r.cards).toEqual([]);
    expect(r.error).toMatch(/Row 1 needs both/);
  });

  it('asks for at least one card', () => {
    expect(rowsToCards([row(1), row(2)], 'medium', 'Other').error).toMatch(/at least one card/);
  });
});

describe('CardsForm', () => {
  beforeEach(() => m.addCards.mockReset().mockResolvedValue([{ id: 'c1' }]));
  afterEach(cleanup);

  it('sends only real wrong answers and refetches instead of patching local state', async () => {
    const deck = { id: 'deck-1', name: 'D', subject: 'History', cardCount: 0, dueCount: 0, createdAt: '' };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CardsForm deck={deck} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getAllByLabelText('Question')[0] as HTMLElement, {
      target: { value: 'Capital of France?' },
    });
    fireEvent.change(screen.getAllByLabelText('Correct answer')[0] as HTMLElement, {
      target: { value: 'Paris' },
    });
    fireEvent.change(screen.getAllByLabelText('Wrong answer 1 (optional)')[0] as HTMLElement, {
      target: { value: 'N/A' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save cards' }));
    await waitFor(() => expect(m.addCards).toHaveBeenCalledTimes(1));
    const [deckId, cards] = m.addCards.mock.calls[0] as [string, { distractors: string[] }[]];
    expect(deckId).toBe('deck-1');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.distractors).toEqual([]);
    expect(await screen.findByText(/Added 1 card\./)).toBeTruthy();
  });
});
