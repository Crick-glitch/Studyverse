import {
  ABILITY_TEXT,
  BATTLE,
  getEnemy,
  isBossSlug,
  scaleEnemy,
  type AbilityKey,
  type AnswerResultDto,
  type BattleModeKey,
  type DerivedStats,
  type Move,
} from '@studyverse/shared';
import { drawQuestion } from './draw.js';
import { rollIntent } from './intents.js';
import { pick, rngFor } from './rng.js';
import { bossPhaseFor, resolveAnswer } from './resolve.js';
import { EngineError, type EngineState, type PoolQuestion } from './types.js';

/**
 * The pure battle engine (06-battle-screen.md): `(state, action, rng) -> state`. No Express, no Prisma, no
 * clock, no Math.random: every random choice derives from the stored seed, so it is unit-testable and the
 * balance simulation drives this exact code. Each action returns a NEW state.
 */
export interface NewBattleInput {
  mode: BattleModeKey;
  tier: 1 | 2 | 3;
  subject: string;
  enemySlug: string;
  hero: DerivedStats;
  seed: number;
}

const copy = (s: EngineState): EngineState => structuredClone(s);

function openTurn(s: EngineState): void {
  const { intent, bossGuard } = rollIntent(s);
  s.intent = intent;
  s.bossGuard = bossGuard;
  s.phase = 'awaitingMove';
  s.cur = { move: null, question: null, removedIndex: null, abilityUsed: false, armedThisTurn: null };
}

export function createBattle(input: NewBattleInput): EngineState {
  const def = getEnemy(input.enemySlug);
  if (!def) throw new Error(`Unknown enemy: ${input.enemySlug}`);
  const scaled = scaleEnemy(def, input.hero.level);
  const s: EngineState = {
    mode: input.mode,
    tier: input.tier,
    subject: input.subject,
    enemySlug: input.enemySlug,
    isBoss: isBossSlug(input.enemySlug),
    seed: input.seed,
    hero: input.hero,
    enemy: scaled,
    heroHp: input.hero.maxHp,
    enemyHp: scaled.maxHp,
    turn: 1,
    phase: 'awaitingMove',
    outcome: null,
    combo: 0,
    focus: 0,
    armed: null,
    intent: 'strike',
    bossGuard: false,
    bossPhase: 1,
    once: { staffFocus: false, wardenHalf: false, secondWind: false },
    cur: { move: null, question: null, removedIndex: null, abilityUsed: false, armedThisTurn: null },
    requeue: [],
    requeued: [],
    recent: [],
    tally: { asked: 0, correct: 0, drawn: 0, dueDrawn: 0, bySubject: {} },
  };
  openTurn(s);
  return s;
}

function assertOpen(s: EngineState): void {
  if (s.phase === 'ended') throw new EngineError('BATTLE_ENDED', 'This battle is over.');
}

/** The move is chosen BEFORE the question exists: this is where the server draws it. */
export function chooseMove(
  state: EngineState,
  move: Move,
  pool: readonly PoolQuestion[],
  weakSubjects: readonly string[] = [],
): EngineState {
  assertOpen(state);
  if (state.phase !== 'awaitingMove') throw new EngineError('WRONG_PHASE', 'A move was already chosen for this turn.');
  const s = copy(state);
  const q = drawQuestion(s, move, pool, weakSubjects);
  s.cur.move = move;
  s.cur.question = q;
  s.phase = 'awaitingAnswer';
  s.tally.drawn += 1;
  if (pool.find((p) => p.ref === q.ref)?.due) s.tally.dueDrawn += 1;
  s.recent = [...s.recent, q.ref].slice(-BATTLE.recentWindow);
  if (q.requeued) {
    s.requeue = s.requeue.filter((r) => r.ref !== q.ref);
    s.requeued = [...s.requeued, q.ref];
  }
  return s;
}

export interface AbilityOption {
  key: AbilityKey;
  available: boolean;
  reason: string | null;
  armed: boolean;
}

/** The hero's one class ability and whether it can be used right now (and why not). */
export function abilityOptions(s: EngineState): AbilityOption[] {
  const cls = s.hero.playerClass;
  if (!cls) return [];
  const key = (Object.keys(ABILITY_TEXT) as AbilityKey[]).find((k) => ABILITY_TEXT[k].playerClass === cls);
  if (!key) return [];
  const armed = s.armed === key;
  let reason: string | null = null;
  if (s.phase === 'ended') reason = 'The battle is over.';
  else if (armed) reason = 'Already armed.';
  else if (s.cur.abilityUsed) reason = 'One ability per turn.';
  else if (s.focus < BATTLE.focus.abilityCost) reason = `Needs ${BATTLE.focus.abilityCost} Focus.`;
  else if (key === 'insight' && s.phase !== 'awaitingAnswer') reason = 'Use it once the question appears.';
  return [{ key, available: reason === null, reason, armed }];
}

export function armAbility(state: EngineState, ability: AbilityKey): EngineState {
  assertOpen(state);
  if (ABILITY_TEXT[ability].playerClass !== state.hero.playerClass) {
    throw new EngineError('ABILITY_NOT_AVAILABLE', 'Your class cannot use that ability.');
  }
  if (state.armed === ability) throw new EngineError('ALREADY_ARMED', `${ABILITY_TEXT[ability].label} is already armed.`);
  if (state.cur.abilityUsed) throw new EngineError('ABILITY_ALREADY_USED', 'Only one ability per turn.');
  if (state.focus < BATTLE.focus.abilityCost) throw new EngineError('NOT_ENOUGH_FOCUS', 'Not enough Focus.');
  if (ability === 'insight' && state.phase !== 'awaitingAnswer') {
    throw new EngineError('WRONG_PHASE', 'Insight can only be used once the question is revealed.');
  }
  const s = copy(state);
  s.focus -= BATTLE.focus.abilityCost;
  s.cur.abilityUsed = true;
  s.cur.armedThisTurn = ability;
  if (ability === 'insight') {
    const q = s.cur.question!;
    const wrong = q.choices.map((_, i) => i).filter((i) => i !== q.correctIndex);
    s.cur.removedIndex = pick(wrong, rngFor(s.seed, s.turn, 'insight'));
  } else {
    s.armed = ability;
  }
  return s;
}

export function answer(
  state: EngineState,
  selectedIndex: number,
): { state: EngineState; result: AnswerResultDto } {
  assertOpen(state);
  if (state.phase !== 'awaitingAnswer' || !state.cur.question) {
    throw new EngineError('WRONG_PHASE', 'Choose a move before answering.');
  }
  const s = copy(state);
  const result = resolveAnswer(s, selectedIndex);
  if (result.outcome) {
    s.outcome = result.outcome;
    s.phase = 'ended';
    // the answered question stays in `cur` so the caller can still read it; the turn is closed
  } else {
    s.turn += 1;
    s.bossPhase = Math.max(s.bossPhase, s.isBoss ? bossPhaseFor(s.enemyHp, s.enemy.maxHp) : 1) as 1 | 2 | 3;
    openTurn(s);
  }
  return { state: s, result };
}

export function retreat(state: EngineState): EngineState {
  assertOpen(state);
  const s = copy(state);
  s.phase = 'ended';
  s.outcome = 'retreated';
  return s;
}

/** The only view of the open question the browser may get: text and choices, nothing else. */
export function publicQuestion(s: EngineState): { text: string; choices: string[] } | null {
  if (s.phase !== 'awaitingAnswer' || !s.cur.question) return null;
  return { text: s.cur.question.text, choices: [...s.cur.question.choices] };
}

export const accuracyOf = (s: EngineState): number =>
  s.tally.asked === 0 ? 0 : s.tally.correct / s.tally.asked;
