import { buildCardChoices, normalizeText } from '@studyverse/shared';
import type { Flashcard } from '../generated/prisma/client.js';
import type { Db } from '../lib/prisma.js';

export interface CardQuizItem {
  card: Flashcard;
  /** Exactly 3 choices (1 correct + 2 wrong), already shuffled. */
  choices: string[];
  correctIndex: number;
}

/**
 * Builds 3-choice quiz items from flashcards (03-core-modules section 4). A card with fewer than 2 usable
 * wrong answers borrows plausible ones from other cards (same deck first, then same subject); if there
 * are still not enough, the card is skipped for quizzes/battles (it stays available in Lab review).
 * `seed` keeps the shuffle reproducible. Never produces "N/A" or empty choices.
 */
export async function buildCardQuizItems(
  db: Db,
  userId: string,
  cards: readonly Flashcard[],
  seed: number,
): Promise<CardQuizItem[]> {
  if (cards.length === 0) return [];
  const pool = await db.flashcard.findMany({
    where: { userId },
    select: { id: true, deckId: true, subject: true, answer: true },
    take: 5000,
  });
  const out: CardQuizItem[] = [];
  cards.forEach((card, i) => {
    const sameDeck = pool.filter((p) => p.deckId === card.deckId && p.id !== card.id);
    const sameSubject = pool.filter(
      (p) =>
        p.deckId !== card.deckId &&
        normalizeText(p.subject) === normalizeText(card.subject) &&
        p.id !== card.id,
    );
    const choices = buildCardChoices({
      correct: card.answer,
      own: card.distractors,
      borrowFrom: [sameDeck.map((p) => p.answer), sameSubject.map((p) => p.answer)],
      seed: seed + i * 7919,
    });
    if (!choices) return;
    const correctIndex = choices.indexOf(card.answer.trim());
    if (correctIndex < 0) return;
    out.push({ card, choices, correctIndex });
  });
  return out;
}
