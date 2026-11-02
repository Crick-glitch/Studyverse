import { bankSubject, type Subject } from '@studyverse/shared';
import type { PoolQuestion } from '../battle/types.js';
import type { Prisma } from '../lib/prisma.js';
import { buildCardQuizItems } from './cardChoices.js';

type Tx = Prisma.TransactionClient;

/**
 * The questions a battle may draw: the built-in bank for the subject plus the player's DUE flashcards in that
 * subject (so battles review what is due). Cards with too few usable wrong answers are skipped (never "N/A").
 * Questions flagged `needsReview` stay in (docs/DECISIONS.md, session 03) and players can report them.
 */
export async function buildPool(
  tx: Tx,
  userId: string,
  subject: string,
  now: Date,
  seed: number,
): Promise<PoolQuestion[]> {
  const bank = await tx.question.findMany({ where: subject === 'Any' ? {} : { subject } });
  const pool: PoolQuestion[] = bank
    .filter((q) => q.choices.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.choices.length)
    .map((q) => ({
      ref: `bank:${q.id}`,
      source: 'bank' as const,
      id: q.id,
      difficulty: q.difficulty,
      subject: q.subject,
      text: q.text,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      due: false,
    }));

  let cards = await tx.flashcard.findMany({
    where: { userId, dueAt: { lte: now } },
    orderBy: { dueAt: 'asc' },
    take: 200,
  });
  if (subject !== 'Any') cards = cards.filter((c) => bankSubject(c.subject) === (subject as Subject));
  for (const item of await buildCardQuizItems(tx, userId, cards, seed)) {
    pool.push({
      ref: `card:${item.card.id}`,
      source: 'card',
      id: item.card.id,
      difficulty: item.card.difficulty,
      subject: bankSubject(item.card.subject),
      text: item.card.question,
      choices: item.choices,
      correctIndex: item.correctIndex,
      explanation: null,
      due: true,
    });
  }
  return pool;
}

/** For "Any" battles: the player's weakest subjects by recent battle accuracy (needs 5+ answers per subject). */
export async function weakSubjects(tx: Tx, userId: string): Promise<string[]> {
  const turns = await tx.battleTurn.findMany({
    where: { battle: { userId }, answeredAt: { not: null }, questionSubject: { not: null } },
    orderBy: { answeredAt: 'desc' },
    take: 200,
    select: { questionSubject: true, correct: true },
  });
  const by = new Map<string, { n: number; ok: number }>();
  for (const t of turns) {
    const k = t.questionSubject as string;
    const e = by.get(k) ?? { n: 0, ok: 0 };
    e.n += 1;
    if (t.correct) e.ok += 1;
    by.set(k, e);
  }
  return [...by.entries()]
    .filter(([, e]) => e.n >= 5)
    .map(([k, e]) => ({ k, acc: e.ok / e.n }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 2)
    .map((e) => e.k);
}
