/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COLOR_KEYS, PALETTE } from './palette';
import { WEB_SRC } from './test-paths';

const css = readFileSync(join(WEB_SRC, 'styles', 'tokens.css'), 'utf8');
const tokens = new Map([...css.matchAll(/--([a-z]+-\d+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1] as string, (m[2] as string).toLowerCase()]));

describe('palette', () => {
  it('stays within the 16-32 colour budget with no duplicate colours', () => {
    expect(COLOR_KEYS.length).toBeGreaterThanOrEqual(16);
    expect(COLOR_KEYS.length).toBeLessThanOrEqual(32);
    expect(new Set(Object.values(PALETTE)).size).toBe(COLOR_KEYS.length);
  });

  it('matches styles/tokens.css: every palette colour is a CSS variable with the same hex', () => {
    expect(tokens.size).toBeGreaterThan(0);
    const mismatched = COLOR_KEYS.filter((k) => tokens.get(k) !== PALETTE[k].toLowerCase());
    expect(mismatched).toEqual([]);
  });

  it('has no CSS colour variable the palette does not know about', () => {
    const extra = [...tokens.keys()].filter((k) => !(k in PALETTE));
    expect(extra).toEqual([]);
  });
});
