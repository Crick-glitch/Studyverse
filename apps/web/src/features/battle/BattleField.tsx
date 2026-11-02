import { useEffect, useRef, useState, type RefObject } from 'react';
import type { BattleDto } from '@studyverse/shared';
import { BattleBackground } from '../art/components/BattleBackground';
import { Sprite } from '../art/components/Sprite';
import type { ArmorSlug, WeaponSlug } from '../art/sprites/hero';
import { PixelBar } from '../art/kit';
import { PixelButton } from '../art/kit/PixelButton';
import type { Fx } from './battleReducer';
import { useBattleAnimations, type BattleAnimations, type BattleEventName } from './useBattleAnimations';
import { useFocusOnMount } from './useFocusOnMount';
import styles from './battle.module.css';

type HeroPose = 'idle' | 'attack' | 'hit' | 'defeat' | 'victory';
type EnemyPose = 'idle' | 'attack' | 'hit' | 'defeat';
interface Poses {
  hero: HeroPose;
  enemy: EnemyPose;
  heroFlash: boolean;
  enemyFlash: boolean;
}

const poseFor = (b: BattleDto): Poses => ({
  hero: b.status === 'defeat' ? 'defeat' : b.status === 'victory' ? 'victory' : 'idle',
  enemy: b.status === 'victory' ? 'defeat' : 'idle',
  heroFlash: false, enemyFlash: false,
});

/**
 * Turns result effects into sprite poses (frames) and Anime.js timelines (movement), in order: the hero lunges and the enemy
 * flinches after a correct answer; the enemy lunges and the hero flinches after a wrong one; defeat and victory stay. Each
 * step also emits a named event, so sound plays when the move LANDS. Timers live in a ref and are cleared on unmount, so
 * nothing stacks and nothing fires after the screen is gone.
 */
function useActorPoses(
  battle: BattleDto,
  fx: Fx[],
  onFxDone: (ids: number[]) => void,
  anim: BattleAnimations,
  onEvent: ((e: BattleEventName) => void) | undefined,
): Poses {
  const [poses, setPoses] = useState<Poses>(() => poseFor(battle));
  const seen = useRef(new Set<number>());
  const timers = useRef<number[]>([]);
  const done = useRef(onFxDone);
  done.current = onFxDone;
  const emit = useRef(onEvent);
  emit.current = onEvent;
  const merge = (patch: Partial<Poses>) => setPoses((p) => ({ ...p, ...patch }));

  useEffect(() => {
    const fresh = fx.filter((f) => !seen.current.has(f.id));
    if (fresh.length === 0) return;
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const event = (e: BattleEventName) => emit.current?.(e);
    for (const f of fresh) seen.current.add(f.id);
    for (const f of fresh) {
      if (f.amount !== undefined) anim.play('damageNumber', f.id);
      if (f.kind === 'enemyHit') {
        merge({ hero: 'attack' });
        anim.play('heroAttack');
        event('heroAttack');
        later(240, () => { merge({ enemy: 'hit', enemyFlash: true }); anim.play('hitFlash', 'enemy'); event('hit'); });
        later(620, () => merge({ hero: 'idle', enemy: 'idle', enemyFlash: false }));
      } else if (f.kind === 'heroHit') {
        merge({ enemy: 'attack' });
        anim.play('enemyAttack');
        event('enemyAttack');
        later(240, () => { merge({ hero: 'hit', heroFlash: true }); anim.play('hitFlash', 'hero'); event('hit'); });
        later(620, () => merge({ hero: 'idle', enemy: 'idle', heroFlash: false }));
      } else if (f.kind === 'enemyDefeat') {
        later(700, () => { merge({ enemy: 'defeat', hero: 'victory', enemyFlash: false }); anim.play('victory'); event('victory'); });
      } else if (f.kind === 'heroDefeat') {
        later(700, () => { merge({ hero: 'defeat', enemy: 'idle', heroFlash: false }); anim.play('defeat'); event('defeat'); });
      } else if (f.kind === 'phase') anim.play('phaseChange');
      else if (f.kind === 'guardBreak') anim.play('guardShatter');
      else if (f.kind === 'shield') anim.play('shieldBurst');
    }
    const ids = fresh.map((f) => f.id);
    later(1150, () => done.current(ids));
  }, [fx, anim]);

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => window.clearTimeout(t));
  }, []);
  return poses;
}

/** Brace raises the guard, Bold winds up: once, when the move is chosen (not when a reload resumes a battle already mid-question). */
function useMoveCue(battle: BattleDto, anim: BattleAnimations): void {
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const current = battle.phase === 'awaitingAnswer' ? battle.move : null;
    if (prev.current !== undefined && current && prev.current !== current) {
      if (current === 'brace') anim.play('braceRaise');
      else if (current === 'bold') anim.play('boldWindup');
    }
    prev.current = current;
  }, [battle.phase, battle.move, anim]);
}

function Plate({ side, name, sub, hp, maxHp, segments, children }: { side: 'hero' | 'enemy'; name: string; sub: string; hp: number; maxHp: number; segments: number; children?: React.ReactNode }) {
  return (
    <div className={styles.plate} data-side={side}>
      <div className={styles.plateName}>
        <span>{name}</span>
        <small>{sub}</small>
      </div>
      <PixelBar value={hp} max={maxHp} tone={side === 'hero' ? 'hp' : 'enemy'} label={`${name} HP`} segments={segments} />
      {children}
    </div>
  );
}

export interface BattleFieldProps {
  battle: BattleDto;
  fx: Fx[];
  onFxDone: (ids: number[]) => void;
  /** Integer scale of the scene: 3 on wide screens, 2 on phones. */
  scale: 2 | 3;
  narrow: boolean;
  /** Mid-width screens (tablets): shorter HP bars so a plate never outgrows its column. */
  mid: boolean;
  intro: boolean;
  onBegin: () => void;
  /** Named events (heroAttack, hit, victory...) at the moment they land on screen; the page maps them to sound. */
  onEvent?: (e: BattleEventName) => void;
}

function IntroOverlay({ battle, onBegin }: { battle: BattleDto; onBegin: () => void }) {
  const focus = useFocusOnMount<HTMLButtonElement>();
  const { enemy } = battle;
  return (
    <div className={styles.intro}>
      <h2 className={styles.introTitle}>{enemy.isBoss ? 'Boss: ' : ''}{enemy.name}</h2>
      <p className={styles.introLine}>{enemy.intro ?? `${enemy.name} blocks the way through ${battle.dungeon.name}.`}</p>
      <PixelButton ref={focus} variant="primary" onClick={onBegin}>Begin</PixelButton>
    </div>
  );
}

export function BattleField({ battle, fx, onFxDone, scale, narrow, mid, intro, onBegin, onEvent }: BattleFieldProps) {
  const root = useRef<HTMLElement>(null);
  const anim = useBattleAnimations(root as RefObject<HTMLElement | null>, scale);
  const poses = useActorPoses(battle, fx, onFxDone, anim, onEvent);
  useMoveCue(battle, anim);
  const { hero, enemy } = battle;
  const cls = hero.playerClass ?? 'warrior';
  const enemyScale = enemy.isBoss ? 2 : scale === 3 ? 4 : 3;
  const enemyState: string = poses.enemy === 'idle' && enemy.isBoss && enemy.bossPhase >= 2 ? 'phase2' : poses.enemy;
  const segments = narrow ? 6 : mid ? 12 : 16;
  /** Phones and tablets: the intent is a strip under the field so it never squeezes the HP plates or covers a sprite. */
  const strip = narrow || mid;
  const banner = fx.find((f) => f.kind === 'phase' || f.kind === 'guardBreak');
  const intentBox = (
    <div className={styles.intent} data-key={battle.intent.key} data-testid="intent" data-placement={strip ? 'strip' : 'field'}>
      <span className={styles.intentName}>{battle.intent.name}</span>
      <span className={styles.intentEffect}>{battle.intent.bossGuard ? 'Iron guard: only a correct answer to a HARD question breaks it.' : battle.intent.effect}</span>
    </div>
  );

  return (
    <>
    <section ref={root} className={styles.field} aria-label="Battlefield" data-testid="battlefield" data-field style={{ ['--s' as string]: scale }}>
      <div className={styles.bg}>
        <BattleBackground id={battle.dungeon.background} scale={scale} label="" />
      </div>
      <div className={styles.shade} aria-hidden="true" />

      <div className={styles.hudRow}>
        <Plate side="hero" name="You" sub={`Lv ${hero.level}${hero.playerClass ? ` ${hero.playerClass}` : ''}`} hp={hero.hp} maxHp={hero.maxHp} segments={segments}>
          <div className={styles.stats}>
            <span>ATK {hero.atk}</span>
            <span>DEF {hero.def}</span>
            <span className={styles.pips} role="img" aria-label={`Focus ${battle.focus} of ${battle.focusMax}`}>
              {Array.from({ length: battle.focusMax }, (_, i) => <span key={i} className={styles.pip} data-on={i < battle.focus ? 'true' : 'false'} />)}
            </span>
          </div>
        </Plate>
        {strip ? null : intentBox}
        <Plate side="enemy" name={enemy.name} sub={enemy.isBoss ? `Boss${enemy.bossPhase > 1 ? ` · phase ${enemy.bossPhase}` : ''}` : `ATK ${enemy.atk}`} hp={enemy.hp} maxHp={enemy.maxHp} segments={segments} />
      </div>

      <div className={styles.actors}>
        <div className={styles.actor} data-actor="hero">
          <span data-lunge="hero">
          <Sprite
            id={`hero.${cls}`}
            state={poses.hero}
            scale={scale}
            animate
            flash={poses.heroFlash}
            decorative
            {...(hero.weapon ? { weapon: hero.weapon.slug as WeaponSlug } : {})}
            {...(hero.armor ? { armor: hero.armor.slug as ArmorSlug } : {})}
          />
          </span>
        </div>
        <div className={styles.actor} data-actor="enemy">
          <span data-lunge="enemy">
          <Sprite id={`monster.${enemy.slug}`} state={enemyState} scale={enemyScale} animate flash={poses.enemyFlash} decorative />
          </span>
        </div>
      </div>

      <div className={styles.fxLayer} aria-hidden="true">
        {fx.filter((f) => f.amount !== undefined).map((f) => (
          <span key={f.id} data-fx={f.id} className={styles.num} data-side={f.kind.startsWith('enemy') ? 'enemy' : 'hero'} data-tone={f.kind.endsWith('Heal') ? 'heal' : 'hit'}>
            {f.kind.endsWith('Heal') ? '+' : '-'}{f.amount}
          </span>
        ))}
      </div>
      {banner ? (
        <div className={styles.banner} aria-hidden="true" key={banner.id} data-banner>
          <span className={styles.bannerText}>{banner.text}</span>
        </div>
      ) : null}

      {intro ? <IntroOverlay battle={battle} onBegin={onBegin} /> : null}
    </section>
    {strip ? intentBox : null}
    </>
  );
}
