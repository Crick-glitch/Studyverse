import { BATTLE, type Difficulty, type Move } from '@studyverse/shared';
import { pick, rngFor } from './rng.js';
import { EngineError, type DrawnQuestion, type EngineState, type PoolQuestion } from './types.js';

const toDrawn = (q: PoolQuestion, requeued: boolean): DrawnQuestion => ({
  ref: q.ref,
  source: q.source,
  id: q.id,
  difficulty: q.difficulty,
  subject: q.subject,
  text: q.text,
  choices: q.choices,
  correctIndex: q.correctIndex,
  explanation: q.explanation,
  requeued,
});

/** Steady's difficulty weights by tier; bosses shift `bossHardShift` toward hard (taken from easy first). */
function steadyWeights(s: EngineState): Record<Difficulty, number> {
  const w: Record<Difficulty, number> = { ...BATTLE.tierWeights[s.tier] };
  if (s.isBoss) {
    let shift = BATTLE.bossHardShift;
    const fromEasy = Math.min(w.easy, shift);
    w.easy -= fromEasy;
    shift -= fromEasy;
    w.medium = Math.max(0, w.medium - shift);
    w.hard += BATTLE.bossHardShift;
  }
  return w;
}

/**
 * Draws the question a move calls for (04 "Question selection"). Order: a missed question that is due to come
 * back (once), then a due flashcard (so at least 40% of draws use due cards while any fit), then a weighted
 * difficulty pick. Questions seen in the last 30 turns are skipped unless that would empty the pool.
 * Bold draws hard (medium if the pool has none); Brace never draws hard unless nothing else exists.
 */
export function drawQuestion(
  s: EngineState,
  move: Move,
  pool: readonly PoolQuestion[],
  weakSubjects: readonly string[] = [],
): DrawnQuestion {
  if (pool.length === 0) {
    throw new EngineError('NO_QUESTIONS', 'No questions are available for this subject yet.');
  }
  const rng = rngFor(s.seed, s.turn, 'draw');
  const poolHasHard = pool.some((q) => q.difficulty === 'hard');
  const fits = (q: PoolQuestion): boolean =>
    move === 'brace' ? q.difficulty !== 'hard' : move === 'bold' ? q.difficulty === 'hard' || !poolHasHard : true;

  // 1. A missed question comes back once, at least `requeueGap` turns later, if it suits this move.
  for (const r of s.requeue) {
    if (r.notBefore > s.turn) continue;
    const q = pool.find((p) => p.ref === r.ref);
    if (q && fits(q)) return toDrawn(q, true);
  }

  const recent = new Set(s.recent);
  let candidates = pool.filter((q) => !recent.has(q.ref));
  if (candidates.length === 0) candidates = pool.slice();
  if (s.subject === 'Any' && weakSubjects.length > 0 && rng() < BATTLE.weakSubjectShare) {
    const weak = candidates.filter((q) => weakSubjects.includes(q.subject));
    if (weak.length > 0) candidates = weak;
  }

  // 2. Due flashcards first: deterministic quota so the share is at least `dueCardShare`.
  const due = candidates.filter((q) => q.due && fits(q));
  if (due.length > 0 && s.tally.dueDrawn < Math.ceil(BATTLE.dueCardShare * (s.tally.drawn + 1))) {
    return toDrawn(pick(due, rng), false);
  }

  // 3. Difficulty by move.
  const by = (d: Difficulty) => candidates.filter((q) => q.difficulty === d);
  let chosen: PoolQuestion[];
  if (move === 'bold') {
    chosen = by('hard').length ? by('hard') : by('medium').length ? by('medium') : by('easy');
  } else {
    const w = move === 'brace' ? BATTLE.moves.brace.weights : steadyWeights(s);
    const avail = (['easy', 'medium', 'hard'] as const).filter((d) => w[d] > 0 && by(d).length > 0);
    if (avail.length === 0) {
      chosen = candidates;
    } else {
      const total = avail.reduce((n, d) => n + w[d], 0);
      let at = rng() * total;
      let d: Difficulty = avail[avail.length - 1] as Difficulty;
      for (const k of avail) {
        if (at < w[k]) {
          d = k;
          break;
        }
        at -= w[k];
      }
      chosen = by(d);
    }
  }
  return toDrawn(pick(chosen, rng), false);
}
