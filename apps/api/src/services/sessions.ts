import {
  BALANCE,
  bankSubject,
  clampFocus,
  computeSessionReward,
  elapsedMinutes,
  hashString,
  passThreshold,
  reviewSessionMinutes,
  seededRng,
  sessionBaseEnergy,
  sessionBaseXp,
  sessionEligibility,
  shuffled,
  type ClaimQuestionDto,
  type ClaimResultDto,
  type SessionClaim,
  type SessionCreate,
  type SessionDto,
  type SessionFinishResultDto,
  type SessionStatus,
} from '@studyverse/shared';
import type { SessionClaimQuestion, StudySession } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import type { Prisma, PrismaClient } from '../lib/prisma.js';
import { grantXp } from '../lib/xp.js';
import { applyCardReview } from './cardReview.js';
import { buildCardQuizItems } from './cardChoices.js';
import { ensurePlayer, toProgressDto } from './player.js';
import { recordQuestEvent } from './quests.js';
import { addEnergy, getModifiers, touchStreak } from './streak.js';

type Tx = Prisma.TransactionClient;
type TimedSession = Pick<
  StudySession,
  'status' | 'startedAt' | 'pausedAt' | 'pausedTotalSec' | 'finishedAt' | 'plannedMinutes'
>;

const notFound = () => new AppError(404, 'SESSION_NOT_FOUND', 'Session not found');

/**
 * Seconds of focus time so far, measured with SERVER timestamps only: (end - start) minus paused time,
 * capped at the plan. `end` is now while running, the pause moment while paused, finishedAt afterwards.
 */
export function sessionElapsedSec(s: TimedSession, now: Date): number {
  if (!s.startedAt) return 0;
  const endMs =
    s.status === 'running'
      ? now.getTime()
      : s.status === 'paused'
        ? (s.pausedAt ?? now).getTime()
        : (s.finishedAt ?? now).getTime();
  const raw = Math.floor((endMs - s.startedAt.getTime()) / 1000) - s.pausedTotalSec;
  return Math.max(0, Math.min(s.plannedMinutes * 60, raw));
}

export function toSessionDto(s: StudySession, now: Date, streak: number): SessionDto {
  const elapsedSec = sessionElapsedSec(s, now);
  const planned = s.plannedMinutes * 60;
  const open = s.status === 'running' || s.status === 'paused';
  return {
    id: s.id,
    title: s.title,
    subject: s.subject,
    difficulty: s.difficulty,
    kind: s.kind,
    plannedMinutes: s.plannedMinutes,
    status: s.status as SessionStatus,
    startedAt: s.startedAt?.toISOString() ?? null,
    pausedAt: s.pausedAt?.toISOString() ?? null,
    finishedAt: s.finishedAt?.toISOString() ?? null,
    elapsedSec,
    remainingSec: s.status === 'created' ? planned : open ? Math.max(0, planned - elapsedSec) : 0,
    serverNow: now.toISOString(),
    focusRatioReported: s.focusRatioReported,
    xpAwarded: s.xpAwarded,
    energyAwarded: s.energyAwarded,
    outcomeReason: s.outcomeReason,
    estimate: {
      xp: sessionBaseXp(s.plannedMinutes, s.difficulty, streak),
      energy: sessionBaseEnergy(s.plannedMinutes),
    },
    createdAt: s.createdAt.toISOString(),
  };
}

async function streakOf(db: Tx | PrismaClient, userId: string): Promise<number> {
  const p = await db.playerProgress.findUnique({ where: { userId }, select: { streak: true } });
  return p?.streak ?? 0;
}

async function load(tx: Tx, userId: string, id: string): Promise<StudySession> {
  const s = await tx.studySession.findFirst({ where: { id, userId } });
  if (!s) throw notFound();
  return s;
}

/** Ends an open pause at `now` (adds its length to pausedTotalSec). */
function closePause(s: StudySession, now: Date): { pausedAt: null; pausedTotalSec: number } {
  const extra = s.pausedAt ? Math.max(0, Math.round((now.getTime() - s.pausedAt.getTime()) / 1000)) : 0;
  return { pausedAt: null, pausedTotalSec: s.pausedTotalSec + extra };
}

async function dto(tx: Tx | PrismaClient, s: StudySession, now: Date, userId: string) {
  return toSessionDto(s, now, await streakOf(tx, userId));
}

/**
 * Abandons running/paused sessions that cannot still be live: a running one started more than
 * staleOpenHours ago (plans are at most 50 minutes), or one paused for that long. Uses the same
 * (injectable) clock that stamped startedAt/pausedAt, never the database clock.
 */
async function abandonStale(tx: Tx, userId: string, now: Date): Promise<void> {
  const cutoff = now.getTime() - BALANCE.sessions.staleOpenHours * 3_600_000;
  const open = await tx.studySession.findMany({
    where: { userId, status: { in: ['running', 'paused'] } },
  });
  for (const s of open) {
    const since = (s.status === 'paused' ? s.pausedAt : s.startedAt) ?? s.startedAt;
    if (!since || since.getTime() >= cutoff) continue;
    await tx.studySession.update({
      where: { id: s.id },
      data: { status: 'abandoned', outcomeReason: 'stale', finishedAt: now, ...closePause(s, now) },
    });
  }
}

/* ------------------------------------------------------------------ create / list / read */

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  input: SessionCreate,
  now: Date,
): Promise<SessionDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    const waiting = await tx.studySession.count({ where: { userId, status: 'created' } });
    if (waiting >= BALANCE.sessions.maxCreatedAtOnce)
      throw new AppError(
        409,
        'TOO_MANY_SESSIONS',
        `You already have ${BALANCE.sessions.maxCreatedAtOnce} sessions waiting. Start or delete some first.`,
      );
    const s = await tx.studySession.create({
      data: {
        userId,
        title: input.title,
        subject: input.subject,
        difficulty: input.difficulty,
        plannedMinutes: input.plannedMinutes,
        kind: 'study',
      },
    });
    return dto(tx, s, now, userId);
  });
}

export async function listSessions(
  prisma: PrismaClient,
  userId: string,
  q: { status?: SessionStatus | undefined; limit: number },
  now: Date,
): Promise<SessionDto[]> {
  await ensurePlayer(prisma, userId);
  const streak = await streakOf(prisma, userId);
  const rows = await prisma.studySession.findMany({
    where: { userId, ...(q.status && { status: q.status }) },
    orderBy: { createdAt: 'desc' },
    take: q.limit,
  });
  return rows.map((s) => toSessionDto(s, now, streak));
}

export async function getSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<SessionDto> {
  const s = await prisma.studySession.findFirst({ where: { id, userId } });
  if (!s) throw notFound();
  return dto(prisma, s, now, userId);
}

/**
 * The session the UI should resume after a refresh: the running/paused one, else the most recent one
 * that is finished and waiting for its claim quiz. null when there is none.
 */
export async function getActiveSession(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<SessionDto | null> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    await abandonStale(tx, userId, now);
    const open = await tx.studySession.findFirst({
      where: { userId, status: { in: ['running', 'paused'] } },
      orderBy: { startedAt: 'desc' },
    });
    const s =
      open ??
      (await tx.studySession.findFirst({
        where: { userId, status: 'finished' },
        orderBy: { finishedAt: 'desc' },
      }));
    return s ? dto(tx, s, now, userId) : null;
  });
}

/* ------------------------------------------------------------------ lifecycle */

export async function startSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<SessionDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const s = await load(tx, userId, id);
    if (s.status === 'running') return dto(tx, s, now, userId); // double-click: same answer
    if (s.status !== 'created')
      throw new AppError(409, 'SESSION_NOT_STARTABLE', `A ${s.status} session cannot be started.`);
    await abandonStale(tx, userId, now);
    const other = await tx.studySession.findFirst({
      where: { userId, status: { in: ['running', 'paused'] }, id: { not: id } },
    });
    if (other)
      throw new AppError(
        409,
        'SESSION_ALREADY_RUNNING',
        'Another session is already in progress. Finish or abandon it first.',
        { sessionId: other.id },
      );
    const updated = await tx.studySession.update({
      where: { id },
      data: { status: 'running', startedAt: now, pausedAt: null, pausedTotalSec: 0 },
    });
    return dto(tx, updated, now, userId);
  });
}

export async function pauseSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<SessionDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const s = await load(tx, userId, id);
    if (s.status === 'paused') return dto(tx, s, now, userId);
    if (s.status !== 'running')
      throw new AppError(409, 'SESSION_NOT_RUNNING', 'Only a running session can be paused.');
    const updated = await tx.studySession.update({ where: { id }, data: { status: 'paused', pausedAt: now } });
    return dto(tx, updated, now, userId);
  });
}

export async function resumeSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<SessionDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const s = await load(tx, userId, id);
    if (s.status === 'running') return dto(tx, s, now, userId);
    if (s.status !== 'paused')
      throw new AppError(409, 'SESSION_NOT_PAUSED', 'Only a paused session can be resumed.');
    const updated = await tx.studySession.update({
      where: { id },
      data: { status: 'running', ...closePause(s, now) },
    });
    return dto(tx, updated, now, userId);
  });
}

export async function abandonSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<SessionDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const s = await load(tx, userId, id);
    if (s.status === 'abandoned') return dto(tx, s, now, userId);
    if (s.status === 'claimed')
      throw new AppError(409, 'SESSION_ALREADY_CLAIMED', 'This session was already claimed.');
    const updated = await tx.studySession.update({
      where: { id },
      data: {
        status: 'abandoned',
        outcomeReason: 'abandoned',
        finishedAt: s.status === 'created' ? null : now,
        ...closePause(s, now),
      },
    });
    return dto(tx, updated, now, userId);
  });
}

/** Removing a never-started session from the board (a started one is abandoned instead, never deleted). */
export async function deleteCreatedSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<void> {
  const res = await prisma.studySession.deleteMany({ where: { id, userId, status: 'created' } });
  if (res.count === 0) {
    const exists = await prisma.studySession.count({ where: { id, userId } });
    if (!exists) throw notFound();
    throw new AppError(409, 'SESSION_NOT_DELETABLE', 'Only a session that has not started can be deleted.');
  }
}

/**
 * Finish: the server measures elapsed time itself. Under 80% of the plan (or focus below 0.5) the session
 * pays nothing and is closed with a reason. Otherwise it becomes `finished` and its claim quiz exists.
 * Finishing twice returns the same result.
 */
export async function finishSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  focusRatio: number | undefined,
  now: Date,
): Promise<SessionFinishResultDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const s = await load(tx, userId, id);
    if (s.status === 'finished' || s.status === 'claimed')
      return { session: await dto(tx, s, now, userId), claimable: s.status === 'finished', ineligibleReason: null };
    if (s.status === 'abandoned')
      return {
        session: await dto(tx, s, now, userId),
        claimable: false,
        ineligibleReason: (s.outcomeReason === 'not_enough_time' || s.outcomeReason === 'not_enough_focus'
          ? s.outcomeReason
          : null) as SessionFinishResultDto['ineligibleReason'],
      };
    if (s.status !== 'running' && s.status !== 'paused')
      throw new AppError(409, 'SESSION_NOT_STARTED', 'Start the session before finishing it.');

    const pause = closePause(s, now);
    const closed: StudySession = { ...s, ...pause, status: 'running', finishedAt: now };
    const elapsedSec = sessionElapsedSec(closed, now);
    const focus = focusRatio === undefined ? null : clampFocus(focusRatio);
    const verdict = sessionEligibility({ elapsedSec, plannedMinutes: s.plannedMinutes, focusRatio: focus });

    if (!verdict.eligible) {
      const updated = await tx.studySession.update({
        where: { id },
        data: { ...pause, status: 'abandoned', finishedAt: now, focusRatioReported: focus, outcomeReason: verdict.reason },
      });
      return { session: await dto(tx, updated, now, userId), claimable: false, ineligibleReason: verdict.reason };
    }

    // Study sessions build their quiz now; review sessions already hold theirs (built at creation).
    if (s.kind === 'study') await buildBankClaimQuiz(tx, userId, s);
    const updated = await tx.studySession.update({
      where: { id },
      data: { ...pause, status: 'finished', finishedAt: now, focusRatioReported: focus },
    });
    return { session: await dto(tx, updated, now, userId), claimable: true, ineligibleReason: null };
  });
}

/* ------------------------------------------------------------------ claim quiz */

interface QuizRow {
  questionId: string | null;
  cardId: string | null;
  text: string;
  choices: string[];
  correctIndex: number;
}

/** Shuffles a question's choices (the bank stores the answer in a biased position) and remaps the index. */
function shuffleChoices(choices: string[], correctIndex: number, rng: () => number) {
  const order = shuffled(
    choices.map((c, i) => ({ c, i })),
    rng,
  );
  return {
    choices: order.map((o) => o.c),
    correctIndex: order.findIndex((o) => o.i === correctIndex),
  };
}

/**
 * Picks `count` bank questions for a session: same subject + difficulty first, then same subject, then
 * anything. Questions from the player's last few claim quizzes are avoided when the pool allows.
 * Questions flagged needsReview are INCLUDED (docs/DECISIONS.md): players can report them.
 */
async function pickBankQuestions(
  tx: Tx,
  userId: string,
  opts: { subject: string; difficulty: StudySession['difficulty'] | null; count: number; seed: number; excludeIds?: string[] },
): Promise<QuizRow[]> {
  const rng = seededRng(opts.seed);
  const subject = bankSubject(opts.subject);
  const recent = await tx.sessionClaimQuestion.findMany({
    where: { session: { userId }, questionId: { not: null } },
    orderBy: { presentedAt: 'desc' },
    take: opts.count * 4,
    select: { questionId: true },
  });
  const recentIds = new Set(recent.map((r) => r.questionId as string));
  const taken = new Set<string>(opts.excludeIds ?? []);
  const picked: QuizRow[] = [];

  const tiers: Prisma.QuestionWhereInput[] = [
    ...(opts.difficulty ? [{ subject, difficulty: opts.difficulty }] : [{ subject }]),
    { subject },
    {},
  ];
  for (const where of tiers) {
    if (picked.length >= opts.count) break;
    const pool = (await tx.question.findMany({ where, take: 500 })).filter(
      (q) => !taken.has(q.id) && q.choices.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.choices.length,
    );
    const fresh = shuffled(pool.filter((q) => !recentIds.has(q.id)), rng);
    const seen = shuffled(pool.filter((q) => recentIds.has(q.id)), rng);
    for (const q of [...fresh, ...seen]) {
      if (picked.length >= opts.count) break;
      taken.add(q.id);
      const sc = shuffleChoices(q.choices, q.correctIndex, rng);
      picked.push({ questionId: q.id, cardId: null, text: q.text, ...sc });
    }
  }
  return picked;
}

async function saveQuiz(tx: Tx, sessionId: string, rows: QuizRow[]): Promise<void> {
  await tx.sessionClaimQuestion.deleteMany({ where: { sessionId } });
  if (rows.length === 0) return;
  await tx.sessionClaimQuestion.createMany({
    data: rows.map((r, position) => ({ sessionId, position, ...r })),
  });
}

async function buildBankClaimQuiz(tx: Tx, userId: string, s: StudySession): Promise<void> {
  const rows = await pickBankQuestions(tx, userId, {
    subject: s.subject,
    difficulty: s.difficulty,
    count: BALANCE.sessions.claim.questionCount,
    seed: hashString(s.id),
  });
  await saveQuiz(tx, s.id, rows);
}

/**
 * Review session from due flashcards (the old "Create Review Session"). The quiz is built NOW from the
 * cards that are due (their text/choices are snapshotted), topped up with bank questions if fewer than
 * 5 cards can form 3 plausible choices.
 */
export async function createReviewSession(
  prisma: PrismaClient,
  userId: string,
  input: { deckId?: string | undefined; startNow: boolean },
  now: Date,
): Promise<SessionDto> {
  await ensurePlayer(prisma, userId);
  const created = await withPlayerLock(prisma, userId, async (tx) => {
    let deckName: string | null = null;
    if (input.deckId) {
      const deck = await tx.flashcardDeck.findFirst({ where: { id: input.deckId, userId } });
      if (!deck) throw new AppError(404, 'DECK_NOT_FOUND', 'Deck not found');
      deckName = deck.name;
    }
    const dueWhere = { userId, dueAt: { lte: now }, ...(input.deckId && { deckId: input.deckId }) };
    const dueCount = await tx.flashcard.count({ where: dueWhere });
    if (dueCount === 0) throw new AppError(409, 'NO_DUE_CARDS', 'No flashcards are due for review.');
    const waiting = await tx.studySession.count({ where: { userId, status: 'created' } });
    if (waiting >= BALANCE.sessions.maxCreatedAtOnce)
      throw new AppError(409, 'TOO_MANY_SESSIONS', 'You have too many sessions waiting.');

    const s = await tx.studySession.create({
      data: {
        userId,
        title: deckName ? `Review: ${deckName}`.slice(0, BALANCE.sessions.titleMaxLength) : 'Review session',
        subject: 'Flashcards',
        difficulty: 'easy',
        plannedMinutes: reviewSessionMinutes(dueCount),
        kind: 'review',
      },
    });
    const dueCards = await tx.flashcard.findMany({ where: dueWhere, orderBy: { dueAt: 'asc' }, take: 40 });
    const items = await buildCardQuizItems(tx, userId, dueCards, hashString(s.id));
    const want = BALANCE.sessions.claim.questionCount;
    const rows: QuizRow[] = items.slice(0, want).map((i) => ({
      questionId: null,
      cardId: i.card.id,
      text: i.card.question,
      choices: i.choices,
      correctIndex: i.correctIndex,
    }));
    if (rows.length < want) {
      rows.push(
        ...(await pickBankQuestions(tx, userId, {
          subject: dueCards[0]?.subject ?? 'Other',
          difficulty: null,
          count: want - rows.length,
          seed: hashString(s.id) + 1,
        })),
      );
    }
    await saveQuiz(tx, s.id, rows);
    return s;
  });
  return input.startNow
    ? startSession(prisma, userId, created.id, now)
    : getSession(prisma, userId, created.id, now);
}

/** The claim quiz as the browser sees it: text and choices only, never the answers. */
export async function getClaimQuiz(
  prisma: PrismaClient,
  userId: string,
  id: string,
  now: Date,
): Promise<{ session: SessionDto; questions: ClaimQuestionDto[] }> {
  const s = await prisma.studySession.findFirst({
    where: { id, userId },
    include: { claimQuestions: { orderBy: { position: 'asc' } } },
  });
  if (!s) throw notFound();
  if (s.status !== 'finished')
    throw new AppError(409, 'SESSION_NOT_CLAIMABLE', 'This session has no claim quiz waiting.');
  return {
    session: await dto(prisma, s, now, userId),
    questions: s.claimQuestions.map((q) => ({ position: q.position, text: q.text, choices: q.choices })),
  };
}

/* ------------------------------------------------------------------ claim */

function claimResultFromRows(
  session: SessionDto,
  rows: SessionClaimQuestion[],
  extra: { alreadyClaimed: boolean; levelsGained: number; progress: ClaimResultDto['progress'] },
): ClaimResultDto {
  const total = rows.length;
  const correct = rows.filter((r) => r.correct === true).length;
  return {
    session,
    alreadyClaimed: extra.alreadyClaimed,
    passed: total === 0 ? true : correct >= passThreshold(total),
    correct,
    total,
    xpAwarded: session.xpAwarded,
    energyAwarded: session.energyAwarded,
    levelsGained: extra.levelsGained,
    questions: rows.map((r) => ({
      position: r.position,
      questionId: r.questionId,
      text: r.text,
      correct: r.correct === true,
      correctIndex: r.correctIndex,
      selectedIndex: r.selectedIndex,
    })),
    progress: extra.progress,
  };
}

/**
 * Claim: grade the quiz on the server, pay once. Idempotent three ways: the status flips finished -> claimed
 * exactly once, the XP goes through the ledger with source ("session", id), and a repeat call just
 * returns the stored result. A review session also schedules the cards it quizzed.
 */
export async function claimSession(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: SessionClaim,
  now: Date,
): Promise<ClaimResultDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    const s = await tx.studySession.findFirst({
      where: { id, userId },
      include: { claimQuestions: { orderBy: { position: 'asc' } } },
    });
    if (!s) throw notFound();

    const progressNow = async () =>
      toProgressDto(await tx.playerProgress.findUniqueOrThrow({ where: { userId } }));

    if (s.status === 'claimed') {
      const ledger = await tx.xpTransaction.findUnique({
        where: { userId_sourceType_sourceId: { userId, sourceType: 'session', sourceId: s.id } },
      });
      return claimResultFromRows(await dto(tx, s, now, userId), s.claimQuestions, {
        alreadyClaimed: true,
        levelsGained: ledger?.levelsGained ?? 0,
        progress: await progressNow(),
      });
    }
    if (s.status !== 'finished')
      throw new AppError(409, 'SESSION_NOT_CLAIMABLE', 'This session cannot be claimed.');

    // Grade server-side. A missing or out-of-range answer is wrong.
    const picked = new Map(input.answers.map((a) => [a.position, a.selectedIndex]));
    const graded = s.claimQuestions.map((q) => {
      const sel = picked.get(q.position);
      const selectedIndex = sel !== undefined && sel < q.choices.length ? sel : null;
      return { q, selectedIndex, correct: selectedIndex !== null && selectedIndex === q.correctIndex };
    });
    for (const g of graded) {
      await tx.sessionClaimQuestion.update({
        where: { id: g.q.id },
        data: { selectedIndex: g.selectedIndex, correct: g.correct },
      });
    }

    const flipped = await tx.studySession.updateMany({
      where: { id: s.id, userId, status: 'finished' },
      data: { status: 'claimed' },
    });
    if (flipped.count === 0) throw new AppError(409, 'SESSION_NOT_CLAIMABLE', 'This session cannot be claimed.');

    const mods = await getModifiers(tx, userId);
    const before = await tx.playerProgress.findUniqueOrThrow({ where: { userId } });
    const elapsedSec = sessionElapsedSec(s, now);
    const total = graded.length;
    const correctCount = graded.filter((g) => g.correct).length;
    // No quiz could be built (an empty question bank): not the player's fault, so it counts as a pass.
    const reward = computeSessionReward({
      elapsedSec,
      difficulty: s.difficulty,
      streak: before.streak,
      focusRatio: s.focusRatioReported,
      correct: total === 0 ? 1 : correctCount,
      total: total === 0 ? 1 : total,
      scholarClass: mods.scholarClass,
      scholarInsight: mods.scholarInsight,
    });

    const grant = await grantXp(
      {
        userId,
        amount: reward.xp,
        reason: `Study session: ${s.title}`.slice(0, 120),
        sourceType: 'session',
        sourceId: s.id,
      },
      tx,
    );
    await addEnergy(tx, userId, reward.energy);
    await touchStreak(tx, userId, now);
    await tx.studySession.update({
      where: { id: s.id },
      data: { xpAwarded: reward.xp, energyAwarded: reward.energy },
    });

    // Quests count real events, here and only here.
    await recordQuestEvent(tx, userId, 'sessions_claimed', 1, now);
    await recordQuestEvent(tx, userId, 'study_minutes', elapsedMinutes(elapsedSec), now);

    // Review sessions also schedule the flashcards they quizzed (only cards that are actually due).
    if (s.kind === 'review') {
      let reviewed = 0;
      for (const g of graded) {
        if (!g.q.cardId) continue;
        const card = await tx.flashcard.findFirst({ where: { id: g.q.cardId, userId } });
        if (!card || card.dueAt.getTime() > now.getTime()) continue;
        const r = await applyCardReview(tx, {
          userId,
          card,
          quality: g.correct ? BALANCE.srs.choiceCorrectQuality : BALANCE.srs.choiceWrongQuality,
          now,
          context: 'session',
          sageMemory: mods.sageMemory,
        });
        if (r.applied) reviewed += 1;
      }
      await recordQuestEvent(tx, userId, 'cards_reviewed', reviewed, now);
    }

    const fresh = await tx.studySession.findFirstOrThrow({
      where: { id: s.id, userId },
      include: { claimQuestions: { orderBy: { position: 'asc' } } },
    });
    return claimResultFromRows(await dto(tx, fresh, now, userId), fresh.claimQuestions, {
      alreadyClaimed: false,
      levelsGained: grant.levelsGained,
      progress: await progressNow(),
    });
  });
}
