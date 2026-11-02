import { animate, createTimeline, steps } from 'animejs';
import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { useReducedMotion } from '../art/components/useReducedMotion';

/**
 * The battle's animation library (06, P2): one hook, named timelines, all built with Anime.js (v4 API: `animate`,
 * `createTimeline`, `steps`, `.revert()`). Rules this keeps:
 *  - WHOLE-pixel moves only (`scale` screen pixels per art pixel) with `steps()` easing, so pixel art never blurs or shimmers;
 *  - every animation is tracked and reverted on unmount (and when motion is reduced), so nothing stacks or fires after the screen is gone;
 *  - with `prefers-reduced-motion` nothing moves at all: `play` is a no-op and the idle loops never start.
 * Elements are found by data attributes inside `root`: [data-actor=hero|enemy] (idle bob), [data-lunge=hero|enemy] (attacks and
 * hits), [data-fx=<id>] (floating numbers) and [data-banner] (phase banner).
 */
export type BattleAnim =
  | 'heroIdle' | 'enemyIdle' | 'heroAttack' | 'enemyAttack' | 'hitFlash' | 'damageNumber'
  | 'shieldBurst' | 'guardShatter' | 'phaseChange' | 'victory' | 'defeat' | 'braceRaise' | 'boldWindup';
export type Side = 'hero' | 'enemy';
/** Event names shared by animations and sound, so the two cannot drift apart. */
export type BattleEventName = 'heroAttack' | 'enemyAttack' | 'hit' | 'victory' | 'defeat';

interface Revertable {
  revert: () => unknown;
}

export interface BattleAnimations {
  play: (name: BattleAnim, arg?: Side | string | number) => void;
  /** Stop and reset everything now (used when the screen changes step). */
  clear: () => void;
}

export function useBattleAnimations(root: RefObject<HTMLElement | null>, scale: number): BattleAnimations {
  const reduced = useReducedMotion();
  const live = useRef(new Set<Revertable>());

  const lib = useMemo(() => {
    const find = (sel: string) => root.current?.querySelector<HTMLElement>(sel) ?? null;
    const track = <T extends Revertable>(a: T): T => {
      live.current.add(a);
      return a;
    };
    const px = (n: number) => n * scale;
    const lunge = (side: Side) => find(`[data-lunge="${side}"]`);
    const actor = (side: Side) => find(`[data-actor="${side}"]`);
    /** A move out and back in whole pixels. */
    const out = (t: HTMLElement | null, dx: number, ms: number) => {
      if (!t) return;
      track(createTimeline().add(t, { translateX: px(dx), duration: ms, ease: steps(3) }).add(t, { translateX: 0, duration: ms, ease: steps(3) }));
    };
    const hop = (t: HTMLElement | null, dy: number, times: number) => {
      if (!t) return;
      track(animate(t, { translateY: [0, -px(dy), 0], duration: 360, ease: steps(4), loop: times - 1 }));
    };
    const shake = (t: HTMLElement | null, amp: number) => {
      if (!t) return;
      const tl = createTimeline();
      for (const [i, dx] of [-amp, amp, -amp / 2, 0].entries()) tl.add(t, { translateX: px(dx), duration: 70, ease: steps(1) }, i * 70);
      track(tl);
    };
    const bob = (t: HTMLElement | null) => {
      if (t) track(animate(t, { translateY: [0, -px(1)], duration: 650, ease: steps(1), loop: true, alternate: true }));
    };
    return {
      heroIdle: () => bob(actor('hero')),
      enemyIdle: () => bob(actor('enemy')),
      heroAttack: () => out(lunge('hero'), 12, 130),
      enemyAttack: () => out(lunge('enemy'), -12, 130),
      boldWindup: () => out(lunge('hero'), -10, 200), // a long pull-back before the swing
      braceRaise: () => hop(lunge('hero'), 3, 1), // the guard goes up: a small hop
      shieldBurst: () => hop(lunge('hero'), 4, 2),
      hitFlash: (side: Side) => shake(lunge(side), 2),
      guardShatter: () => shake(lunge('enemy'), 4),
      victory: () => hop(actor('hero'), 8, 2),
      defeat: () => shake(find('[data-field]'), 3),
      damageNumber: (id: string | number) => {
        const t = find(`[data-fx="${id}"]`);
        if (t) track(animate(t, { translateY: [0, -px(14)], opacity: [1, 0], duration: 1000, ease: steps(8) }));
      },
      phaseChange: () => {
        const t = find('[data-banner]');
        if (t) track(createTimeline().add(t, { opacity: [0, 1], duration: 120, ease: steps(1) }).add(t, { opacity: 0, duration: 200, ease: steps(2) }, 1100));
      },
    };
  }, [root, scale]);

  const clear = useCallback(() => {
    live.current.forEach((a) => a.revert());
    live.current.clear();
  }, []);

  // Idle bob: only while motion is allowed; reverted when it is not, and on unmount.
  useEffect(() => {
    if (reduced) return;
    lib.heroIdle();
    lib.enemyIdle();
    return clear;
  }, [reduced, lib, clear]);

  const play = useCallback<BattleAnimations['play']>(
    (name, arg) => {
      if (reduced) return;
      if (name === 'hitFlash') lib.hitFlash((arg as Side) ?? 'enemy');
      else if (name === 'damageNumber') lib.damageNumber(arg as string | number);
      else lib[name]();
    },
    [reduced, lib],
  );
  return { play, clear };
}
