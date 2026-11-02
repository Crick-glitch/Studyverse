import { describe, expect, it } from 'vitest';
import { BOSSES, ENEMIES } from '@studyverse/shared';
import {
  abilityOptions,
  accuracyOf,
  answer,
  armAbility,
  chooseMove,
  createBattle,
  publicQuestion,
  retreat,
} from './engine.js';
import { EngineError } from './types.js';
import { bigPool, hero, pq, start, turn } from './testkit.js';
import type { EngineState, PoolQuestion } from './types.js';

const only = (...qs: PoolQuestion[]) => qs;
const forceIntent = (s: EngineState, intent: EngineState['intent'], bossGuard = false): EngineState => ({
  ...s,
  intent,
  bossGuard,
});

describe('opening a battle', () => {
  it('starts at turn 1 awaiting a move, at full HP, with an intent and NO question', () => {
    const s = start();
    expect(s.phase).toBe('awaitingMove');
    expect(s.turn).toBe(1);
    expect(s.heroHp).toBe(100);
    expect(s.enemyHp).toBe(72);
    expect(s.cur.question).toBeNull();
    expect(publicQuestion(s)).toBeNull();
    expect(ENEMIES[0]!.intents).toContain(s.intent);
  });
  it('rolls intents from (seed, turn) only, so a refresh can never re-roll them', () => {
    const a = start({ seed: 777 });
    const b = start({ seed: 777 });
    expect(a.intent).toBe(b.intent);
    const seq = (seed: number) => {
      let s = start({ seed, hero: hero({ level: 9 }) });
      const out: string[] = [s.intent];
      for (let i = 0; i < 5; i++) {
        s = { ...turn(s, 'steady', false).state };
        s = { ...s, heroHp: s.hero.maxHp };
        out.push(s.intent);
      }
      return out;
    };
    expect(seq(5)).toEqual(seq(5));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((n) => start({ seed: n }).intent)).size).toBe(2);
  });
  it('scales the enemy with the player level', () => {
    const s = start({ hero: hero({ level: 6 }) });
    expect(s.enemy).toMatchObject({ maxHp: 108, atk: 12, def: 5 });
    expect(s.hero.maxHp).toBe(150);
  });
});

describe('phases and move gating', () => {
  it('an answer before a move is refused', () => {
    expect(() => answer(start(), 0)).toThrowError(EngineError);
    try {
      answer(start(), 0);
    } catch (e) {
      expect((e as EngineError).code).toBe('WRONG_PHASE');
    }
  });
  it('a second move on an open turn is refused (the service replays the stored one)', () => {
    const s = chooseMove(start(), 'steady', bigPool());
    expect(() => chooseMove(s, 'bold', bigPool())).toThrowError(EngineError);
  });
  it('choosing a move reveals the question text and choices only', () => {
    const s = chooseMove(start(), 'steady', bigPool());
    expect(s.phase).toBe('awaitingAnswer');
    const q = publicQuestion(s)!;
    expect(Object.keys(q).sort()).toEqual(['choices', 'text']);
  });
  it('an empty pool is a NO_QUESTIONS error, never a made-up question', () => {
    expect(() => chooseMove(start(), 'steady', [])).toThrowError(/no questions/i);
  });
  it('an out-of-range answer counts as wrong', () => {
    const s = chooseMove(start(), 'steady', bigPool());
    const { result } = answer(s, 7);
    expect(result.correct).toBe(false);
  });
});

describe('damage to the enemy (04 combat rules)', () => {
  it('correct damage = round(ATK x 1.5 x combo - enemyDEF x 0.5) with the combo table 1 / 1.1 / 1.25 / 1.5', () => {
    let s = forceIntent(start(), 'strike');
    const dealt: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = forceIntent(s, 'strike');
      const r = turn(s, 'steady', true, bigPool());
      dealt.push(r.result.damageDealt);
      s = { ...r.state, enemyHp: 10_000, enemy: { ...r.state.enemy, maxHp: 10_000 } };
    }
    expect(dealt).toEqual([14, 15, 17, 21]);
  });
  it('a wrong answer resets the combo', () => {
    let s = forceIntent(start(), 'strike');
    s = turn(s, 'steady', true).state;
    s = forceIntent(s, 'strike');
    expect(s.combo).toBe(1);
    s = turn(s, 'steady', false).state;
    expect(s.combo).toBe(0);
  });
  it('Bold x1.4, Brace x0.45', () => {
    const bold = turn(forceIntent(start(), 'strike'), 'bold', true).result.damageDealt;
    const brace = turn(forceIntent(start(), 'strike'), 'brace', true).result.damageDealt;
    expect(bold).toBe(20);
    expect(brace).toBe(6);
  });
  it('damage is at least 1 even against a huge DEF', () => {
    const s = forceIntent(start({ enemySlug: 'clockwork-titan', tier: 3 }), 'strike');
    const weak = { ...s, enemy: { ...s.enemy, def: 500 } };
    expect(turn(weak, 'brace', true).result.damageDealt).toBe(1);
  });
  it('Heavy Strike parry: +10% on a correct answer', () => {
    const r = turn(forceIntent(start(), 'heavy'), 'steady', true).result;
    expect(r.damageDealt).toBe(15);
    expect(r.events.some((e) => e.type === 'parry')).toBe(true);
  });
  it('victory when the enemy reaches 0 HP', () => {
    const s = { ...forceIntent(start(), 'strike'), enemyHp: 5 };
    const { state, result } = turn(s, 'steady', true);
    expect(state.phase).toBe('ended');
    expect(state.outcome).toBe('victory');
    expect(result.ended && result.outcome === 'victory').toBe(true);
    expect(state.enemyHp).toBe(0);
  });
});

describe('damage to the hero on a wrong answer', () => {
  it('strike = round(maxHP x strikePct x (1 - DEF/(DEF+50))), strikePct = clamp(0.09 + enemyATK x 0.011, 0.12, 0.30)', () => {
    expect(turn(forceIntent(start(), 'strike'), 'steady', false).result.damageTaken).toBe(16);
  });
  it('is never below the 3 HP floor and the strike share is clamped to 30%', () => {
    const tiny = { ...forceIntent(start(), 'strike'), enemy: { maxHp: 72, atk: 1, def: 3 }, hero: hero({ level: 1 }) };
    expect(turn(tiny, 'brace', false).result.damageTaken).toBeGreaterThanOrEqual(3);
    const huge = { ...forceIntent(start(), 'strike'), enemy: { maxHp: 72, atk: 400, def: 3 } };
    expect(turn(huge, 'steady', false).result.damageTaken).toBe(Math.round(100 * 0.3 * (1 - 5 / 55)));
  });
  it('Heavy Strike x1.6; Brace cancels it and softens the hit (x0.8); Bold takes +25%', () => {
    expect(turn(forceIntent(start(), 'heavy'), 'steady', false).result.damageTaken).toBe(26);
    expect(turn(forceIntent(start(), 'heavy'), 'brace', false).result.damageTaken).toBe(13);
    expect(turn(forceIntent(start(), 'strike'), 'bold', false).result.damageTaken).toBe(20);
  });
  it('Drain heals the enemy 10% of max HP on a wrong answer; Brace cancels the heal', () => {
    const base = { ...forceIntent(start({ enemySlug: 'hollow-mage' }), 'drain') };
    const hurt = { ...base, enemyHp: 30 };
    const steady = turn(hurt, 'steady', false);
    expect(steady.result.enemyHealed).toBe(8);
    expect(steady.state.enemyHp).toBe(38);
    const braced = turn(hurt, 'brace', false);
    expect(braced.result.enemyHealed).toBe(0);
    expect(braced.state.enemyHp).toBe(30);
  });
  it('Drain never heals above max HP', () => {
    const s = { ...forceIntent(start({ enemySlug: 'hollow-mage' }), 'drain'), enemyHp: 82 };
    expect(turn(s, 'steady', false).state.enemyHp).toBe(84);
  });
  it('Tank takes 25% less, Cartographer 10% less, Warden halves the FIRST wrong answer only', () => {
    const base = forceIntent(start(), 'strike');
    const tank = turn({ ...base, hero: hero({ playerClass: 'tank' }) }, 'steady', false).result.damageTaken;
    expect(tank).toBe(12);
    const cart = start({ hero: hero({ armor: { def: 0, effectKey: 'wrong_damage_minus_10' } }) });
    expect(turn(forceIntent(cart, 'strike'), 'steady', false).result.damageTaken).toBe(15);
    const warden = forceIntent(start({ hero: hero({ armor: { def: 0, effectKey: 'first_wrong_half' } }) }), 'strike');
    const first = turn(warden, 'steady', false);
    expect(first.result.damageTaken).toBe(8);
    const second = turn(forceIntent(first.state, 'strike'), 'steady', false);
    expect(second.result.damageTaken).toBe(16);
  });
  it('defeat when the hero reaches 0 HP', () => {
    const s = { ...forceIntent(start(), 'strike'), heroHp: 10 };
    const { state } = turn(s, 'steady', false);
    expect(state.outcome).toBe('defeat');
    expect(state.phase).toBe('ended');
  });
});

describe('Guard', () => {
  const guard = (slug = 'orc-warlord') => forceIntent(start({ enemySlug: slug }), 'guard');
  it('halves a correct answer unless the question is hard', () => {
    const medium = turn(guard(), 'steady', true, only(pq('m', 'medium')));
    expect(medium.result.damageDealt).toBe(7); // orc DEF 4: round(15 - 2) = 13, halved
    expect(medium.result.events.some((e) => e.type === 'guard')).toBe(true);
    const hard = turn(guard(), 'steady', true, only(pq('h', 'hard')));
    expect(hard.result.damageDealt).toBe(13);
    expect(hard.result.events.some((e) => e.type === 'guardBreak')).toBe(true);
  });
  it('a correct Bold answer shatters Guard even when no hard question exists', () => {
    const r = turn(guard(), 'bold', true, only(pq('m', 'medium')));
    expect(r.result.events.some((e) => e.type === 'guardBreak')).toBe(true);
    expect(r.result.damageDealt).toBe(18); // 13 x 1.4
  });
  it("the Titan's boss Guard breaks only for a question that is actually hard", () => {
    const titan = forceIntent(start({ enemySlug: 'clockwork-titan', tier: 3, hero: hero({ level: 12 }) }), 'guard', true);
    const bold = turn(titan, 'bold', true, only(pq('m', 'medium')));
    expect(bold.result.events.some((e) => e.type === 'guardBreak')).toBe(false);
    const hard = turn(titan, 'steady', true, only(pq('h', 'hard')));
    expect(hard.result.events.some((e) => e.type === 'guardBreak')).toBe(true);
    const hammer = forceIntent(
      start({ enemySlug: 'clockwork-titan', tier: 3, hero: hero({ level: 12, weapon: { atk: 5, effectKey: 'shatter_guard_any' } }) }),
      'guard',
      true,
    );
    expect(turn(hammer, 'steady', true, only(pq('m', 'medium'))).result.events.some((e) => e.type === 'guardBreak')).toBe(false);
  });
  it('Tome Hammer: any correct answer shatters an ordinary Guard', () => {
    const s = forceIntent(start({ enemySlug: 'orc-warlord', hero: hero({ weapon: { atk: 5, effectKey: 'shatter_guard_any' } }) }), 'guard');
    expect(turn(s, 'steady', true, only(pq('m', 'medium'))).result.events.some((e) => e.type === 'guardBreak')).toBe(true);
  });
});

describe('drawing questions by move', () => {
  const tally = (move: 'steady' | 'brace' | 'bold', tier: 1 | 2 | 3, n = 300, pool = bigPool(40)) => {
    const out = { easy: 0, medium: 0, hard: 0 };
    for (let seed = 1; seed <= n; seed++) {
      const s = chooseMove(start({ seed, tier }), move, pool);
      out[s.cur.question!.difficulty]++;
    }
    return out;
  };
  it('Bold draws hard (medium when the pool has no hard question)', () => {
    expect(tally('bold', 1)).toEqual({ easy: 0, medium: 0, hard: 300 });
    const noHard = bigPool(10).filter((q) => q.difficulty !== 'hard');
    const s = chooseMove(start(), 'bold', noHard);
    expect(s.cur.question!.difficulty).toBe('medium');
  });
  it('Brace never draws hard: about 40% easy / 60% medium', () => {
    const t = tally('brace', 3);
    expect(t.hard).toBe(0);
    expect(t.easy / 300).toBeGreaterThan(0.3);
    expect(t.easy / 300).toBeLessThan(0.5);
  });
  it('Brace falls back to hard only if nothing easier exists', () => {
    const s = chooseMove(start(), 'brace', only(pq('h', 'hard')));
    expect(s.cur.question!.difficulty).toBe('hard');
  });
  it('Steady follows the dungeon tier weights', () => {
    const t1 = tally('steady', 1, 600);
    expect(t1.easy / 600).toBeGreaterThan(0.5);
    expect(t1.hard / 600).toBeLessThan(0.12);
    const t3 = tally('steady', 3, 600);
    expect(t3.hard / 600).toBeGreaterThan(0.35);
    expect(t3.easy / 600).toBeLessThan(0.2);
  });
  it('is deterministic per (seed, turn): the same state draws the same question', () => {
    const a = chooseMove(start({ seed: 99 }), 'steady', bigPool());
    const b = chooseMove(start({ seed: 99 }), 'steady', bigPool());
    expect(a.cur.question!.ref).toBe(b.cur.question!.ref);
  });
  it('avoids questions from the recent window when others exist, and relaxes when the pool is tiny', () => {
    let s = start({ hero: hero({ level: 9 }) });
    const seen = new Set<string>();
    const pool = bigPool(4);
    for (let i = 0; i < 6; i++) {
      s = chooseMove(s, 'steady', pool);
      expect(seen.has(s.cur.question!.ref)).toBe(false);
      seen.add(s.cur.question!.ref);
      s = answer(s, s.cur.question!.correctIndex).state;
      s = { ...s, enemyHp: 10_000, enemy: { ...s.enemy, maxHp: 10_000 } };
    }
    const tiny = only(pq('a', 'easy'), pq('b', 'easy'));
    let t = start();
    for (let i = 0; i < 4; i++) {
      t = chooseMove(t, 'steady', tiny);
      t = answer(t, 0).state;
      t = { ...t, enemyHp: 10_000, enemy: { ...t.enemy, maxHp: 10_000 } };
    }
    expect(t.phase).toBe('awaitingMove');
  });
  it('at least 40% of draws use a due card first when due cards exist', () => {
    const pool = [...bigPool(30), ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => pq(id, 'medium', { ref: `card:${id}`, source: 'card', due: true }))];
    let s = start({ hero: hero({ level: 12 }) });
    let due = 0;
    const N = 10;
    for (let i = 0; i < N; i++) {
      s = chooseMove(s, 'steady', pool);
      if (s.cur.question!.source === 'card') due++;
      s = answer(s, s.cur.question!.correctIndex).state;
      s = { ...s, enemyHp: 10_000, enemy: { ...s.enemy, maxHp: 10_000 } };
    }
    expect(due / N).toBeGreaterThanOrEqual(0.4);
  });
  it('a due card whose difficulty does not fit the move is not used (Brace never asks hard)', () => {
    const pool = [pq('easy1', 'easy'), pq('hardcard', 'hard', { ref: 'card:x', source: 'card', due: true })];
    const s = chooseMove(start(), 'brace', pool);
    expect(s.cur.question!.difficulty).not.toBe('hard');
  });
  it('a wrong question comes back once, later, and only if it fits the move', () => {
    const pool = bigPool(6);
    let s = start({ hero: hero({ level: 12 }), seed: 4 });
    s = chooseMove(s, 'steady', pool);
    const missed = s.cur.question!;
    s = answer(s, (missed.correctIndex + 1) % 3).state;
    s = { ...s, heroHp: 10_000, hero: { ...s.hero, maxHp: 10_000 } };
    expect(s.requeue.map((r) => r.ref)).toEqual([missed.ref]);
    // too soon: turn + requeueGap has not arrived yet
    s = chooseMove(s, 'steady', pool);
    expect(s.cur.question!.ref).not.toBe(missed.ref);
    s = answer(s, s.cur.question!.correctIndex).state;
    s = { ...s, enemyHp: 10_000, enemy: { ...s.enemy, maxHp: 10_000 } };
    // due now; a Brace turn would not take a hard question back
    const asked = chooseMove(s, 'steady', pool);
    const back = missed.difficulty === 'hard' ? asked : chooseMove(s, 'steady', pool);
    expect(back.cur.question!.ref).toBe(missed.ref);
    expect(back.cur.question!.requeued).toBe(true);
    // wrong a second time: not queued again
    const again = answer(back, (missed.correctIndex + 1) % 3).state;
    expect(again.requeue).toEqual([]);
  });
});

describe('boss phases', () => {
  const wyrm = () => start({ enemySlug: 'procrastination-wyrm', hero: hero({ level: 5 }) });
  it('at 66% HP the boss strikes 10% harder; at 33% it enrages (+20%) and each correct answer gives +1 extra Focus', () => {
    const plain = forceIntent(wyrm(), 'strike');
    expect(plain.bossPhase).toBe(1);
    const base = turn(plain, 'steady', false).result.damageTaken;
    // a hit that takes the boss just under 66%
    const edge = { ...plain, enemyHp: Math.floor(plain.enemy.maxHp * 0.66) + 5 };
    const crossed = turn(edge, 'steady', true);
    expect(crossed.state.bossPhase).toBe(2);
    expect(crossed.result.events.some((e) => e.type === 'phase')).toBe(true);
    const p2 = turn(forceIntent({ ...crossed.state, enemyHp: crossed.state.enemy.maxHp * 0.6 }, 'strike'), 'steady', false);
    expect(Math.abs(p2.result.damageTaken - base * 1.1)).toBeLessThanOrEqual(1);
    // a hit that takes it under 33%
    const low = { ...forceIntent(crossed.state, 'strike'), enemyHp: Math.floor(crossed.state.enemy.maxHp * 0.33) + 5 };
    const enraged = turn(low, 'steady', true);
    expect(enraged.state.bossPhase).toBe(3);
    const p3 = turn(forceIntent({ ...enraged.state, enemyHp: enraged.state.enemy.maxHp * 0.3 }, 'strike'), 'steady', false);
    expect(Math.abs(p3.result.damageTaken - base * 1.2)).toBeLessThanOrEqual(1);
    // enraged: +1 extra Focus per correct answer
    const f = { ...forceIntent(enraged.state, 'strike'), enemyHp: enraged.state.enemy.maxHp * 0.3, focus: 0 };
    expect(turn(f, 'steady', true).result.focusGained).toBe(2);
  });
  it('a boss phase never goes back down when the boss heals', () => {
    const s = { ...forceIntent(wyrm(), 'drain'), enemyHp: 10, bossPhase: 3 as const };
    const r = turn(s, 'steady', false);
    expect(r.state.bossPhase).toBe(3);
  });
  it('the Titan guards every 3rd turn, never otherwise; the Lich drains every 3rd turn from phase 2', () => {
    let s = start({ enemySlug: 'clockwork-titan', tier: 3, hero: hero({ level: 12 }) });
    const intents: [number, string, boolean][] = [];
    for (let i = 0; i < 6; i++) {
      intents.push([s.turn, s.intent, s.bossGuard]);
      s = { ...turn(s, 'steady', true).state };
      s = { ...s, enemyHp: s.enemy.maxHp, heroHp: s.hero.maxHp };
    }
    for (const [t, intent, bossGuard] of intents) {
      expect(intent === 'guard').toBe(t % 3 === 0);
      expect(bossGuard).toBe(t % 3 === 0);
    }
    let lich = start({ enemySlug: 'archivist-lich', tier: 2, hero: hero({ level: 8 }) });
    lich = { ...lich, bossPhase: 2 };
    const drains: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      drains.push(lich.turn % 3 === 0 ? lich.intent === 'drain' : true);
      lich = turn(lich, 'steady', true).state;
      lich = { ...lich, enemyHp: Math.floor(lich.enemy.maxHp * 0.5), heroHp: lich.hero.maxHp, bossPhase: 2 };
    }
    expect(drains.every(Boolean)).toBe(true);
  });
  it('the boss roster entries exist', () => {
    expect(BOSSES.map((b) => b.slug)).toContain('archivist-lich');
  });
});

describe('Focus and class abilities', () => {
  const cls = (playerClass: 'warrior' | 'tank' | 'scholar', focus = 3) => ({
    ...forceIntent(start({ hero: hero({ playerClass }) }), 'strike'),
    focus,
  });
  it('Focus +1 per correct answer, capped at 3; the Scribe Staff adds one on the first correct only', () => {
    let s = forceIntent(start(), 'strike');
    for (let i = 0; i < 5; i++) {
      s = forceIntent(turn(s, 'steady', true).state, 'strike');
      s = { ...s, enemyHp: 10_000, enemy: { ...s.enemy, maxHp: 10_000 } };
    }
    expect(s.focus).toBe(3);
    const staff = forceIntent(start({ hero: hero({ weapon: { atk: 4, effectKey: 'focus_first_correct' } }) }), 'strike');
    const first = turn(staff, 'steady', true);
    expect(first.result.focusGained).toBe(2);
    const second = turn(forceIntent(first.state, 'strike'), 'steady', true);
    expect(second.result.focusGained).toBe(1);
  });
  it('Quick Study: every 3rd correct answer in a row grants +1 Focus', () => {
    let s = forceIntent(start({ hero: hero({ skillKeys: ['quick_study'] }) }), 'strike');
    const gains: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = turn(s, 'steady', true);
      gains.push(r.result.focusGained);
      s = { ...forceIntent(r.state, 'strike'), focus: 0, enemyHp: 10_000, enemy: { ...r.state.enemy, maxHp: 10_000 } };
    }
    expect(gains).toEqual([1, 1, 2]);
  });
  it('Cleave (Warrior) costs 3 Focus, doubles the next correct answer once, and carries over a wrong answer', () => {
    let s = armAbility(cls('warrior'), 'cleave');
    expect(s.focus).toBe(0);
    expect(s.armed).toBe('cleave');
    const wrong = turn(s, 'steady', false);
    expect(wrong.state.armed).toBe('cleave');
    const right = turn(forceIntent(wrong.state, 'strike'), 'steady', true);
    expect(right.result.damageDealt).toBe(Math.round((10 + 2) * 1.5 - 1.5) * 2);
    expect(right.state.armed).toBeNull();
    s = right.state;
    expect(turn(forceIntent({ ...s, combo: 0 }, 'strike'), 'steady', true).result.damageDealt).toBeLessThan(right.result.damageDealt);
  });
  it('Bulwark (Tank) negates the next enemy hit, then is used up', () => {
    const s = armAbility(cls('tank'), 'bulwark');
    const r = turn(s, 'steady', false);
    expect(r.result.damageTaken).toBe(0);
    expect(r.result.events.some((e) => e.type === 'bulwark')).toBe(true);
    expect(r.state.armed).toBeNull();
    expect(turn(forceIntent(r.state, 'strike'), 'steady', false).result.damageTaken).toBeGreaterThan(0);
  });
  it('Bulwark also stops the Drain heal', () => {
    const s = armAbility({ ...cls('tank'), enemyHp: 30, intent: 'drain' as const }, 'bulwark');
    expect(turn(s, 'steady', false).result.enemyHealed).toBe(0);
  });
  it('Insight (Scholar) works only while answering, removes exactly one WRONG choice, never reveals the answer', () => {
    const s = cls('scholar');
    expect(() => armAbility(s, 'insight')).toThrowError(EngineError);
    for (let seed = 1; seed <= 150; seed++) {
      const q = chooseMove({ ...cls('scholar'), seed }, 'steady', bigPool());
      const used = armAbility(q, 'insight');
      const removed = used.cur.removedIndex!;
      expect(removed).not.toBe(used.cur.question!.correctIndex);
      expect(removed).toBeGreaterThanOrEqual(0);
      expect(removed).toBeLessThan(3);
      expect(used.focus).toBe(0);
      expect(JSON.stringify(publicQuestion(used))).not.toContain('correct');
    }
  });
  it('only the hero class may use its ability; Focus is required; one ability per turn; no double arming', () => {
    expect(() => armAbility(cls('tank'), 'cleave')).toThrowError(EngineError);
    expect(() => armAbility(cls('warrior', 2), 'cleave')).toThrowError(EngineError);
    expect(() => armAbility({ ...start(), focus: 3 }, 'cleave')).toThrowError(EngineError);
    const armed = armAbility(cls('warrior'), 'cleave');
    expect(() => armAbility({ ...armed, focus: 3 }, 'cleave')).toThrowError(EngineError);
    const insightUsed = armAbility(chooseMove(cls('scholar'), 'steady', bigPool()), 'insight');
    expect(() => armAbility({ ...insightUsed, focus: 3 }, 'insight')).toThrowError(EngineError);
  });
  it('abilityOptions lists the hero\u2019s ability with a reason when unavailable', () => {
    const none = abilityOptions(start());
    expect(none).toEqual([]);
    const w = abilityOptions({ ...cls('warrior', 1) });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ key: 'cleave', available: false });
    expect(w[0]!.reason).toMatch(/Focus/);
    expect(abilityOptions(cls('warrior'))[0]).toMatchObject({ available: true, reason: null });
    const sc = abilityOptions(cls('scholar'));
    expect(sc[0]!.available).toBe(false);
    expect(sc[0]!.reason).toMatch(/question/i);
  });
});

describe('skills and gear in combat', () => {
  it('Berserk +30% below half HP; Executioner +25% below 30% enemy HP; Quillblade +20% on hard questions; Dragon Slayer ignores 25% DEF', () => {
    const base = turn(forceIntent(start(), 'strike'), 'steady', true, only(pq('m', 'medium'))).result.damageDealt;
    const bers = forceIntent(start({ hero: hero({ skillKeys: ['berserk'] }) }), 'strike');
    expect(turn({ ...bers, heroHp: 40 }, 'steady', true, only(pq('m', 'medium'))).result.damageDealt).toBe(Math.round(base * 1.3));
    expect(turn({ ...bers, heroHp: 90 }, 'steady', true, only(pq('m', 'medium'))).result.damageDealt).toBe(base);
    const exe = forceIntent(start({ hero: hero({ skillKeys: ['executioner'] }) }), 'strike');
    expect(turn({ ...exe, enemyHp: 100, enemy: { ...exe.enemy, maxHp: 1000 } }, 'steady', true, only(pq('m', 'medium'))).result.damageDealt).toBe(Math.round(base * 1.25));
    const quill = forceIntent(start({ hero: hero({ weapon: { atk: 0, effectKey: 'hard_damage_20' } }) }), 'strike');
    expect(turn(quill, 'steady', true, only(pq('h', 'hard'))).result.damageDealt).toBe(Math.round(base * 1.2));
    expect(turn(quill, 'steady', true, only(pq('m', 'medium'))).result.damageDealt).toBe(base);
    const slayer = forceIntent(start({ hero: hero({ weapon: { atk: 0, effectKey: 'ignore_def_25' } }) }), 'strike');
    expect(turn(slayer, 'steady', true, only(pq('m', 'medium'))).result.damageDealt).toBe(Math.round(10 * 1.5 - 3 * 0.75 * 0.5));
  });
  it('Stone Wall: -35% damage taken below 30% HP', () => {
    const s = forceIntent(start({ hero: hero({ skillKeys: ['stone_wall'] }) }), 'strike');
    const plain = turn({ ...s, heroHp: 90 }, 'steady', false).result.damageTaken;
    const walled = turn({ ...s, heroHp: 25 }, 'steady', false).result.damageTaken;
    expect(walled).toBe(Math.round(100 * (0.09 + 8 * 0.011) * (1 - 5 / 55) * 0.65));
    expect(walled).toBeLessThan(plain);
  });
  it('Second Wind heals 20% max HP once, when HP first falls below 30% (not when the hit kills)', () => {
    const s = forceIntent(start({ hero: hero({ skillKeys: ['second_wind'] }) }), 'strike');
    const r = turn({ ...s, heroHp: 40 }, 'steady', false);
    expect(r.state.heroHp).toBe(40 - 16 + 20);
    expect(r.result.heroHealed).toBe(20);
    const again = turn({ ...forceIntent(r.state, 'strike'), heroHp: 25 }, 'steady', false);
    expect(again.result.heroHealed).toBe(0);
    const dies = turn({ ...s, heroHp: 10 }, 'steady', false);
    expect(dies.state.outcome).toBe('defeat');
  });
  it('equipment never changes the question content (the draw ignores gear)', () => {
    const a = chooseMove(start({ seed: 31, hero: hero({ weapon: { atk: 8, effectKey: 'ignore_def_25' } }) }), 'steady', bigPool());
    const b = chooseMove(start({ seed: 31 }), 'steady', bigPool());
    expect(a.cur.question).toEqual(b.cur.question);
  });
});

describe('fairness invariants (04 / DESIGN-BLUEPRINT "Fairness")', () => {
  it('nothing the client may see before answering contains the answer or explanation', () => {
    const s = chooseMove(start(), 'steady', bigPool());
    const view = JSON.stringify(publicQuestion(s));
    expect(view).not.toMatch(/correctIndex|explanation/);
  });
  it('no ability changes which question is asked, and none skips a question', () => {
    const base = chooseMove({ ...start({ hero: hero({ playerClass: 'scholar' }), seed: 8 }), focus: 3 }, 'steady', bigPool());
    const used = armAbility(base, 'insight');
    expect(used.cur.question).toEqual(base.cur.question);
    expect(used.phase).toBe('awaitingAnswer');
  });
  it('a battle always needs a question per action: no action both opens and resolves a turn', () => {
    const s = start();
    const moved = chooseMove(s, 'bold', bigPool());
    expect(moved.tally.asked).toBe(0);
    expect(answer(moved, moved.cur.question!.correctIndex).state.tally.asked).toBe(1);
  });
});

describe('retreat and bookkeeping', () => {
  it('retreat ends the battle as retreated and works in either open phase', () => {
    expect(retreat(start()).outcome).toBe('retreated');
    expect(retreat(chooseMove(start(), 'steady', bigPool())).phase).toBe('ended');
  });
  it('nothing can be done after the battle ended', () => {
    const done = retreat(start());
    expect(() => chooseMove(done, 'steady', bigPool())).toThrowError(EngineError);
    expect(() => retreat(done)).toThrowError(EngineError);
  });
  it('tallies asked / correct / missed per subject for the rewards screen', () => {
    let s = start();
    const pool = bigPool(10, 'Math');
    s = turn(s, 'steady', true, pool).state;
    s = turn(s, 'steady', false, pool).state;
    expect(accuracyOf(s)).toBe(0.5);
    expect(s.tally.bySubject['Math']).toEqual({ asked: 2, missed: 1 });
  });
  it('state is plain JSON (it is stored on the Battle row)', () => {
    const s = chooseMove(start(), 'steady', bigPool());
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
  it('createBattle is exported for the simulation too', () => {
    expect(createBattle).toBeTypeOf('function');
  });
});
