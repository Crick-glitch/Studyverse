import {
  BALANCE,
  cardDedupeKey,
  flashcardsToCsv,
  parseFlashcardCsv,
  type CsvImportResultDto,
  type CsvPreviewDto,
} from '@studyverse/shared';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import type { PrismaClient } from '../lib/prisma.js';
import { ensurePlayer } from './player.js';

/** Parses + dedupes a CSV against the deck's existing cards and itself. Nothing is written. */
async function analyse(
  db: Pick<PrismaClient, 'flashcard' | 'flashcardDeck'>,
  userId: string,
  deckId: string,
  csv: string,
) {
  const deck = await db.flashcardDeck.findFirst({ where: { id: deckId, userId } });
  if (!deck) throw new AppError(404, 'DECK_NOT_FOUND', 'Deck not found');
  const parsed = parseFlashcardCsv(csv);
  const existing = await db.flashcard.findMany({
    where: { deckId, userId },
    select: { question: true },
  });
  const seen = new Set(existing.map((c) => cardDedupeKey(c.question)));
  const fresh = [];
  let duplicates = 0;
  for (const c of parsed.cards) {
    const key = cardDedupeKey(c.question);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    fresh.push(c);
  }
  return { deck, parsed, fresh, duplicates };
}

const toPreview = (a: Awaited<ReturnType<typeof analyse>>): CsvPreviewDto => ({
  totalRows: a.parsed.totalRows,
  valid: a.fresh.length,
  duplicates: a.duplicates,
  errors: a.parsed.errors,
  fatal: a.parsed.fatal ?? null,
  sample: a.fresh.slice(0, 10).map((c) => ({
    row: c.row,
    question: c.question,
    answer: c.answer,
    distractors: c.distractors,
  })),
});

export async function previewCsv(
  prisma: PrismaClient,
  userId: string,
  deckId: string,
  csv: string,
): Promise<CsvPreviewDto> {
  await ensurePlayer(prisma, userId);
  return toPreview(await analyse(prisma, userId, deckId, csv));
}

/** Imports the valid, non-duplicate rows. Bad rows never block good ones; they are reported by row number. */
export async function importCsv(
  prisma: PrismaClient,
  userId: string,
  deckId: string,
  csv: string,
): Promise<CsvImportResultDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(
    prisma,
    userId,
    async (tx) => {
      const a = await analyse(tx, userId, deckId, csv);
      const preview = toPreview(a);
      if (a.parsed.fatal) return { ...preview, imported: 0 };
      const total = await tx.flashcard.count({ where: { userId } });
      if (total + a.fresh.length > BALANCE.flashcards.maxCardsPerUser)
        throw new AppError(409, 'TOO_MANY_CARDS', 'This import would exceed the card limit.');
      if (a.fresh.length > 0) {
        await tx.flashcard.createMany({
          data: a.fresh.map((c) => ({
            deckId,
            userId,
            question: c.question,
            answer: c.answer,
            distractors: c.distractors,
            subject: c.subject ?? a.deck.subject,
            difficulty: c.difficulty ?? 'medium',
            ...(c.review && {
              ease: c.review.ease,
              intervalDays: c.review.intervalDays,
              repetitions: c.review.repetitions,
              dueAt: c.review.dueAt,
            }),
          })),
        });
      }
      return { ...preview, imported: a.fresh.length };
    },
    { timeoutMs: 30_000 },
  );
}

/** Export one deck (or every deck when deckId is omitted). Review data only when the player opts in. */
export async function exportCsv(
  prisma: PrismaClient,
  userId: string,
  deckId: string | undefined,
  includeReview: boolean,
): Promise<{ csv: string; filename: string }> {
  await ensurePlayer(prisma, userId);
  let name = 'all-decks';
  if (deckId) {
    const deck = await prisma.flashcardDeck.findFirst({ where: { id: deckId, userId } });
    if (!deck) throw new AppError(404, 'DECK_NOT_FOUND', 'Deck not found');
    name =
      deck.name
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'deck';
  }
  const cards = await prisma.flashcard.findMany({
    where: { userId, ...(deckId && { deckId }) },
    orderBy: [{ deckId: 'asc' }, { createdAt: 'asc' }],
    take: BALANCE.flashcards.maxCardsPerUser,
  });
  return {
    csv: flashcardsToCsv(cards, includeReview),
    filename: `studyverse-flashcards-${name}.csv`,
  };
}
