import {
  BALANCE,
  cleanDistractors,
  type CardDto,
  type CardPatch,
  type CardsCreate,
  type DeckDto,
} from '@studyverse/shared';
import type { Flashcard, FlashcardDeck } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import type { PrismaClient } from '../lib/prisma.js';
import { ensurePlayer } from './player.js';

export const toCardDto = (c: Flashcard): CardDto => ({
  id: c.id,
  deckId: c.deckId,
  question: c.question,
  answer: c.answer,
  distractors: c.distractors,
  subject: c.subject,
  difficulty: c.difficulty,
  ease: c.ease,
  intervalDays: c.intervalDays,
  repetitions: c.repetitions,
  dueAt: c.dueAt.toISOString(),
});

const deckNotFound = () => new AppError(404, 'DECK_NOT_FOUND', 'Deck not found');
const cardNotFound = () => new AppError(404, 'CARD_NOT_FOUND', 'Card not found');

function toDeckDto(d: FlashcardDeck, cardCount: number, dueCount: number): DeckDto {
  return {
    id: d.id,
    name: d.name,
    subject: d.subject,
    cardCount,
    dueCount,
    createdAt: d.createdAt.toISOString(),
  };
}

async function counts(prisma: PrismaClient, userId: string, now: Date) {
  const [all, due] = await Promise.all([
    prisma.flashcard.groupBy({ by: ['deckId'], where: { userId }, _count: { _all: true } }),
    prisma.flashcard.groupBy({
      by: ['deckId'],
      where: { userId, dueAt: { lte: now } },
      _count: { _all: true },
    }),
  ]);
  return {
    all: new Map(all.map((r) => [r.deckId, r._count._all])),
    due: new Map(due.map((r) => [r.deckId, r._count._all])),
  };
}

export async function listDecks(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<DeckDto[]> {
  await ensurePlayer(prisma, userId);
  const [decks, c] = await Promise.all([
    prisma.flashcardDeck.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    counts(prisma, userId, now),
  ]);
  return decks.map((d) => toDeckDto(d, c.all.get(d.id) ?? 0, c.due.get(d.id) ?? 0));
}

export async function createDeck(
  prisma: PrismaClient,
  userId: string,
  input: { name: string; subject: string },
  now: Date,
): Promise<DeckDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    if ((await tx.flashcardDeck.count({ where: { userId } })) >= BALANCE.flashcards.maxDecksPerUser)
      throw new AppError(409, 'TOO_MANY_DECKS', 'You have reached the deck limit.');
    const d = await tx.flashcardDeck.create({ data: { userId, ...input } });
    void now;
    return toDeckDto(d, 0, 0);
  });
}

export async function patchDeck(
  prisma: PrismaClient,
  userId: string,
  id: string,
  patch: { name?: string | undefined; subject?: string | undefined },
  now: Date,
): Promise<DeckDto> {
  const res = await prisma.flashcardDeck.updateMany({
    where: { id, userId },
    data: {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.subject !== undefined && { subject: patch.subject }),
    },
  });
  if (res.count === 0) throw deckNotFound();
  const d = await prisma.flashcardDeck.findFirstOrThrow({ where: { id, userId } });
  const c = await counts(prisma, userId, now);
  return toDeckDto(d, c.all.get(id) ?? 0, c.due.get(id) ?? 0);
}

/** Deleting a deck deletes its cards (the UI confirms first). Reviews cascade; quiz snapshots survive. */
export async function deleteDeck(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const res = await prisma.flashcardDeck.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw deckNotFound();
}

export async function listCards(
  prisma: PrismaClient,
  userId: string,
  deckId: string,
): Promise<CardDto[]> {
  const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId } });
  if (!deck) throw deckNotFound();
  const cards = await prisma.flashcard.findMany({
    where: { deckId, userId },
    orderBy: { createdAt: 'asc' },
    take: BALANCE.flashcards.maxCardsPerUser,
  });
  return cards.map(toCardDto);
}

/**
 * Adding cards is an INSERT per card: nothing existing is ever replaced (the root cause of the old
 * "my new card vanished" bug). Placeholder / empty / duplicate wrong answers are dropped on the way in.
 */
export async function createCards(
  prisma: PrismaClient,
  userId: string,
  deckId: string,
  input: CardsCreate,
): Promise<CardDto[]> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    const deck = await tx.flashcardDeck.findFirst({ where: { id: deckId, userId } });
    if (!deck) throw deckNotFound();
    const total = await tx.flashcard.count({ where: { userId } });
    if (total + input.cards.length > BALANCE.flashcards.maxCardsPerUser)
      throw new AppError(409, 'TOO_MANY_CARDS', 'This would exceed the card limit.');
    const created: Flashcard[] = [];
    for (const c of input.cards) {
      created.push(
        await tx.flashcard.create({
          data: {
            deckId,
            userId,
            question: c.question,
            answer: c.answer,
            subject: c.subject ?? deck.subject,
            difficulty: c.difficulty,
            distractors: cleanDistractors(c.answer, c.distractors),
          },
        }),
      );
    }
    return created.map(toCardDto);
  });
}

export async function patchCard(
  prisma: PrismaClient,
  userId: string,
  id: string,
  patch: CardPatch,
): Promise<CardDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const card = await tx.flashcard.findFirst({ where: { id, userId } });
    if (!card) throw cardNotFound();
    if (patch.deckId) {
      const deck = await tx.flashcardDeck.findFirst({ where: { id: patch.deckId, userId } });
      if (!deck) throw deckNotFound();
    }
    const answer = patch.answer ?? card.answer;
    const distractors =
      patch.distractors !== undefined || patch.answer !== undefined
        ? cleanDistractors(answer, patch.distractors ?? card.distractors)
        : undefined;
    await tx.flashcard.updateMany({
      where: { id, userId },
      data: {
        ...(patch.question !== undefined && { question: patch.question }),
        ...(patch.answer !== undefined && { answer: patch.answer }),
        ...(patch.subject !== undefined && { subject: patch.subject }),
        ...(patch.difficulty !== undefined && { difficulty: patch.difficulty }),
        ...(patch.deckId !== undefined && { deckId: patch.deckId }),
        ...(distractors !== undefined && { distractors }),
      },
    });
    return toCardDto(await tx.flashcard.findFirstOrThrow({ where: { id, userId } }));
  });
}

export async function deleteCard(prisma: PrismaClient, userId: string, id: string): Promise<void> {
  const res = await prisma.flashcard.deleteMany({ where: { id, userId } });
  if (res.count === 0) throw cardNotFound();
}
