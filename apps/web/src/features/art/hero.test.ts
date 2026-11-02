import { describe, expect, it } from 'vitest';
import { validateGrid } from './grid';
import { ARMOR_SLUGS, HERO_CLASSES, HERO_SIZE, HERO_STATES, WEAPON_SLUGS, heroGrid } from './sprites/hero';

const same = (a: { rows: readonly string[] }, b: { rows: readonly string[] }) => a.rows.join('') === b.rows.join('');

describe('heroes', () => {
  it.each(HERO_CLASSES.flatMap((c) => HERO_STATES.map((s) => [c, s] as const)))('%s %s is a valid %ix%i grid', (c, s) => {
    const g = heroGrid(c, s);
    expect(g.w).toBe(HERO_SIZE);
    expect(g.h).toBe(HERO_SIZE);
    expect(validateGrid(g)).toEqual([]);
  });

  it('every pose differs from idle', () => {
    for (const c of HERO_CLASSES) for (const s of HERO_STATES.filter((x) => x !== 'idle')) expect(same(heroGrid(c, s), heroGrid(c, 'idle'))).toBe(false);
  });

  it('the three classes are visibly different', () => {
    expect(same(heroGrid('warrior', 'idle'), heroGrid('tank', 'idle'))).toBe(false);
    expect(same(heroGrid('tank', 'idle'), heroGrid('scholar', 'idle'))).toBe(false);
    expect(same(heroGrid('warrior', 'idle'), heroGrid('scholar', 'idle'))).toBe(false);
  });

  it('every weapon and every armor changes the picture, and all are distinct', () => {
    const base = heroGrid('warrior', 'idle', { weapon: 'iron-sword', armor: 'leather-armor' });
    const weapons = WEAPON_SLUGS.map((w) => heroGrid('warrior', 'idle', { weapon: w }).rows.join(''));
    const armors = ARMOR_SLUGS.map((a) => heroGrid('warrior', 'idle', { armor: a }).rows.join(''));
    expect(new Set(weapons).size).toBe(WEAPON_SLUGS.length);
    expect(new Set(armors).size).toBe(ARMOR_SLUGS.length);
    expect(weapons.filter((w) => w === base.rows.join('')).length).toBe(1);
  });

  it('flash changes the frame', () => {
    expect(same(heroGrid('tank', 'hit', { flash: true }), heroGrid('tank', 'hit'))).toBe(false);
  });
});
