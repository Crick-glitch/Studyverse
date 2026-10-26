import { describe, expect, it } from 'vitest';
import { colorsUsed, validateGrid, type PixelGrid } from './grid';
import { PALETTE } from './palette';
import {
  entryStates, getAsset, isGridEntry, isSceneEntry, manifestKeys, MANIFEST, type AssetEntry, type Manifest,
} from './manifest';
import { SCENE_LAYERS } from './sprites/scene-kit';

const entries = Object.values(MANIFEST);
const countGroup = (g: string) => entries.filter((e) => e.group === g).length;

const gridsOf = (e: AssetEntry): PixelGrid[] => {
  if (isSceneEntry(e)) return SCENE_LAYERS.map((l) => e.layers()[l]);
  if (isGridEntry(e)) return e.states.map((s) => e.grid(s, {}));
  if (e.kind === 'sheet') return Array.from({ length: e.frames }, (_, i) => e.frame(i));
  return [];
};

describe('asset manifest', () => {
  it('has an entry for every asset group the design asks for', () => {
    expect(countGroup('hero')).toBe(3);
    expect(countGroup('monster')).toBe(12);
    expect(entries.filter((e) => e.key.startsWith('weapon.'))).toHaveLength(6);
    expect(entries.filter((e) => e.key.startsWith('armor.'))).toHaveLength(6);
    expect(entries.filter((e) => e.key.startsWith('frame.'))).toHaveLength(3);
    expect(countGroup('avatar')).toBe(6 + 3);
    expect(entries.filter((e) => e.key.startsWith('dungeon.'))).toHaveLength(3);
    expect(entries.filter((e) => e.key.startsWith('scene.'))).toHaveLength(2);
    expect(countGroup('effect')).toBe(8);
    expect(entries.filter((e) => e.key.startsWith('ui.nav.'))).toHaveLength(9);
    expect(entries.filter((e) => e.key.startsWith('ui.flame.'))).toHaveLength(5);
    expect(getAsset('ui.crest')).toBeDefined();
  });

  it('keys match their record key and are unique, lower-case and dotted', () => {
    for (const [k, e] of Object.entries(MANIFEST)) {
      expect(e.key).toBe(k);
      expect(k).toMatch(/^[a-z]+(\.[a-z0-9-]+)+$/);
    }
    expect(new Set(manifestKeys()).size).toBe(entries.length);
  });

  it('gives every entry a licence and a source', () => {
    const bad = entries.filter((e) => !e.license.trim() || !e.source.trim()).map((e) => e.key);
    expect(bad).toEqual([]);
  });

  it('never points at an external URL', () => {
    const urlLike = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
    for (const e of entries) if ('src' in e) expect([e.key, urlLike.test(e.src)]).toEqual([e.key, false]);
  });

  it('uses whole-number default scales', () => {
    for (const e of entries) expect([e.key, Number.isInteger(e.scale) && e.scale >= 1]).toEqual([e.key, true]);
  });

  it('every grid of every entry is valid, uses only palette colours and matches the declared size', () => {
    for (const e of entries) {
      const grids = gridsOf(e);
      expect(grids.length).toBeGreaterThan(0);
      for (const g of grids) {
        expect([e.key, validateGrid(g)]).toEqual([e.key, []]);
        expect([e.key, g.w, g.h]).toEqual([e.key, e.size.w, e.size.h]);
        for (const c of colorsUsed(g)) expect(c in PALETTE).toBe(true);
      }
    }
  });

  it('lists a first state for every grid entry and never an empty frame', () => {
    for (const e of entries) {
      expect(entryStates(e).length).toBeGreaterThan(0);
      for (const g of gridsOf(e)) expect(g.rows.join('').replace(/\./g, '').length).toBeGreaterThan(0);
    }
  });

  it('keeps vendored third-party art out: the baseline is entirely original and recorded as such', () => {
    const nonOriginal = entries.filter((e) => !e.license.startsWith('original'));
    expect(nonOriginal.map((e) => e.key)).toEqual([]);
  });

  it('accepts a custom manifest (used to swap art) and reports missing keys', () => {
    const custom: Manifest = { 'x.y': { ...(MANIFEST['ui.crest'] as AssetEntry), key: 'x.y' } };
    expect(getAsset('x.y', custom)).toBeDefined();
    expect(getAsset('x.y')).toBeUndefined();
  });
});
