import { CHARS, COLOR_KEYS, PALETTE, TRANSPARENT, keyOfChar, type ColorKey } from './palette';

/** A palette-indexed pixel grid: `rows[y][x]` is a palette character, or '.' for transparent. */
export interface PixelGrid {
  readonly w: number;
  readonly h: number;
  readonly rows: readonly string[];
}

export const blankGrid = (w: number, h: number): PixelGrid => ({
  w,
  h,
  rows: Array.from({ length: h }, () => TRANSPARENT.repeat(w)),
});

/** Returns a list of problems (empty = valid). Used by the manifest test and by dev warnings. */
export function validateGrid(g: PixelGrid): string[] {
  const problems: string[] = [];
  if (g.rows.length !== g.h) problems.push(`expected ${g.h} rows, found ${g.rows.length}`);
  g.rows.forEach((row, y) => {
    if (row.length !== g.w) problems.push(`row ${y}: width ${row.length}, expected ${g.w}`);
    for (const ch of row) {
      if (ch !== TRANSPARENT && !keyOfChar(ch)) {
        problems.push(`row ${y}: unknown palette character '${ch}'`);
        break;
      }
    }
  });
  return problems;
}

/** Number of opaque cells. */
export const opaqueCount = (g: PixelGrid): number =>
  g.rows.reduce((n, r) => n + [...r].filter((c) => c !== TRANSPARENT).length, 0);

/** The distinct palette colours a grid uses. */
export function colorsUsed(g: PixelGrid): ColorKey[] {
  const seen = new Set<string>();
  for (const r of g.rows) for (const c of r) if (c !== TRANSPARENT) seen.add(c);
  return COLOR_KEYS.filter((k) => seen.has(CHARS[COLOR_KEYS.indexOf(k)] as string));
}

/** Overlay grids of equal size; later grids win. Transparent cells never overwrite. */
export function overlay(grids: readonly PixelGrid[]): PixelGrid {
  const first = grids[0];
  if (!first) throw new Error('overlay needs at least one grid');
  const rows = first.rows.map((_, y) =>
    Array.from({ length: first.w }, (_, x) => {
      let ch = TRANSPARENT;
      for (const g of grids) {
        const c = g.rows[y]?.[x] ?? TRANSPARENT;
        if (c !== TRANSPARENT) ch = c;
      }
      return ch;
    }).join(''),
  );
  return { w: first.w, h: first.h, rows };
}

export interface PathSpec {
  color: ColorKey;
  hex: string;
  d: string;
}

/**
 * Turns a grid into one SVG path per colour. Horizontal runs are merged, then identical runs on
 * consecutive rows are merged into taller rectangles, so banded backgrounds stay small. All
 * coordinates are integers, so with `shape-rendering: crispEdges` nothing is ever blurred.
 */
export function gridToPaths(g: PixelGrid): PathSpec[] {
  const out = new Map<ColorKey, string[]>();
  interface Rect {
    x: number;
    w: number;
    y: number;
    h: number;
    ch: string;
  }
  let open = new Map<string, Rect>();
  const flush = (r: Rect) => {
    const key = keyOfChar(r.ch);
    if (!key) return;
    const list = out.get(key) ?? [];
    list.push(`M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`);
    out.set(key, list);
  };
  for (let y = 0; y < g.h; y++) {
    const row = g.rows[y] ?? '';
    const next = new Map<string, Rect>();
    let x = 0;
    while (x < g.w) {
      const ch = row[x] ?? TRANSPARENT;
      let end = x + 1;
      while (end < g.w && row[end] === ch) end++;
      if (ch !== TRANSPARENT) {
        const k = `${x}:${end - x}:${ch}`;
        const prev = open.get(k);
        if (prev) {
          prev.h += 1;
          next.set(k, prev);
          open.delete(k);
        } else next.set(k, { x, w: end - x, y, h: 1, ch });
      }
      x = end;
    }
    for (const r of open.values()) flush(r);
    open = next;
  }
  for (const r of open.values()) flush(r);
  return [...out.entries()].map(([color, parts]) => ({ color, hex: PALETTE[color], d: parts.join('') }));
}

/** Plain RGBA bytes for tests and the contact-sheet script (scale 1). */
export function gridToRgba(g: PixelGrid): Uint8Array {
  const data = new Uint8Array(g.w * g.h * 4);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const key = keyOfChar(g.rows[y]?.[x] ?? TRANSPARENT);
      if (!key) continue;
      const hex = PALETTE[key];
      const i = (y * g.w + x) * 4;
      data[i] = parseInt(hex.slice(1, 3), 16);
      data[i + 1] = parseInt(hex.slice(3, 5), 16);
      data[i + 2] = parseInt(hex.slice(5, 7), 16);
      data[i + 3] = 255;
    }
  }
  return data;
}
