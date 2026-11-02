import { describe, expect, it } from 'vitest';
import { BALANCE } from './balance.js';
import { buildCardChoices, cleanDistractors, isPlaceholderAnswer } from './choices.js';
import {
  flashcardsToCsv,
  neutralizeFormula,
  parseCsv,
  parseFlashcardCsv,
  restoreFormula,
  toCsv,
} from './csv.js';
import { dayKey, isoWeekKey, periodEnd, startOfIsoWeek, utcDayDiff } from './period.js';
import { hashString, seededRng, shuffled } from './random.js';
import {
  computeSessionReward,
  passThreshold,
  reviewSessionMinutes,
  sessionBaseEnergy,
  sessionBaseXp,
  sessionEligibility,
} from './rewards.js';
import { nextSrsState } from './srs.js';
import { sessionCreateSchema, taskCreateSchema } from './schemas/index.js';
import { bankSubject } from './subjects.js';

describe('period keys (UTC)', () => {
  it('day and ISO week keys', () => {
    expect(dayKey(new Date('2026-10-22T23:59:59Z'))).toBe('2026-10-22');
    expect(isoWeekKey(new Date('2026-10-22T12:00:00Z'))).toBe('2026-W43');
    expect(isoWeekKey(new Date('2026-10-19T00:00:00Z'))).toBe('2026-W43'); // Monday
    expect(isoWeekKey(new Date('2026-10-25T23:59:59Z'))).toBe('2026-W43'); // Sunday
    expect(isoWeekKey(new Date('2026-10-26T00:00:00Z'))).toBe('2026-W44');
  });
  it('week-year edge cases', () => {
    expect(isoWeekKey(new Date('2021-01-01T00:00:00Z'))).toBe('2020-W53');
    expect(isoWeekKey(new Date('2024-12-30T00:00:00Z'))).toBe('2025-W01');
    expect(isoWeekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
  });
  it('period end and day diff', () => {
    expect(periodEnd('daily', new Date('2026-10-22T05:00:00Z')).toISOString()).toBe(
      '2026-10-23T00:00:00.000Z',
    );
    expect(periodEnd('weekly', new Date('2026-10-22T05:00:00Z')).toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    );
    expect(startOfIsoWeek(new Date('2026-10-22T05:00:00Z')).toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
    expect(utcDayDiff(new Date('2026-10-21T23:59:00Z'), new Date('2026-10-22T00:01:00Z'))).toBe(1);
    expect(utcDayDiff(new Date('2026-10-22T01:00:00Z'), new Date('2026-10-22T23:00:00Z'))).toBe(0);
  });
});

describe('session rewards (old formulas, server-side)', () => {
  it('base XP: floor(minutes x difficulty x streak bonus), min 1', () => {
    expect(sessionBaseXp(25, 'medium', 0)).toBe(25);
    expect(sessionBaseXp(25, 'easy', 0)).toBe(20);
    expect(sessionBaseXp(50, 'hard', 0)).toBe(75);
    expect(sessionBaseXp(25, 'medium', 5)).toBe(27); // +10%
    expect(sessionBaseXp(25, 'medium', 100)).toBe(31); // bonus capped at +25%
    expect(sessionBaseXp(0, 'easy', 0)).toBe(1);
  });
  it('base energy: floor(minutes / 10), min 1', () => {
    expect(sessionBaseEnergy(10)).toBe(1);
    expect(sessionBaseEnergy(25)).toBe(2);
    expect(sessionBaseEnergy(50)).toBe(5);
    expect(sessionBaseEnergy(3)).toBe(1);
  });
  it('eligibility: 80% of the planned time and focus >= 0.5', () => {
    expect(sessionEligibility({ elapsedSec: 25 * 60, plannedMinutes: 25, focusRatio: 1 })).toEqual({
      eligible: true,
    });
    expect(sessionEligibility({ elapsedSec: 20 * 60, plannedMinutes: 25, focusRatio: 1 })).toEqual({
      eligible: true,
    });
    expect(
      sessionEligibility({ elapsedSec: 20 * 60 - 1, plannedMinutes: 25, focusRatio: 1 }),
    ).toEqual({
      eligible: false,
      reason: 'not_enough_time',
    });
    expect(
      sessionEligibility({ elapsedSec: 25 * 60, plannedMinutes: 25, focusRatio: 0.49 }),
    ).toEqual({
      eligible: false,
      reason: 'not_enough_focus',
    });
    expect(
      sessionEligibility({ elapsedSec: 25 * 60, plannedMinutes: 25, focusRatio: undefined })
        .eligible,
    ).toBe(true);
  });
  it('pass threshold is 80% rounded up', () => {
    expect(passThreshold(5)).toBe(4);
    expect(passThreshold(3)).toBe(3);
    expect(passThreshold(1)).toBe(1);
  });
  const base = { elapsedSec: 25 * 60, difficulty: 'medium' as const, streak: 0 };
  it('pass with good focus pays full; partial focus pays 75%; fail pays 50%', () => {
    expect(computeSessionReward({ ...base, focusRatio: 1, correct: 4, total: 5 })).toMatchObject({
      passed: true,
      xp: 25,
      energy: 2,
    });
    expect(computeSessionReward({ ...base, focusRatio: 0.6, correct: 5, total: 5 })).toMatchObject({
      passed: true,
      xp: 19,
      energy: 2,
    });
    expect(computeSessionReward({ ...base, focusRatio: 1, correct: 3, total: 5 })).toMatchObject({
      passed: false,
      xp: 12,
      energy: 1,
    });
  });
  it('rewards use ELAPSED time, not the plan', () => {
    const r = computeSessionReward({
      ...base,
      elapsedSec: 20 * 60,
      focusRatio: 1,
      correct: 5,
      total: 5,
    });
    expect(r.xp).toBe(20);
  });
  it('scholar class and Scholar Insight raise XP (multiplicative, one rounding)', () => {
    const r = computeSessionReward({
      ...base,
      focusRatio: 1,
      correct: 5,
      total: 5,
      scholarClass: true,
      scholarInsight: true,
    });
    expect(r.xp).toBe(Math.round(25 * 1.15 * 1.12));
    expect(computeSessionReward({ ...base, focusRatio: 1, correct: 0, total: 0 }).passed).toBe(
      false,
    );
  });
  it('review session length: about 2 cards a minute, 5..50', () => {
    expect(reviewSessionMinutes(3)).toBe(5);
    expect(reviewSessionMinutes(20)).toBe(10);
    expect(reviewSessionMinutes(500)).toBe(50);
  });
});

describe('spaced repetition', () => {
  const now = new Date('2026-10-22T00:00:00Z');
  const fresh = { ease: 2.5, intervalDays: 0, repetitions: 0 };
  it('1 day, then 6 days, then grows by ease', () => {
    const a = nextSrsState(fresh, 4, now);
    expect(a).toMatchObject({ intervalDays: 1, repetitions: 1, passed: true });
    expect(a.dueAt.toISOString()).toBe('2026-10-23T00:00:00.000Z');
    const b = nextSrsState(a, 4, now);
    expect(b.intervalDays).toBe(6);
    const c = nextSrsState(b, 4, now);
    expect(c.intervalDays).toBe(Math.round(6 * b.ease));
  });
  it('a miss resets repetitions, interval 1 day, lowers ease (never below the floor)', () => {
    const r = nextSrsState({ ease: 1.35, intervalDays: 30, repetitions: 5 }, 1, now);
    expect(r).toMatchObject({ repetitions: 0, intervalDays: 1, passed: false });
    expect(r.ease).toBe(BALANCE.srs.minEase);
  });
  it('Sage Memory slows growth and softens the miss penalty', () => {
    const state = { ease: 2.5, intervalDays: 6, repetitions: 2 };
    const plain = nextSrsState(state, 5, now).intervalDays;
    const sage = nextSrsState(state, 5, now, { sageMemory: true }).intervalDays;
    expect(sage).toBeLessThan(plain);
    expect(nextSrsState(state, 1, now, { sageMemory: true }).ease).toBeGreaterThan(
      nextSrsState(state, 1, now).ease,
    );
  });
});

describe('placeholder answers and card choices', () => {
  it('detects placeholders', () => {
    for (const p of ['', '  ', 'N/A', 'n/a', 'NA', 'none', 'null', '-', '?', '...'])
      expect(isPlaceholderAnswer(p), p).toBe(true);
    for (const ok of ['Paris', 'None of the above', '0', 'N'])
      expect(isPlaceholderAnswer(ok), ok).toBe(false);
  });
  it('cleanDistractors drops placeholders, duplicates and the correct answer', () => {
    expect(cleanDistractors('Paris', ['N/A', '', 'paris', 'Rome', ' rome ', 'Berlin'])).toEqual([
      'Rome',
      'Berlin',
    ]);
  });
  it('buildCardChoices: own wrong answers first, then borrowed; always 3 choices incl. the correct one', () => {
    const c = buildCardChoices({
      correct: 'Paris',
      own: ['Rome'],
      borrowFrom: [['Berlin', 'Paris', 'N/A']],
      seed: 7,
    });
    expect(c).not.toBeNull();
    expect([...(c ?? [])].sort()).toEqual(['Berlin', 'Paris', 'Rome']);
  });
  it('returns null when there are not enough plausible wrong answers (never pads with N/A)', () => {
    expect(
      buildCardChoices({ correct: 'Paris', own: ['N/A', ''], borrowFrom: [['Rome']], seed: 1 }),
    ).toBeNull();
  });
  it('is deterministic for a seed and varies between seeds', () => {
    const args = { correct: 'A', own: [], borrowFrom: [['B', 'C', 'D', 'E', 'F']] } as const;
    const a = buildCardChoices({ ...args, seed: 5 });
    expect(buildCardChoices({ ...args, seed: 5 })).toEqual(a);
    const variants = new Set(
      Array.from({ length: 20 }, (_, s) => JSON.stringify(buildCardChoices({ ...args, seed: s }))),
    );
    expect(variants.size).toBeGreaterThan(3);
  });
});

describe('random helpers', () => {
  it('shuffle keeps all items; rng is stable', () => {
    const r = seededRng(hashString('abc'));
    const first = r();
    expect(seededRng(hashString('abc'))()).toBe(first);
    expect(shuffled([1, 2, 3, 4, 5], seededRng(3)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('CSV parser and writer (RFC 4180)', () => {
  it('quotes, embedded commas, quotes and newlines, CRLF, BOM, blank lines', () => {
    const text = '\uFEFFa,b\r\n"x, y","say ""hi"""\r\n\r\n"line1\nline2",z\r\n';
    expect(parseCsv(text).rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['line1\nline2', 'z'],
    ]);
  });
  it('reports an unterminated quote', () => {
    expect(parseCsv('a,b\n"oops,1\n').error).toMatch(/Unterminated/);
  });
  it('round-trips awkward text, including formula-looking cells', () => {
    const rows = [
      ['q', 'a'],
      ['=1+1', '-5 + 3'],
      ['@home', 'it\'s, "quoted"\nmultiline'],
      ["'=x", 'plain'],
    ];
    const text = toCsv(rows);
    expect(text).toContain("'=1+1"); // neutralised for spreadsheets
    expect(parseCsv(text).rows.map((r) => r.map(restoreFormula))).toEqual([
      ['q', 'a'],
      ['=1+1', '-5 + 3'],
      ['@home', 'it\'s, "quoted"\nmultiline'],
      ['=x', 'plain'], // documented edge: a leading apostrophe before = + - @ is treated as the escape
    ]);
    expect(neutralizeFormula('plain')).toBe('plain');
  });
});

describe('flashcard CSV', () => {
  it('parses the new header and reports row-level errors', () => {
    const csv = [
      'question,correct,wrong1,wrong2,subject,difficulty',
      'Capital of France?,Paris,Rome,Berlin,History,easy',
      'Missing answer,,x,y,Math,easy',
      ',orphan,,,,',
      'Bad difficulty,A,B,C,Math,extreme',
      'No extras,Yes,N/A,,,',
    ].join('\n');
    const r = parseFlashcardCsv(csv);
    expect(r.totalRows).toBe(5);
    expect(r.cards.map((c) => c.row)).toEqual([2, 6]);
    expect(r.errors).toEqual([
      { row: 3, message: 'missing answer' },
      { row: 4, message: 'missing question' },
      { row: 5, message: 'difficulty must be easy, medium or hard' },
    ]);
    expect(r.cards[0]).toMatchObject({
      question: 'Capital of France?',
      answer: 'Paris',
      distractors: ['Rome', 'Berlin'],
      subject: 'History',
      difficulty: 'easy',
    });
    expect(r.cards[1]?.distractors).toEqual([]); // "N/A" and empty never become distractors
  });
  it('accepts the OLD export header (no difficulty) including review columns', () => {
    const csv =
      'question,correct,wrong1,wrong2,subject,ease,interval,repetitions,nextReview\nQ?,A,B,C,Math,2.3,6,2,2026-11-01T00:00:00.000Z\n';
    const r = parseFlashcardCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.cards[0]?.difficulty).toBeNull();
    expect(r.cards[0]?.review).toMatchObject({ ease: 2.3, intervalDays: 6, repetitions: 2 });
  });
  it('fatal problems: no header, too many rows, too big, broken quoting', () => {
    expect(parseFlashcardCsv('a,b\n1,2').fatal).toMatch(/Missing header/);
    expect(
      parseFlashcardCsv('question,correct\n' + 'q,a\n'.repeat(11), { maxBytes: 1e6, maxRows: 10 })
        .fatal,
    ).toMatch(/Too many rows/);
    expect(parseFlashcardCsv('question,correct\nq,a', { maxBytes: 5, maxRows: 10 }).fatal).toMatch(
      /too large/,
    );
    expect(parseFlashcardCsv('question,correct\n"q,a').fatal).toMatch(/Unterminated/);
    expect(parseFlashcardCsv('').fatal).toBeTruthy();
  });
  it('export then import round-trips (with and without review data)', () => {
    const cards = [
      {
        question: 'Q1, with comma',
        answer: 'A1',
        distractors: ['W1', 'W2'],
        subject: 'Math',
        difficulty: 'hard' as const,
        ease: 2.2,
        intervalDays: 6,
        repetitions: 2,
        dueAt: new Date('2026-11-01T00:00:00Z'),
      },
      {
        question: '=SUM(A1)',
        answer: '-1',
        distractors: [],
        subject: 'Other',
        difficulty: 'easy' as const,
        ease: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: new Date('2026-10-22T00:00:00Z'),
      },
    ];
    for (const includeReview of [false, true]) {
      const back = parseFlashcardCsv(flashcardsToCsv(cards, includeReview));
      expect(back.errors).toEqual([]);
      expect(
        back.cards.map((c) => [c.question, c.answer, c.distractors, c.subject, c.difficulty]),
      ).toEqual(
        cards.map((c) => [c.question, c.answer, [...c.distractors], c.subject, c.difficulty]),
      );
      expect(back.cards[0]?.review !== null).toBe(includeReview);
    }
  });
});

describe('input schemas', () => {
  it('sessions only allow 10/25/50 minutes; unknown keys are rejected', () => {
    expect(sessionCreateSchema.safeParse({ plannedMinutes: 25 }).success).toBe(true);
    expect(sessionCreateSchema.safeParse({ plannedMinutes: 30 }).success).toBe(false);
    expect(sessionCreateSchema.safeParse({ plannedMinutes: 25, xp: 999 }).success).toBe(false);
  });
  it('tasks: title required, strict keys (no client-set status/xp)', () => {
    expect(taskCreateSchema.safeParse({ title: '  Read ch. 3  ' }).data?.title).toBe('Read ch. 3');
    expect(taskCreateSchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'x', status: 'completed' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: 'x', userId: 'abc' }).success).toBe(false);
  });
  it('bankSubject maps unknown subjects to Other', () => {
    expect(bankSubject('math')).toBe('Math');
    expect(bankSubject('Chemistry')).toBe('Other');
  });
});
