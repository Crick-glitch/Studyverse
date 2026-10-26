import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { animOf, MANIFEST, isGridEntry } from '../manifest';
import { Sprite } from '.';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const mockReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches, media, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};
const markup = (c: ParentNode) => (c.querySelector('svg') as SVGSVGElement).innerHTML;
const wrapper = (c: ParentNode) => c.querySelector('[data-asset]') as HTMLElement;
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Sprite frame playback', () => {
  it('knows that hero and monster idle loops and attack plays once', () => {
    const hero = MANIFEST['hero.warrior'];
    const goblin = MANIFEST['monster.goblin-chieftain'];
    for (const e of [hero, goblin]) {
      expect(e && isGridEntry(e)).toBe(true);
      if (!e || !isGridEntry(e)) continue;
      expect(animOf(e, 'idle')).toMatchObject({ frames: 2, loop: true });
      expect(animOf(e, 'attack')).toMatchObject({ frames: 3, loop: false, still: 1 });
      expect(animOf(e, 'hit').frames).toBe(1);
    }
  });

  it('plays the two idle frames and loops', () => {
    vi.useFakeTimers();
    const { container } = render(<Sprite id="hero.warrior" animate />);
    const first = markup(container);
    expect(wrapper(container).dataset.animate).toBe('true');
    expect(wrapper(container).className).not.toMatch(/bob/);
    tick(560);
    const second = markup(container);
    expect(second).not.toBe(first);
    tick(520);
    expect(markup(container)).toBe(first);
  });

  it('plays wind-up, impact and recovery once, holds the last frame and reports completion once', () => {
    vi.useFakeTimers();
    const done = vi.fn();
    const { container } = render(<Sprite id="hero.warrior" state="attack" animate onAnimationDone={done} />);
    const windup = markup(container);
    tick(160);
    const impact = markup(container);
    tick(100);
    const recovery = markup(container);
    expect(new Set([windup, impact, recovery]).size).toBe(3);
    expect(done).not.toHaveBeenCalled();
    tick(210);
    expect(done).toHaveBeenCalledTimes(1);
    tick(3000);
    expect(done).toHaveBeenCalledTimes(1);
    expect(markup(container)).toBe(recovery);
  });

  it('shows the impact frame for a still attack and an explicit frame when asked', () => {
    const still = render(<Sprite id="monster.gearwork-golem" state="attack" />);
    const impact = markup(still.container);
    expect(wrapper(still.container).dataset.animate).toBeUndefined();
    still.unmount();
    const windup = render(<Sprite id="monster.gearwork-golem" state="attack" frame={0} />);
    expect(markup(windup.container)).not.toBe(impact);
    windup.unmount();
    const explicit = render(<Sprite id="monster.gearwork-golem" state="attack" frame={1} />);
    expect(markup(explicit.container)).toBe(impact);
  });

  it('is fully static under prefers-reduced-motion and shows the impact pose for an attack', () => {
    mockReducedMotion(true);
    vi.useFakeTimers();
    const done = vi.fn();
    const a = render(<Sprite id="hero.warrior" state="attack" animate onAnimationDone={done} />);
    const before = markup(a.container);
    expect(wrapper(a.container).dataset.animate).toBeUndefined();
    tick(5000);
    expect(markup(a.container)).toBe(before);
    expect(done).not.toHaveBeenCalled();
    a.unmount();
    const idle = render(<Sprite id="monster.goblin-chieftain" animate />);
    const idleBefore = markup(idle.container);
    tick(5000);
    expect(markup(idle.container)).toBe(idleBefore);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the one-pixel bob for single-frame states', () => {
    const { container } = render(<Sprite id="hero.warrior" state="hit" animate scale={3} />);
    expect(wrapper(container).dataset.animate).toBe('true');
    expect(wrapper(container).className).toMatch(/bob/);
    expect(wrapper(container).style.getPropertyValue('--px')).toBe('3px');
  });

  it('stops its timer when it unmounts', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Sprite id="hero.tank" animate />);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
