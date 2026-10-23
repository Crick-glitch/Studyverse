import {
  BALANCE,
  normalizeText,
  ratingToQuality,
  type Rating,
  type ReviewItemDto,
  type ReviewResultDto,
  type ReviewSubmit,
} from '@studyverse/shared';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import type { PrismaClient } from '../lib/prisma.js';
import { buildCardQuizItems } from './cardChoices.js';
import { applyCardReview } from './cardReview.js';
import { toCardDto } from './decks.js';
import { ensurePlayer } from './player.js';
import { recordQuestEvent } from './quests.js';
import { getModifiers } from './streak.js';

/**
 * The review queue: due cards, oldest first. A card with 3 plausible choices is served in `choice` mode
 * WITHOUT its answer (the answer comes back after the player answers). A card that cannot form choices is
 * served in `reveal` mode: the player sees their own answer text and rates themselves.
 */
export async function getDueQueue(
  prisma: PrismaClient,
  userId: string,
  q: { deckId?: string | undefined; limit: number },
  now: Date,
): Promise<{ items: ReviewItemDto[]; dueTotal: number }> {
  await ensurePlayer(prisma, userId);
  const where = { userId, dueAt: { lte: now }, ...(q.deckId && { deckId: q.deckId }) };
  if (q.deckId) {
    const deck = await prisma.flashcardDeck.findFirst({ where: { id: q.deckId, userId } });
    if (!deck) throw new AppError(404, 'DECK_NOT_FOUND', 'Deck not found');
  }
  const [cards, dueTotal] = await Promise.all([
    prisma.flashcard.findMany({ where, orderBy: { dueAt: 'asc' }, take: q.limit }),
    prisma.flashcard.count({ where }),
  ]);
  const quiz = await buildCardQuizItems(
    prisma,
    userId,
    cards,
    Math.floor(now.getTime() / 60_000),
  );
  const byId = new Map(quiz.map((i) => [i.card.id, i]));
  const items = cards.map((c): ReviewItemDto => {
    const base = {
      id: c.id,
      deckId: c.deckId,
      question: c.question,
      subject: c.subject,
      dueAt: c.dueAt.toISOString(),
    };
    const item = byId.get(c.id);
    return item
      ? { ...base, mode: 'choice', choices: item.choices }
      : { ...base, mode: 'reveal', answer: c.answer };
  });
  return { items, dueTotal };
}

/**
 * Applies one review. Rules:
 *  - only cards that are DUE can be reviewed (reviewing a card early would let the same card be farmed
 *    for the daily "review 10 cards" quest); a card not yet due is a 409;
 *  - `dueAtSeen` is a compare-and-set token: a double-click, a retry or a second tab finds the schedule
 *    already moved, so nothing is applied twice (`applied: false`, nothing changes);
 *  - the quest metric `cards_reviewed` moves only when a review was actually applied.
 */
export async function submitReview(
  prisma: PrismaClient,
  userId: string,
  cardId: string,
  input: ReviewSubmit,
  now: Date,
): Promise<ReviewResultDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    const card = await tx.flashcard.findFirst({ where: { id: cardId, userId } });
    if (!card) throw new AppError(404, 'CARD_NOT_FOUND', 'Card not found');
    const seen = new Date(input.dueAtSeen);

    let quality: number;
    let correct: boolean | null = null;
    if (input.mode === 'choice') {
      correct = normalizeText(input.chosenAnswer) === normalizeText(card.answer);
      quality = correct ? BALANCE.srs.choiceCorrectQuality : BALANCE.srs.choiceWrongQuality;
    } else {
      quality = ratingToQuality(input.rating as Rating);
      correct = quality >= BALANCE.srs.passQuality;
    }

    if (seen.getTime() !== card.dueAt.getTime()) {
      // Someone (a double click, another tab) already reviewed this card: report, change nothing.
      return {
        card: toCardDto(card),
        correct,
        correctAnswer: input.mode === 'choice' ? card.answer : null,
        intervalDays: card.intervalDays,
        applied: false,
      };
    }
    if (card.dueAt.getTime() > now.getTime())
      throw new AppError(409, 'CARD_NOT_DUE', 'This card is not due for review yet.');

    const mods = await getModifiers(tx, userId);
    const res = await applyCardReview(tx, {
      userId,
      card,
      quality,
      now,
      context: 'review',
      sageMemory: mods.sageMemory,
    });
    if (res.applied) await recordQuestEvent(tx, userId, 'cards_reviewed', 1, now);
    return {
      card: toCardDto(res.card),
      correct,
      correctAnswer: input.mode === 'choice' ? card.answer : null,
      intervalDays: res.card.intervalDays,
      applied: res.applied,
    };
  });
}
