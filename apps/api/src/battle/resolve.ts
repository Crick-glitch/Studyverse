import { BATTLE, getEnemy, type AnswerResultDto, type BattleEventDto } from '@studyverse/shared';
import type { EngineState } from './types.js';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const bossPhaseFor = (hp: number, maxHp: number): 1 | 2 | 3 =>
  hp <= maxHp * BATTLE.boss.phase3At ? 3 : hp <= maxHp * BATTLE.boss.phase2At ? 2 : 1;

const enemyName = (s: EngineState) => getEnemy(s.enemySlug)?.name ?? 'The enemy';

/** Damage the hero deals for a correct answer (04 "Combat rules"). Mutates the working copy `s`. */
function correctAnswer(s: EngineState, ev: BattleEventDto[]): { damage: number; focusGained: number } {
  const q = s.cur.question!;
  const move = s.cur.move!;
  const fx = s.hero.effects;
  s.combo += 1;
  const comboMult = BATTLE.combo[Math.min(s.combo, BATTLE.combo.length - 1)] as number;
  const enemyDef = s.enemy.def * (1 - fx.ignoreDefPct);
  const atk = s.hero.atk + fx.bonusAtk;
  const base = Math.max(1, Math.round(atk * BATTLE.damage.atkMult * comboMult - enemyDef * BATTLE.damage.defMult));

  let mult = BATTLE.moves[move].damageMult;
  if (s.armed === 'cleave') {
    mult *= 2;
    s.armed = null;
    ev.push({ type: 'cleave', text: 'Cleave! Double damage.' });
  }
  if (fx.berserk && s.heroHp < s.hero.maxHp * BATTLE.skills.berserkBelow) mult *= BATTLE.skills.berserkMult;
  if (fx.executioner && s.enemyHp < s.enemy.maxHp * BATTLE.skills.executionerBelow) mult *= BATTLE.skills.executionerMult;
  if (q.difficulty === 'hard') mult *= fx.hardDamageMult;
  if (s.intent === 'heavy') {
    mult *= 1 + BATTLE.intents.parryBonus;
    ev.push({ type: 'parry', text: 'Parry! You answer the heavy blow.' });
  }
  if (s.intent === 'guard') {
    const shattered = q.difficulty === 'hard' || (!s.bossGuard && (move === 'bold' || fx.shatterGuardAny));
    if (shattered) ev.push({ type: 'guardBreak', text: 'Guard broken!' });
    else {
      mult *= BATTLE.intents.guardDamageMult;
      ev.push({ type: 'guard', text: 'Their guard halves the blow.' });
    }
  }
  const damage = Math.max(1, Math.round(base * mult));

  let focusGain = 1;
  if (s.bossPhase === 3) focusGain += BATTLE.boss.phase3ExtraFocus;
  if (fx.focusFirstCorrect && !s.once.staffFocus) {
    focusGain += 1;
    s.once.staffFocus = true;
  }
  if (fx.quickStudy && s.combo % BATTLE.skills.quickStudyEvery === 0) focusGain += 1;
  const before = s.focus;
  s.focus = Math.min(BATTLE.focus.max, s.focus + focusGain);
  return { damage, focusGained: s.focus - before };
}

/** Damage and side effects of a wrong answer: the enemy's intent lands. Mutates the working copy `s`. */
function wrongAnswer(
  s: EngineState,
  ev: BattleEventDto[],
): { damage: number; enemyHealed: number; heroHealed: number } {
  const move = s.cur.move!;
  const fx = s.hero.effects;
  s.combo = 0;
  const st = BATTLE.strike;
  const strikePct = clamp(st.base + s.enemy.atk * st.perEnemyAtk, st.min, s.isBoss ? st.bossMax : st.max);
  const intentMult = s.intent === 'heavy' && move !== 'brace' ? BATTLE.intents.heavyTakenMult : 1;
  let raw = s.hero.maxHp * strikePct * intentMult * BATTLE.moves[move].takenMult * (1 - s.hero.def / (s.hero.def + st.defScale));
  if (s.bossPhase === 2) raw *= BATTLE.boss.phase2StrikeMult;
  if (s.bossPhase === 3) raw *= BATTLE.boss.phase3StrikeMult;
  raw *= fx.tankWrongMult * fx.wrongDamageMult;
  if (fx.firstWrongHalf && !s.once.wardenHalf) {
    raw *= BATTLE.gear.firstWrongMult;
    s.once.wardenHalf = true;
  }
  if (fx.stoneWall && s.heroHp < s.hero.maxHp * BATTLE.skills.stoneWallBelow) raw *= BATTLE.skills.stoneWallMult;
  let damage = Math.max(st.minDamage, Math.round(raw));

  let negated = false;
  if (s.armed === 'bulwark') {
    damage = 0;
    negated = true;
    s.armed = null;
    ev.push({ type: 'bulwark', text: 'Bulwark! The blow is negated.' });
  }

  let enemyHealed = 0;
  if (s.intent === 'drain' && move !== 'brace' && !negated) {
    enemyHealed = Math.min(s.enemy.maxHp - s.enemyHp, Math.round(s.enemy.maxHp * BATTLE.intents.drainHealPct));
    s.enemyHp += enemyHealed;
    if (enemyHealed > 0) ev.push({ type: 'drain', text: `${enemyName(s)} drains ${enemyHealed} HP.` });
  }

  s.heroHp = Math.max(0, s.heroHp - damage);
  let heroHealed = 0;
  if (
    s.heroHp > 0 &&
    fx.secondWind &&
    !s.once.secondWind &&
    s.heroHp < s.hero.maxHp * BATTLE.skills.secondWindBelow
  ) {
    s.once.secondWind = true;
    heroHealed = Math.min(s.hero.maxHp - s.heroHp, Math.round(s.hero.maxHp * BATTLE.skills.secondWindHeal));
    s.heroHp += heroHealed;
    ev.push({ type: 'heal', text: `Second Wind! You recover ${heroHealed} HP.` });
  }
  return { damage, enemyHealed, heroHealed };
}

/** Resolves the open turn's answer on a working copy of the state. Opening the next turn is the caller's job. */
export function resolveAnswer(s: EngineState, selectedIndex: number): AnswerResultDto {
  const q = s.cur.question!;
  const move = s.cur.move!;
  const correct = Number.isInteger(selectedIndex) && selectedIndex === q.correctIndex;
  const ev: BattleEventDto[] = [];
  const turnNumber = s.turn;
  let damageDealt = 0;
  let damageTaken = 0;
  let enemyHealed = 0;
  let heroHealed = 0;
  let focusGained = 0;

  if (correct) {
    const r = correctAnswer(s, ev);
    damageDealt = r.damage;
    focusGained = r.focusGained;
    s.enemyHp = Math.max(0, s.enemyHp - damageDealt);
    ev.unshift({ type: 'hit', text: `Correct! You deal ${damageDealt} damage.` });
  } else {
    const r = wrongAnswer(s, ev);
    damageTaken = r.damage;
    enemyHealed = r.enemyHealed;
    heroHealed = r.heroHealed;
    ev.unshift({
      type: 'miss',
      text: damageTaken > 0 ? `Wrong! ${enemyName(s)} hits you for ${damageTaken}.` : 'Wrong, but the blow is absorbed.',
    });
    if (!s.requeued.includes(q.ref) && !q.requeued) {
      s.requeue.push({ ref: q.ref, notBefore: s.turn + BATTLE.requeueGap });
    }
  }

  // Boss phases only ever go up (a Drain heal cannot undo them).
  if (s.isBoss && s.enemyHp > 0) {
    const next = bossPhaseFor(s.enemyHp, s.enemy.maxHp);
    if (next > s.bossPhase) {
      s.bossPhase = next;
      ev.push({ type: 'phase', text: next === 2 ? `${enemyName(s)} grows fierce.` : `${enemyName(s)} is enraged!` });
    }
  }

  s.tally.asked += 1;
  if (correct) s.tally.correct += 1;
  const sub = (s.tally.bySubject[q.subject] ??= { asked: 0, missed: 0 });
  sub.asked += 1;
  if (!correct) sub.missed += 1;

  let outcome: AnswerResultDto['outcome'] = null;
  if (s.enemyHp <= 0) {
    outcome = 'victory';
    ev.push({ type: 'victory', text: `${enemyName(s)} is defeated!` });
  } else if (s.heroHp <= 0) {
    outcome = 'defeat';
    ev.push({ type: 'defeat', text: 'You are defeated...' });
  }
  return {
    turnNumber,
    move,
    intent: s.intent,
    correct,
    selectedIndex,
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    damageDealt,
    damageTaken,
    enemyHealed,
    heroHealed,
    combo: s.combo,
    focusGained,
    events: ev,
    ended: outcome !== null,
    outcome,
  };
}
