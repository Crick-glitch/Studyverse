import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALETTE } from '../palette';
import { MANIFEST, type AssetEntry, type Manifest } from '../manifest';
import { heroGrid } from '../sprites/hero';
import { BattleBackground, ItemIcon, PixelGridSvg, Sprite } from '.';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

const svgOf = (c: ParentNode) => c.querySelector('svg') as SVGSVGElement;
const mockReducedMotion = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches, media, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const fixture = (over: Partial<AssetEntry> & { key: string; kind: 'image' | 'svg'; src: string }): Manifest => ({
  [over.key]: { group: 'ui', size: { w: 16, h: 16 }, scale: 2, anchor: { x: 8, y: 8 }, license: 'CC0-1.0', source: 'test', ...over } as AssetEntry,
});

describe('PixelGridSvg', () => {
  const grid = heroGrid('warrior', 'idle');

  it('draws crisp, whole-pixel SVG at the requested integer scale', () => {
    const { container } = render(<PixelGridSvg grid={grid} scale={3} label="Warrior" />);
    const svg = svgOf(container);
    expect(svg.getAttribute('width')).toBe(String(grid.w * 3));
    expect(svg.getAttribute('height')).toBe(String(grid.h * 3));
    expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(svg.style.imageRendering).toBe('pixelated');
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${grid.w} ${grid.h}`);
  });

  it('only ever fills with palette colours', () => {
    const { container } = render(<PixelGridSvg grid={grid} />);
    const allowed = new Set(Object.values(PALETTE).map((h) => h.toLowerCase()));
    const fills = [...container.querySelectorAll('path')].map((p) => (p.getAttribute('fill') ?? '').toLowerCase());
    expect(fills.length).toBeGreaterThan(5);
    expect(fills.every((f) => allowed.has(f))).toBe(true);
  });

  it('rounds a fractional scale to a whole number instead of blurring', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(<PixelGridSvg grid={grid} scale={2.6} />);
    expect(svgOf(container).getAttribute('width')).toBe(String(grid.w * 3));
    expect(warn).toHaveBeenCalled();
  });

  it('is hidden from assistive tech unless it has a label', () => {
    const a = render(<PixelGridSvg grid={grid} />);
    expect(svgOf(a.container).getAttribute('aria-hidden')).toBe('true');
    a.unmount();
    render(<PixelGridSvg grid={grid} label="Hero" />);
    expect(screen.getByRole('img', { name: 'Hero' })).toBeTruthy();
  });
});

describe('Sprite', () => {
  it('uses the manifest default scale and names the art for assistive tech', () => {
    const { container } = render(<Sprite id="hero.warrior" />);
    expect(svgOf(container).getAttribute('width')).toBe(String(64 * 3));
    expect(screen.getByRole('img', { name: 'warrior' })).toBeTruthy();
  });

  it('can be decorative, flipped, and drawn at another whole scale', () => {
    const { container } = render(<Sprite id="monster.gearwork-golem" scale={2} flip decorative />);
    const svg = svgOf(container);
    expect(svg.getAttribute('width')).toBe(String(48 * 2));
    expect(svg.style.transform).toBe('scaleX(-1)');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows a labelled placeholder (never an emoji) for an unknown key', () => {
    render(<Sprite id="monster.does-not-exist" />);
    const ph = screen.getByRole('img', { name: 'Missing art: monster.does-not-exist' });
    expect(ph.textContent).toContain('monster.does-not-exist');
    expect(ph.getAttribute('data-missing')).toBe('monster.does-not-exist');
  });

  it('shows a placeholder for a state the asset does not have', () => {
    render(<Sprite id="hero.warrior" state="no-such-state" />);
    expect(screen.getByRole('img', { name: 'Missing art: hero.warrior:no-such-state' })).toBeTruthy();
  });

  it('renders boss phase 2 but refuses it for a regular enemy', () => {
    const a = render(<Sprite id="monster.archivist-lich" state="phase2" />);
    expect(a.container.querySelector('[data-asset="monster.archivist-lich"]')).toBeTruthy();
    a.unmount();
    render(<Sprite id="monster.goblin-chieftain" state="phase2" />);
    expect(screen.getByRole('img', { name: /Missing art/ })).toBeTruthy();
  });

  it('applies gear options to the hero picture', () => {
    const a = render(<Sprite id="hero.tank" weapon="quillblade" armor="wardens-plate" />);
    const html1 = a.container.innerHTML;
    a.unmount();
    const b = render(<Sprite id="hero.tank" />);
    expect(b.container.innerHTML).not.toBe(html1);
  });

  describe('idle animation', () => {
    it('bobs by one art pixel (stepped, whole pixels) when animate is on', () => {
      mockReducedMotion(false);
      const { container } = render(<Sprite id="hero.warrior" animate scale={3} />);
      const el = container.querySelector('[data-asset="hero.warrior"]') as HTMLElement;
      expect(el.getAttribute('data-animate')).toBe('true');
      expect(el.style.getPropertyValue('--px')).toBe('3px');
    });

    it('stays still under prefers-reduced-motion', () => {
      mockReducedMotion(true);
      const { container } = render(<Sprite id="hero.warrior" animate />);
      expect(container.querySelector('[data-animate]')).toBeNull();
    });

    it('is static unless asked to animate', () => {
      mockReducedMotion(false);
      const { container } = render(<Sprite id="hero.warrior" />);
      expect(container.querySelector('[data-animate]')).toBeNull();
    });
  });

  describe('effect sheets', () => {
    const frameHtml = (frame: number) => {
      const r = render(<Sprite id="effect.impact" frame={frame} />);
      const html = r.container.innerHTML;
      r.unmount();
      return html;
    };

    it('shows the requested frame and different frames differ', () => {
      expect(frameHtml(0)).not.toBe(frameHtml(1));
      expect(frameHtml(0)).toBe(frameHtml(0));
    });

    it('plays through frames on a timer, and holds a single frame under reduced motion', () => {
      vi.useFakeTimers();
      mockReducedMotion(false);
      const { container } = render(<Sprite id="effect.slash" animate />);
      const first = container.innerHTML;
      act(() => void vi.advanceTimersByTime(100));
      expect(container.innerHTML).not.toBe(first);
      cleanup();

      mockReducedMotion(true);
      const still = render(<Sprite id="effect.slash" animate />);
      const held = still.container.innerHTML;
      act(() => void vi.advanceTimersByTime(500));
      expect(still.container.innerHTML).toBe(held);
    });
  });

  describe('file-based art (svg / image)', () => {
    beforeEach(() => mockReducedMotion(false));

    it('draws a local image with pixelated rendering at an integer scale', () => {
      const m = fixture({ key: 'ui.fixture', kind: 'image', src: '/assets/vendor/pack/thing.png' });
      const { container } = render(<Sprite id="ui.fixture" manifest={m} decorative />);
      const img = container.querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('/assets/vendor/pack/thing.png');
      expect(img.getAttribute('width')).toBe('32');
      expect(img.style.imageRendering).toBe('pixelated');
      expect(img.getAttribute('alt')).toBe('');
    });

    it.each(['https://example.com/a.png', 'http://example.com/a.png', '//example.com/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)'])(
      'refuses a non-local source: %s',
      (src) => {
        const m = fixture({ key: 'ui.fixture', kind: 'svg', src });
        const { container } = render(<Sprite id="ui.fixture" manifest={m} />);
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByRole('img', { name: 'Missing art: ui.fixture' })).toBeTruthy();
      },
    );
  });
});

describe('BattleBackground', () => {
  it('stacks far, mid and near layers in order at the manifest scale', () => {
    const { container } = render(<BattleBackground id="dungeon.archive" />);
    const root = screen.getByRole('img', { name: 'archive' });
    expect(root.style.width).toBe(`${320 * 3}px`);
    expect(root.style.height).toBe(`${180 * 3}px`);
    expect([...container.querySelectorAll('[data-layer]')].map((l) => l.getAttribute('data-layer'))).toEqual(['far', 'mid', 'near']);
    expect(container.querySelectorAll('svg')).toHaveLength(3);
  });

  it('honours a smaller whole-number scale', () => {
    render(<BattleBackground id="dungeon.foundry" scale={1} />);
    expect(screen.getByRole('img', { name: 'foundry' }).style.width).toBe('320px');
  });

  it('is also what Sprite renders for a scene key', () => {
    const { container } = render(<Sprite id="scene.camp" scale={2} />);
    expect(container.querySelectorAll('[data-layer]')).toHaveLength(3);
  });

  it('falls back for an unknown scene or for a key that is not a scene', () => {
    render(<BattleBackground id="dungeon.nope" />);
    render(<BattleBackground id="hero.warrior" />);
    expect(screen.getAllByRole('img', { name: /Missing art/ })).toHaveLength(2);
  });
});

describe('ItemIcon', () => {
  it('draws the icon inside its catalog rarity frame (36px frame, 2px padding)', () => {
    const { container } = render(<ItemIcon id="weapon.quillblade" />);
    const root = screen.getByRole('img', { name: 'quillblade, rare' });
    expect(root.getAttribute('data-rarity')).toBe('rare');
    expect(root.style.width).toBe(`${36 * 2}px`);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });

  it('lets the caller override the frame rarity', () => {
    render(<ItemIcon id="armor.iron-plate" rarity="rare" />);
    expect(screen.getByRole('img', { name: 'iron plate, rare' }).getAttribute('data-rarity')).toBe('rare');
  });

  it('refuses things that are not items', () => {
    render(<ItemIcon id="hero.warrior" />);
    render(<ItemIcon id="frame.rare" />);
    render(<ItemIcon id="weapon.not-real" />);
    expect(screen.getAllByRole('img', { name: /Missing art/ })).toHaveLength(3);
  });

  it('every catalog item renders', () => {
    for (const key of Object.keys(MANIFEST).filter((k) => /^(weapon|armor)\./.test(k))) {
      const { container, unmount } = render(<ItemIcon id={key} />);
      expect([key, container.querySelectorAll('svg').length]).toEqual([key, 2]);
      unmount();
    }
  });
});
