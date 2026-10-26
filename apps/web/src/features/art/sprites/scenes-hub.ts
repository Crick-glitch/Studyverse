import { Canvas } from '../draw/canvas';
import type { PixelGrid } from '../grid';
import { arch, bakeScene, bands, newScene, pine, rng, SCENE_H, SCENE_W, type SceneLayers } from './scene-kit';

/** The camp at dusk: tents, a book wagon, a campfire, the dungeon gate on a far hill. */
function camp(): SceneLayers {
  const s = newScene();
  const r = rng(51);
  bands(s.far, 0, 112, ['fViolet7', 'fViolet7', 'violet', 'violet', 'fEmber5', 'fEmber', 'fGold']);
  for (let i = 0; i < 34; i++) s.far.px(Math.floor(r() * SCENE_W), Math.floor(r() * 48), 'fParch');
  s.far.disc(236, 104, 17, 'fGold');
  s.far.disc(236, 104, 12, 'fParch');
  // distant hills and the dungeon gate
  for (let x = 0; x < SCENE_W; x++) {
    const h1 = 100 + Math.round(Math.sin(x / 31) * 6 + Math.sin(x / 13) * 2);
    s.far.rect(x, h1, 1, SCENE_H - h1, 'fForest5');
    const h2 = 112 + Math.round(Math.sin(x / 23 + 2) * 5);
    s.far.rect(x, h2, 1, SCENE_H - h2, 'fForest7');
  }
  s.far.rect(268, 66, 30, 40, 'fForest7');
  arch(s.far, 283, 106, 16, 24, 'fForest');
  s.far.rect(266, 62, 4, 6, 'fForest7'); s.far.rect(280, 58, 4, 10, 'fForest7'); s.far.rect(294, 62, 4, 6, 'fForest7');
  // mid: meadow, pines, tents, wagon, campfire
  s.mid.rect(0, 122, SCENE_W, SCENE_H - 122, 'fMoss7');
  bands(s.mid, 122, SCENE_H, ['fMoss7', 'fMoss7', 'fMoss5', 'fMoss7', 'fForest7']);
  s.mid.rect(0, 122, SCENE_W, 2, 'fMoss5');
  for (const [x, h] of [[12, 80], [38, 96], [286, 90], [308, 74], [150, 54], [180, 48]] as const) pine(s.mid, x, 124, h, 'fForest7');
  s.mid.poly([[44, 94], [84, 140], [4, 140]], 'parch');
  s.mid.poly([[44, 94], [84, 140], [64, 140]], 'fParch3');
  s.mid.poly([[44, 112], [54, 140], [34, 140]], 'fForest');
  s.mid.rect(43, 86, 2, 10, 'fWood5'); s.mid.rect(45, 86, 9, 5, 'ember');
  // wagon with a bookshelf
  s.mid.rect(236, 106, 54, 28, 'wood');
  s.mid.rect(239, 109, 48, 22, 'fForest');
  for (let x = 240; x < 284; x += 4) s.mid.rect(x, 110 + (x % 3), 3, 9 - (x % 3), (['fEmber7', 'fTeal7', 'fGold7', 'fViolet7'] as const)[(x / 4) % 4] ?? 'fEmber7');
  s.mid.rect(239, 120, 48, 2, 'fWood5');
  s.mid.disc(246, 138, 9, 'fWood7'); s.mid.disc(246, 138, 4, 'fWood5');
  s.mid.disc(282, 138, 9, 'fWood7'); s.mid.disc(282, 138, 4, 'fWood5');
  s.mid.poly([[290, 114], [310, 122], [290, 124]], 'fWood5');
  // quest board
  s.mid.rect(106, 100, 3, 38, 'fWood7'); s.mid.rect(142, 100, 3, 38, 'fWood7');
  s.mid.rect(102, 94, 46, 28, 'wood');
  s.mid.rect(105, 97, 40, 22, 'fWood5');
  for (const [x, y] of [[108, 100], [122, 102], [134, 99], [112, 110], [128, 111]] as const) { s.mid.rect(x, y, 9, 8, 'fParch'); s.mid.rect(x + 1, y + 2, 7, 1, 'fParch5'); s.mid.px(x + 4, y, 'fEmber5'); }
  // campfire
  s.mid.rect(188, 138, 22, 4, 'fWood7');
  s.mid.poly([[199, 118], [207, 138], [191, 138]], 'fEmber5');
  s.mid.poly([[199, 124], [204, 138], [194, 138]], 'fGold');
  s.mid.poly([[199, 130], [201, 138], [197, 138]], 'fParch');
  // near: foreground grass and a fence
  for (let x = 0; x < SCENE_W; x += 5) {
    const h = 5 + Math.floor(r() * 9);
    s.near.rect(x, SCENE_H - h, 2, h, r() < 0.5 ? 'fMoss5' : 'fMoss7');
  }
  s.near.rect(0, SCENE_H - 6, SCENE_W, 6, 'fForest7');
  for (const x of [4, 40, 276, 312]) { s.near.rect(x, 146, 4, 34, 'fWood7'); s.near.rect(x, 146, 4, 2, 'fWood5'); }
  s.near.rect(0, 156, 44, 3, 'fWood7'); s.near.rect(276, 156, 44, 3, 'fWood7');
  return s;
}

const road = (c: Canvas, pts: readonly [number, number][], m: 'fWood5' | 'fParch5'): void => {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i] as [number, number];
    const [x1, y1] = pts[i + 1] as [number, number];
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
    for (let k = 0; k < n; k += 1) {
      const t = k / n;
      if (k % 2 === 0) c.rect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 4, 3, m);
    }
  }
};

/** Top-down parchment map of the three dungeons, with the camp as the starting point. */
function map(): SceneLayers {
  const s = newScene();
  const r = rng(77);
  s.far.rect(0, 0, SCENE_W, SCENE_H, 'fParch');
  for (let i = 0; i < 40; i++) s.far.rect(Math.floor(r() * SCENE_W), Math.floor(r() * SCENE_H), 6 + Math.floor(r() * 10), 1, 'fParch3');
  s.far.rect(0, 0, SCENE_W, 10, 'fParch3'); s.far.rect(0, SCENE_H - 10, SCENE_W, 10, 'fParch3');
  s.far.rect(0, 0, 10, SCENE_H, 'fParch3'); s.far.rect(SCENE_W - 10, 0, 10, SCENE_H, 'fParch3');
  // terrain
  s.mid.ellipse(60, 40, 38, 20, 'fMoss'); s.mid.ellipse(60, 42, 34, 16, 'fMoss5');
  for (let i = 0; i < 16; i++) { const x = 34 + Math.floor(r() * 52); const y = 32 + Math.floor(r() * 20); s.mid.poly([[x, y - 5], [x + 3, y + 1], [x - 3, y + 1]], 'fForest5'); }
  s.mid.ellipse(206, 132, 46, 22, 'fTeal'); s.mid.ellipse(206, 132, 40, 18, 'fTeal5');
  for (let x = 150; x < 262; x += 14) s.mid.rect(x, 130 + (x % 3) * 3, 8, 1, 'fTeal');
  for (const [x, y, w] of [[250, 70, 56], [20, 118, 50], [120, 20, 44]] as const) { s.mid.poly([[x, y + 22], [x + w / 2, y], [x + w, y + 22]], 'fParch5'); s.mid.poly([[x + w / 2, y], [x + w, y + 22], [x + w / 2 + 6, y + 22]], 'fParch3'); }
  // near: roads, locations, frame
  road(s.near, [[46, 150], [80, 120], [110, 86], [132, 58]], 'fWood5');
  road(s.near, [[46, 150], [100, 156], [160, 150], [206, 132]], 'fWood5');
  road(s.near, [[206, 132], [240, 100], [270, 70], [276, 52]], 'fWood5');
  // camp tent
  s.near.poly([[46, 134], [62, 158], [30, 158]], 'parch'); s.near.poly([[46, 146], [51, 158], [41, 158]], 'fForest');
  // archive: columned hall with a book
  s.near.rect(104, 62, 54, 26, 'wood'); s.near.poly([[100, 62], [131, 44], [162, 62]], 'fWood7');
  for (const x of [108, 120, 142, 150]) s.near.rect(x, 64, 3, 24, 'fParch');
  s.near.rect(126, 70, 10, 16, 'fForest'); s.near.rect(124, 54, 14, 7, 'ember'); s.near.rect(125, 58, 12, 2, 'fParch');
  // sunken library: columns standing in the water
  for (const x of [186, 200, 214, 228]) { s.near.rect(x, 108, 5, 24, 'fParch3'); s.near.rect(x - 1, 106, 7, 3, 'fParch'); }
  s.near.poly([[184, 106], [207, 92], [232, 106]], 'fParch5');
  // foundry: chimneys and a gear
  s.near.rect(256, 38, 40, 22, 'coal'); s.near.rect(260, 24, 7, 16, 'iron'); s.near.rect(282, 20, 7, 20, 'iron');
  s.near.disc(264, 18, 4, 'fCoal6'); s.near.disc(286, 12, 5, 'fCoal6');
  s.near.rect(264, 46, 24, 14, 'fEmber5');
  // compass rose and frame
  const cx = 290, cy = 150;
  s.near.poly([[cx, cy - 18], [cx + 4, cy], [cx, cy + 18], [cx - 4, cy]], 'fWood7');
  s.near.poly([[cx - 18, cy], [cx, cy - 4], [cx + 18, cy], [cx, cy + 4]], 'fWood5');
  s.near.disc(cx, cy, 3, 'fGold5');
  s.near.rect(0, 0, SCENE_W, 4, 'fWood7'); s.near.rect(0, SCENE_H - 4, SCENE_W, 4, 'fWood7');
  s.near.rect(0, 0, 4, SCENE_H, 'fWood7'); s.near.rect(SCENE_W - 4, 0, 4, SCENE_H, 'fWood7');
  return s;
}

export const HUB_SCENES = { camp, map } as const;
export type HubSceneId = keyof typeof HUB_SCENES;
const cache = new Map<string, Record<'far' | 'mid' | 'near', PixelGrid>>();
export function hubScene(id: HubSceneId): Record<'far' | 'mid' | 'near', PixelGrid> {
  const hit = cache.get(id);
  if (hit) return hit;
  const baked = bakeScene(HUB_SCENES[id]());
  cache.set(id, baked);
  return baked;
}
