import type { PixelGrid } from '../grid';
import {
  MATERIALS,
  MATERIAL_KEYS,
  PALETTE,
  TRANSPARENT,
  charOf,
  type ColorKey,
  type MaterialKey,
} from '../palette';

export type Pt = readonly [number, number];

export interface BakeOptions {
  /** Draw a 1px dark outline around the silhouette (default true). */
  outline?: boolean;
  outlineKey?: ColorKey;
  /** Skip edge shading and paint every cell in its mid tone. */
  shade?: boolean;
  /** One-frame hit flash: everything shaded turns near-white. */
  flash?: boolean;
  /** Defeated look: every colour mapped to the charcoal ramp. */
  gray?: boolean;
  /**
   * Form shading depth for big flat-looking shapes: cells up to `rim` pixels from a top/left edge take the light
   * tone and from a bottom/right edge the dark tone, so a dark cloak reads as a volume. Off by default.
   */
  rim?: number;
  /** Swap materials before baking (boss phase 2, recolours). */
  remap?: Partial<Record<MaterialKey, MaterialKey>>;
}

const GRAYS: ColorKey[] = ['charcoal-800', 'charcoal-600', 'charcoal-400', 'charcoal-200'];
const luma = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const toGray = (key: ColorKey): ColorKey => {
  const l = luma(PALETTE[key]);
  return GRAYS[l < 0.2 ? 0 : l < 0.4 ? 1 : l < 0.65 ? 2 : 3] as ColorKey;
};

type RampShape = { dark: ColorKey; mid: ColorKey; light: ColorKey; flat?: boolean; noOutline?: boolean };

/**
 * A material canvas. Sprites are drawn with materials (skin, steel, teal ...), then `bake()` adds the
 * shading, the outline and any state effect, and returns a palette-indexed PixelGrid. This keeps every
 * sprite in the same shading language and lets one drawing produce idle / hit / defeat variants.
 */
export class Canvas {
  readonly cells: Uint8Array;
  /** When true every drawing call is also drawn mirrored around `axis` (x of the mirror line). */
  mirror = false;
  axis: number;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = new Uint8Array(w * h);
    this.axis = (w - 1) / 2;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): MaterialKey | null {
    if (!this.inside(x, y)) return null;
    const v = this.cells[y * this.w + x] ?? 0;
    return v === 0 ? null : (MATERIAL_KEYS[v - 1] ?? null);
  }
  private put(x: number, y: number, m: MaterialKey | null) {
    if (!this.inside(x, y)) return;
    this.cells[y * this.w + x] = m === null ? 0 : MATERIAL_KEYS.indexOf(m) + 1;
  }
  set(x: number, y: number, m: MaterialKey | null): this {
    x = Math.round(x);
    y = Math.round(y);
    this.put(x, y, m);
    if (this.mirror) this.put(Math.round(2 * this.axis - x), y, m);
    return this;
  }
  px(x: number, y: number, m: MaterialKey): this {
    return this.set(x, y, m);
  }
  rect(x: number, y: number, w: number, h: number, m: MaterialKey | null): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m);
    return this;
  }
  /** Ellipse centred on (cx, cy); half-integers give even widths. */
  ellipse(cx: number, cy: number, rx: number, ry: number, m: MaterialKey | null): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0001) this.set(x, y, m);
      }
    }
    return this;
  }
  disc(cx: number, cy: number, r: number, m: MaterialKey | null): this {
    return this.ellipse(cx, cy, r, r, m);
  }
  line(x0: number, y0: number, x1: number, y1: number, m: MaterialKey | null, thick = 1): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor(thick / 2);
    for (;;) {
      this.rect(x0 - off, y0 - off, thick, thick, m);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  /** Filled polygon (even-odd, sampled at cell centres). */
  poly(points: readonly Pt[], m: MaterialKey | null): this {
    if (points.length < 3) return this;
    const ys = points.map((p) => p[1]);
    const xs = points.map((p) => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i] as Pt;
          const [xj, yj] = points[j] as Pt;
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, m);
      }
    }
    return this;
  }
  /**
   * Stamp small hand-drawn art. Each character maps to a material; '.' and ' ' are skipped.
   * Used for faces, runes, icons and other details too small for the shape tools.
   */
  stamp(rows: readonly string[], x: number, y: number, map: Record<string, MaterialKey>): this {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        const m = map[ch];
        if (m) this.set(x + i, y + j, m);
      });
    });
    return this;
  }
  clear(x: number, y: number, w: number, h: number): this {
    return this.rect(x, y, w, h, null);
  }
  /** Copy opaque cells of another canvas on top of this one. */
  blit(src: Canvas, ox = 0, oy = 0): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const m = src.get(x, y);
        if (m) this.put(x + ox, y + oy, m);
      }
    }
    return this;
  }
  /** Draw with mirroring switched on for the duration of `fn`. */
  symmetric(fn: () => void, axis = (this.w - 1) / 2): this {
    const was = this.mirror;
    const wasAxis = this.axis;
    this.mirror = true;
    this.axis = axis;
    fn();
    this.mirror = was;
    this.axis = wasAxis;
    return this;
  }

  copy(): Canvas {
    const c = new Canvas(this.w, this.h);
    c.cells.set(this.cells);
    return c;
  }
  shifted(dx: number, dy: number): Canvas {
    const c = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.put(x + dx, y + dy, this.get(x, y));
    return c;
  }
  flipX(): Canvas {
    const c = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) c.put(this.w - 1 - x, y, this.get(x, y));
    return c;
  }
  /** Rotate a square canvas 90 degrees; `cw` false turns it counter-clockwise. */
  rotated(cw: boolean): Canvas {
    const c = new Canvas(this.h, this.w);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const m = this.get(x, y);
        if (cw) c.put(this.h - 1 - y, x, m);
        else c.put(y, this.w - 1 - x, m);
      }
    }
    return c;
  }
  /** Compress vertically towards the bottom edge (nearest-neighbour, so rows stay crisp). */
  squashedY(ratio: number): Canvas {
    const c = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const sy = this.h - 1 - Math.floor((this.h - 1 - y) / ratio);
      if (sy < 0) continue;
      for (let x = 0; x < this.w; x++) c.put(x, y, this.get(x, sy));
    }
    return c;
  }
  /**
   * Settle the upper body down by `amount` rows while the feet stay planted (an idle "breath").
   * Everything above a pivot 55% of the way down the sprite moves; one row at the pivot is overwritten.
   */
  breathed(amount = 1, pivotFrac = 0.55): Canvas {
    const b = this.bounds();
    if (!b || amount <= 0) return this.copy();
    const pivot = b.y0 + Math.floor((b.y1 - b.y0) * pivotFrac);
    const c = new Canvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const sy = y <= pivot ? y - amount : y;
      for (let x = 0; x < this.w; x++) c.put(x, y, this.get(x, sy));
    }
    return c;
  }
  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.cells[y * this.w + x]) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  }
  /** Move the content so its lowest opaque row sits on `groundY` (used after rotating a fallen sprite). */
  droppedTo(groundY: number): Canvas {
    const b = this.bounds();
    return b ? this.shifted(0, groundY - b.y1) : this.copy();
  }

  bake(opts: BakeOptions = {}): PixelGrid {
    const { outline = true, outlineKey = 'charcoal-950', shade = true, flash = false, gray = false } = opts;
    const remap = opts.remap ?? {};
    const mat = (x: number, y: number): MaterialKey | null => {
      const m = this.get(x, y);
      return m ? (remap[m] ?? m) : null;
    };
    const keyAt: (ColorKey | null)[] = new Array<ColorKey | null>(this.w * this.h).fill(null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const m = mat(x, y);
        if (!m) continue;
        const ramp = MATERIALS[m] as RampShape;
        let key: ColorKey = ramp.mid;
        if (!ramp.flat && shade) {
          const top = mat(x, y - 1) !== m;
          const bottom = mat(x, y + 1) !== m;
          const right = mat(x + 1, y) !== m;
          if (top && !bottom) key = ramp.light;
          else if (bottom && !top) key = ramp.dark;
          else if (!top && !bottom && right) key = ramp.dark;
          const rim = opts.rim ?? 0;
          if (rim > 1 && key === ramp.mid) {
            const near = (dx: number, dy: number) => {
              for (let k = 2; k <= rim; k++) if (mat(x + dx * k, y + dy * k) !== m) return true;
              return false;
            };
            if (near(0, -1) || near(-1, 0)) key = ramp.light;
            else if (near(0, 1) || near(1, 0)) key = ramp.dark;
          }
        }
        if (flash && !ramp.flat) {
          key = key === ramp.light ? 'parchment-50' : key === ramp.mid ? 'parchment-100' : 'parchment-300';
        }
        keyAt[y * this.w + x] = gray ? toGray(key) : key;
      }
    }
    if (outline) {
      const out = [...keyAt];
      const casts = (x: number, y: number) => {
        const m = mat(x, y);
        return m !== null && !(MATERIALS[m] as RampShape).noOutline;
      };
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (keyAt[y * this.w + x]) continue;
          if (casts(x - 1, y) || casts(x + 1, y) || casts(x, y - 1) || casts(x, y + 1)) {
            out[y * this.w + x] = outlineKey;
          }
        }
      }
      keyAt.splice(0, keyAt.length, ...out);
    }
    const rows: string[] = [];
    for (let y = 0; y < this.h; y++) {
      let row = '';
      for (let x = 0; x < this.w; x++) {
        const k = keyAt[y * this.w + x];
        row += k ? charOf(k) : TRANSPARENT;
      }
      rows.push(row);
    }
    return { w: this.w, h: this.h, rows };
  }
}
