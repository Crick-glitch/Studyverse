import { bands, bigCog, column, arch, bakeScene, floorPlanks, newScene, rng, shelf, FLOOR_Y, SCENE_H, SCENE_W } from './scene-kit';
import type { PixelGrid } from '../grid';
import type { MaterialKey } from '../palette';
import type { SceneLayers } from './scene-kit';

const BOOKS: readonly MaterialKey[] = ['fEmber7', 'fTeal7', 'fGold7', 'fViolet7', 'fMoss7', 'fEmber5', 'fTeal5'];

/** Tier 1: a candle-lit archive of towering shelves under dim arches. */
function archive(): SceneLayers {
  const s = newScene();
  const r = rng(11);
  s.far.rect(0, 0, SCENE_W, SCENE_H, 'fForest');
  bands(s.far, 0, FLOOR_Y, ['fForest', 'fForest', 'fForest7'], 0, SCENE_W);
  for (const x of [38, 118, 202, 284]) {
    arch(s.far, x, 120, 40, 86, 'fForest5');
    arch(s.far, x, 120, 30, 76, 'fTeal7');
    s.far.rect(x - 1, 50, 2, 70, 'fForest5');
    s.far.rect(x - 15, 82, 30, 2, 'fForest5');
  }
  for (const [x, y] of [[70, 40], [158, 30], [244, 44], [20, 66], [300, 70]] as const) {
    s.far.rect(x, y, 1, 3, 'fGold7'); s.far.px(x, y - 1, 'fGold');
  }
  // far shelves along the wall
  shelf(s.far, 78, 70, 36, 58, r, ['fForest5', 'fTeal7', 'fViolet7'], 'fForest5', 'fForest', 12);
  shelf(s.far, 206, 70, 36, 58, r, ['fForest5', 'fTeal7', 'fViolet7'], 'fForest5', 'fForest', 12);
  // mid: tall side shelves, columns, wooden floor and rug
  shelf(s.mid, 0, 6, 62, 122, r, BOOKS, 'fWood5', 'fForest', 14);
  shelf(s.mid, 258, 6, 62, 122, r, BOOKS, 'fWood5', 'fForest', 14);
  column(s.mid, 66, 0, FLOOR_Y, 8, 'fWood7', 'fWood5');
  column(s.mid, 246, 0, FLOOR_Y, 8, 'fWood7', 'fWood5');
  floorPlanks(s.mid, FLOOR_Y, 'fWood7', 'fForest');
  s.mid.rect(40, 138, 240, 36, 'fEmber7');
  s.mid.rect(44, 142, 232, 28, 'fEmber5');
  s.mid.rect(48, 146, 224, 20, 'fEmber7');
  for (let x = 52; x < 268; x += 12) s.mid.rect(x, 154, 6, 4, 'fGold7');
  // near: dark corners, book piles, cobweb lines
  s.near.poly([[0, 0], [60, 0], [0, 56]], 'fForest');
  s.near.poly([[SCENE_W, 0], [SCENE_W - 60, 0], [SCENE_W, 56]], 'fForest');
  s.near.rect(0, 0, SCENE_W, 6, 'fForest');
  for (const [x, y, w] of [[0, 160, 46], [8, 150, 34], [14, 141, 22], [SCENE_W - 52, 158, 52], [SCENE_W - 40, 148, 34]] as const) {
    let bx = x;
    while (bx < x + w - 4) {
      const m = BOOKS[Math.floor(r() * BOOKS.length)] as MaterialKey;
      const bw = 8 + Math.floor(r() * 6);
      s.near.rect(bx, y, Math.min(bw, x + w - bx), 9, m);
      s.near.rect(bx, y + 7, Math.min(bw, x + w - bx), 2, 'fParch3');
      bx += bw;
    }
  }
  s.near.rect(0, SCENE_H - 8, 56, 8, 'fForest');
  s.near.rect(SCENE_W - 56, SCENE_H - 8, 56, 8, 'fForest');
  return s;
}

/** Tier 2: a flooded library, shelves rising from teal water, books drifting in the air. */
function library(): SceneLayers {
  const s = newScene();
  const r = rng(23);
  bands(s.far, 0, FLOOR_Y, ['fTeal7', 'fTeal7', 'fForest7', 'fForest7', 'fTeal7'], 0, SCENE_W);
  s.far.rect(0, 0, SCENE_W, SCENE_H, 'fTeal7');
  bands(s.far, 0, FLOOR_Y + 8, ['fForest7', 'fTeal7', 'fTeal7', 'fTeal5'], 0, SCENE_W);
  for (const x of [50, 130, 200, 270]) s.far.poly([[x, 0], [x + 14, 0], [x + 52, FLOOR_Y], [x + 28, FLOOR_Y]], 'fTeal5');
  for (const x of [30, 120, 210, 290]) { arch(s.far, x, 124, 44, 90, 'fForest7'); arch(s.far, x, 124, 34, 80, 'fTeal5'); }
  shelf(s.mid, 0, 14, 56, 114, r, BOOKS, 'fWood7', 'fForest7', 14);
  shelf(s.mid, 264, 14, 56, 114, r, BOOKS, 'fWood7', 'fForest7', 14);
  // floating books
  for (const [x, y] of [[90, 40], [112, 60], [214, 34], [236, 62], [160, 22], [72, 84], [250, 92]] as const) {
    s.mid.rect(x, y, 9, 7, BOOKS[Math.floor(r() * BOOKS.length)] as MaterialKey);
    s.mid.rect(x + 1, y + 5, 7, 2, 'fParch3');
    s.mid.rect(x - 3, y - 2, 4, 1, 'fParch'); s.mid.rect(x + 8, y - 3, 4, 1, 'fParch');
  }
  // water: the floor is a shallow flood
  s.mid.rect(0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y, 'fTeal5');
  bands(s.mid, FLOOR_Y, SCENE_H, ['fTeal5', 'fTeal5', 'fTeal7', 'fTeal7', 'fForest7']);
  s.mid.rect(0, FLOOR_Y, SCENE_W, 2, 'fTeal');
  for (let y = FLOOR_Y + 8; y < SCENE_H; y += 10) for (let x = (y % 20) * 3; x < SCENE_W; x += 54) s.mid.rect(x, y, 14 + (x % 3) * 4, 1, 'fTeal');
  // near: vines and ripples
  for (const x of [8, 22, 40, 280, 298, 312]) {
    const len = 24 + Math.floor(r() * 36);
    s.near.rect(x, 0, 2, len, 'fMoss7');
    for (let y = 6; y < len; y += 8) s.near.rect(x + (y % 16 ? 2 : -3), y, 3, 3, 'fMoss5');
  }
  s.near.rect(0, 0, SCENE_W, 4, 'fForest7');
  for (const [x, w] of [[0, 62], [SCENE_W - 70, 70]] as const) {
    s.near.ellipse(x + w / 2, SCENE_H - 3, w / 2, 14, 'fForest7');
    s.near.ellipse(x + w / 2, SCENE_H - 3, w / 2 - 4, 10, 'fMoss7');
  }
  for (const [cx, cy, rx] of [[120, 166, 22], [210, 172, 30]] as const) { s.near.ellipse(cx, cy, rx, 3, 'fTeal'); s.near.ellipse(cx, cy, rx - 2, 2, null); }
  return s;
}

/** Tier 3: a clockwork foundry: huge gears against a furnace glow, iron grating underfoot. */
function foundry(): SceneLayers {
  const s = newScene();
  const r = rng(37);
  s.far.rect(0, 0, SCENE_W, SCENE_H, 'fCoal8');
  bands(s.far, 56, FLOOR_Y + 4, ['fCoal8', 'fEmber7', 'fEmber7', 'fEmber5', 'fEmber5']);
  bigCog(s.far, 60, 62, 44, 12, 'fCoal6', 'fCoal8');
  bigCog(s.far, 150, 22, 28, 10, 'fCoal6', 'fCoal8');
  bigCog(s.far, 262, 66, 50, 14, 'fCoal6', 'fCoal8');
  bigCog(s.far, 206, 118, 22, 8, 'fCoal6', 'fEmber7');
  // mid: pipes, pillars and furnaces at the sides, grating floor
  for (const x of [0, 262]) {
    s.mid.rect(x, 0, 58, FLOOR_Y, 'fCoal8');
    s.mid.rect(x + 4, 6, 50, FLOOR_Y - 8, 'fCoal6');
    for (let y = 14; y < FLOOR_Y - 8; y += 22) { s.mid.rect(x + 4, y, 50, 6, 'fCoal8'); for (const px of [8, 24, 40]) s.mid.px(x + px, y + 2, 'fGold5'); }
    s.mid.rect(x + 14, 30, 30, 34, 'ink');
    s.mid.rect(x + 17, 34, 24, 26, 'fEmber7'); s.mid.rect(x + 20, 40, 18, 16, 'fEmber5'); s.mid.rect(x + 24, 46, 10, 8, 'fEmber');
  }
  for (const x of [66, 246]) { s.mid.rect(x, 0, 8, FLOOR_Y, 'coal'); s.mid.rect(x - 2, 0, 12, 4, 'iron'); s.mid.rect(x - 2, FLOOR_Y - 4, 12, 4, 'iron'); }
  s.mid.rect(66, 28, 188, 8, 'iron'); s.mid.rect(66, 30, 188, 2, 'fCoal6');
  s.mid.rect(0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y, 'fCoal8');
  s.mid.rect(0, FLOOR_Y, SCENE_W, 2, 'fCoal6');
  for (let y = FLOOR_Y + 10; y < SCENE_H; y += 10) s.mid.rect(0, y, SCENE_W, 1, 'fCoal6');
  for (let x = 6; x < SCENE_W; x += 20) { s.mid.rect(x, FLOOR_Y + 2, 1, SCENE_H - FLOOR_Y, 'fCoal6'); if ((x / 20) % 3 === 0) s.mid.rect(x + 1, FLOOR_Y + 12, 18, 3, 'fEmber7'); }
  // near: hanging chains, corner cogs, sparks
  for (const x of [12, 30, 292, 306]) for (let y = 0; y < 40 + (x % 3) * 14; y += 6) s.near.rect(x, y, 3, 5, 'fCoal6');
  bigCog(s.near, 8, SCENE_H - 2, 26, 10, 'ink', 'fCoal8');
  bigCog(s.near, SCENE_W - 6, SCENE_H, 30, 10, 'ink', 'fCoal8');
  s.near.rect(0, 0, SCENE_W, 5, 'ink');
  for (let i = 0; i < 26; i++) s.near.px(Math.floor(r() * SCENE_W), 60 + Math.floor(r() * 110), r() < 0.5 ? 'fEmber' : 'fGold');
  return s;
}

export const DUNGEON_SCENES = { archive, library, foundry } as const;
export type DungeonSceneId = keyof typeof DUNGEON_SCENES;

const cache = new Map<string, Record<'far' | 'mid' | 'near', PixelGrid>>();
export function dungeonScene(id: DungeonSceneId): Record<'far' | 'mid' | 'near', PixelGrid> {
  const hit = cache.get(id);
  if (hit) return hit;
  const baked = bakeScene(DUNGEON_SCENES[id]());
  cache.set(id, baked);
  return baked;
}
