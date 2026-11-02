import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBattleAnimations, type BattleAnim, type BattleAnimations } from './useBattleAnimations';

// No mocks here: the REAL Anime.js (v4) runs in jsdom, so a wrong call shape (a v3-style API, a bad option) fails this test.
let api: BattleAnimations;
function Harness() {
  const root = useRef<HTMLDivElement>(null);
  api = useBattleAnimations(root, 3);
  return (
    <div ref={root} data-field>
      <div data-actor="hero"><span data-lunge="hero" /></div>
      <div data-actor="enemy"><span data-lunge="enemy" /></div>
      <span data-fx="1" />
      <div data-banner />
    </div>
  );
}
afterEach(cleanup);

const ALL: BattleAnim[] = ['heroAttack', 'enemyAttack', 'boldWindup', 'braceRaise', 'shieldBurst', 'guardShatter', 'victory', 'defeat', 'phaseChange'];

describe('useBattleAnimations with the real Anime.js', () => {
  it('every named timeline can be created and reverted without throwing', () => {
    const { unmount } = render(<Harness />);
    for (const name of ALL) expect(() => api.play(name)).not.toThrow();
    expect(() => api.play('hitFlash', 'hero')).not.toThrow();
    expect(() => api.play('damageNumber', 1)).not.toThrow();
    expect(() => api.clear()).not.toThrow();
    expect(() => unmount()).not.toThrow();
  });
});
