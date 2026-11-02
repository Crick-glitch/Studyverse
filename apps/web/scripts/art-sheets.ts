/**
 * Renders contact sheets of the pixel art to PNG so it can be reviewed without a browser.
 *   npm run art:sheets -w apps/web            (writes to docs/art-sheets/)
 *   npm run art:sheets -w apps/web -- /tmp/x  (writes elsewhere)
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { overlay, type PixelGrid } from '../src/features/art/grid';
import { getAsset, isGridEntry, isSceneEntry, MANIFEST, type AssetEntry } from '../src/features/art/manifest';
import { writeSheet, type SheetItem } from './png';
import { ARMOR_SLUGS, HERO_CLASSES, HERO_FRAMES, HERO_STATES, WEAPON_SLUGS, heroGrid } from '../src/features/art/sprites/hero';
import { REGULAR_ENEMIES, BOSS_ENEMIES, ENEMY_FRAMES, enemyGrid, enemyStates } from '../src/features/art/sprites/enemies';
import { ITEM_RARITY, type ItemSlug } from '../src/features/art/sprites/items';
import { EFFECT_IDS, effectFrames } from '../src/features/art/sprites/effects';

const out = resolve(process.argv[2] ?? join(process.cwd(), '..', '..', 'docs', 'art-sheets'));
mkdirSync(out, { recursive: true });
const BG: [number, number, number] = [40, 60, 52];
const items = (grids: PixelGrid[]): SheetItem[] => grids.map((grid) => ({ grid, bg: BG }));
const grid = (key: string, state = 'idle', o = {}): PixelGrid => {
  const e = getAsset(key) as AssetEntry;
  if (!isGridEntry(e)) throw new Error(`${key} is not a grid asset`);
  return e.grid(state, o);
};
const place = (g: PixelGrid, w: number, h: number, x: number, y: number): PixelGrid => ({
  w,
  h,
  rows: Array.from({ length: h }, (_, yy) =>
    Array.from({ length: w }, (_, xx) => g.rows[yy - y]?.[xx - x] ?? '.').join(''),
  ),
});
const empty = (w: number, h: number): PixelGrid => ({ w, h, rows: Array.from({ length: h }, () => '.'.repeat(w)) });
const written: string[] = [];
const sheet = (name: string, list: SheetItem[], scale: number, cols: number) => {
  writeSheet(join(out, `${name}.png`), list, scale, cols);
  written.push(name);
};

// every frame: idle 1-2, attack wind-up / impact / recovery, then hit, defeat, victory
const heroFrames = (c: (typeof HERO_CLASSES)[number]) => HERO_STATES.flatMap((s) => Array.from({ length: HERO_FRAMES[s] }, (_, f) => heroGrid(c, s, { frame: f })));
sheet('heroes', items(HERO_CLASSES.flatMap(heroFrames)), 3, 8);
sheet('hero-gear', items([...WEAPON_SLUGS.map((w) => heroGrid('warrior', 'idle', { weapon: w })), ...ARMOR_SLUGS.map((a) => heroGrid('warrior', 'idle', { armor: a }))]), 2, 6);
const enemyFrames = (slug: string) => enemyStates(slug).flatMap((s) => Array.from({ length: ENEMY_FRAMES[s] }, (_, f) => enemyGrid(slug, s, { frame: f })));
sheet('enemies', items(REGULAR_ENEMIES.flatMap((e) => enemyFrames(e.slug))), 3, 7);
sheet('bosses', items(BOSS_ENEMIES.flatMap((e) => enemyFrames(e.slug))), 2, 9);
sheet('items', items(Object.keys(MANIFEST).filter((k) => /^(weapon|armor)\./.test(k)).map((k) => {
  const slug = k.split('.').slice(1).join('.') as ItemSlug;
  return overlay([grid(`frame.${ITEM_RARITY[slug]}`), place(grid(k), 36, 36, 2, 2)]);
})), 3, 6);
sheet('effects', EFFECT_IDS.flatMap((id) => { const f = effectFrames(id); while (f.length < 6) f.push(empty(32, 32)); return f.map((g) => ({ grid: g, bg: [30, 34, 38] as [number, number, number] })); }), 3, 6);
sheet('avatars', items(Object.keys(MANIFEST).filter((k) => /^(avatar|portrait)\./.test(k)).map((k) => grid(k))), 4, 9);
sheet('ui', items(Object.keys(MANIFEST).filter((k) => k.startsWith('ui.')).map((k) => grid(k))), 4, 8);

const scenes = Object.values(MANIFEST).filter(isSceneEntry);
const flat = (e: (typeof scenes)[number]): PixelGrid => { const l = e.layers(); return overlay([l.far, l.mid, l.near]); };
sheet('scenes', scenes.map((e) => ({ grid: flat(e) })), 2, 2);
sheet('stages', ['dungeon.archive', 'dungeon.library', 'dungeon.foundry'].map((k, i) => {
  const e = getAsset(k);
  if (!e || !isSceneEntry(e)) throw new Error(k);
  const l = e.layers();
  const foe = [enemyGrid('goblin-chieftain', 'idle'), enemyGrid('inkwraith', 'idle'), enemyGrid('gearwork-golem', 'idle')][i] as PixelGrid;
  return { grid: overlay([l.far, l.mid, place(heroGrid('warrior', 'idle'), 320, 180, 50, 76), place(foe, 320, 180, 220, 86), l.near]) };
}), 2, 2);

console.log(`Wrote ${written.length} sheets to ${out}: ${written.join(', ')}`);
