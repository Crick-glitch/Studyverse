import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleAnimations } from './useBattleAnimations';

// ---- mocked Anime.js: assert WHAT we ask it to do (whole pixels, cleanup, reduced motion) ----
const calls = vi.hoisted(() => ({ animate: [] as unknown[][], timelineAdds: [] as unknown[][], reverts: 0 }));
const reduced = vi.hoisted(() => ({ value: false }));
vi.mock('animejs', () => {
  const handle = () => ({ revert: () => { calls.reverts += 1; } });
  const timeline = () => {
    const tl = { ...handle(), add: (...a: unknown[]) => { calls.timelineAdds.push(a); return tl; } };
    return tl;
  };
  return { animate: (...a: unknown[]) => { calls.animate.push(a); return handle(); }, createTimeline: timeline, steps: (n: number) => `steps(${n})` };
});
vi.mock('../art/components/useReducedMotion', () => ({ useReducedMotion: () => reduced.value }));

const { useBattleAnimations } = await import('./useBattleAnimations');

let api: BattleAnimations;
function Harness({ scale }: { scale: number }) {
  const root = useRef<HTMLDivElement>(null);
  api = useBattleAnimations(root, scale);
  return (
    <div ref={root} data-field>
      <div data-actor="hero"><span data-lunge="hero" /></div>
      <div data-actor="enemy"><span data-lunge="enemy" /></div>
      <span data-fx="7" />
      <div data-banner />
    </div>
  );
}
const targets = (list: unknown[][]) => list.map((c) => (c[0] as HTMLElement).dataset);

beforeEach(() => {
  calls.animate = [];
  calls.timelineAdds = [];
  calls.reverts = 0;
  reduced.value = false;
});
afterEach(cleanup);

describe('useBattleAnimations (Anime.js)', () => {
  it('starts the two idle bobs on mount, targeting the actor wrappers', () => {
    render(<Harness scale={3} />);
    expect(targets(calls.animate).map((d) => d.actor)).toEqual(['hero', 'enemy']);
  });

  it('every move is a whole number of screen pixels (a multiple of the scale) with stepped easing', () => {
    render(<Harness scale={3} />);
    calls.timelineAdds = [];
    api.play('heroAttack');
    api.play('enemyAttack');
    api.play('hitFlash', 'enemy');
    api.play('guardShatter');
    for (const [, params] of calls.timelineAdds as [HTMLElement, { translateX?: number; ease: string }][]) {
      if (params.translateX !== undefined) expect(Number.isInteger(params.translateX / 3)).toBe(true);
      expect(params.ease).toMatch(/^steps\(/);
    }
    expect(calls.timelineAdds.length).toBeGreaterThan(6);
    // the hero lunges right, the enemy left
    const first = calls.timelineAdds.find((a) => (a[0] as HTMLElement).dataset.lunge === 'hero') as [HTMLElement, { translateX: number }];
    expect(first[1].translateX).toBeGreaterThan(0);
    const enemy = calls.timelineAdds.find((a) => (a[0] as HTMLElement).dataset.lunge === 'enemy') as [HTMLElement, { translateX: number }];
    expect(enemy[1].translateX).toBeLessThan(0);
  });

  it('damage numbers rise in whole pixels and fade; the phase banner blinks', () => {
    render(<Harness scale={2} />);
    calls.animate = [];
    calls.timelineAdds = [];
    api.play('damageNumber', 7);
    const [el, params] = calls.animate[0] as [HTMLElement, { translateY: number[]; opacity: number[] }];
    expect(el.dataset.fx).toBe('7');
    expect(params.translateY).toEqual([0, -28]); // 14 art pixels at scale 2
    expect(params.opacity).toEqual([1, 0]);
    api.play('phaseChange');
    expect((calls.timelineAdds[0]![0] as HTMLElement).hasAttribute('data-banner')).toBe(true);
  });

  it('a missing target is skipped without throwing (e.g. the banner is not on screen)', () => {
    render(<Harness scale={3} />);
    document.querySelector('[data-banner]')?.remove();
    expect(() => api.play('phaseChange')).not.toThrow();
    expect(() => api.play('damageNumber', 999)).not.toThrow();
  });

  it('reverts every animation on unmount, so nothing runs after the screen is gone', () => {
    const { unmount } = render(<Harness scale={3} />);
    api.play('heroAttack');
    api.play('victory');
    expect(calls.reverts).toBe(0);
    unmount();
    expect(calls.reverts).toBeGreaterThanOrEqual(4); // 2 idles + the two plays
  });

  it('reduced motion: nothing is created, play is a no-op', () => {
    reduced.value = true;
    render(<Harness scale={3} />);
    api.play('heroAttack');
    api.play('damageNumber', 7);
    api.play('victory');
    expect(calls.animate).toHaveLength(0);
    expect(calls.timelineAdds).toHaveLength(0);
  });
});
