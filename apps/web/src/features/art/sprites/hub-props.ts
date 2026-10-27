import { Canvas } from '../draw/canvas';
import type { PixelGrid } from '../grid';
import { arch, SCENE_H, SCENE_W } from './scene-kit';

/**
 * The Home hub's objects (05c section 7). Each prop is drawn in SCENE coordinates (so it sits exactly on the camp
 * scene) and then cropped to its own box, which the hub uses to place it. States are real data: the tent glows while
 * a session runs, the wagon lantern lights when cards are due, and so on. Never emoji, never hover-only.
 */
export const HUB_PROP_IDS = ['gate', 'study-tent', 'hero-tent', 'quest-board', 'journal-desk', 'campfire', 'library-wagon'] as const;
export type HubPropId = (typeof HUB_PROP_IDS)[number];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface HubPropMeta {
  /** Where the sprite sits in the 320 x 180 scene (it is the crop box). */
  box: Box;
  /** The clickable area, inside the box. `null`: not a link (the campfire). */
  hit: Box | null;
  /** `far` props go behind the trees (mid layer); the rest stand in front of the meadow. */
  layer: 'far' | 'mid';
  states: readonly string[];
}

export const HUB_PROPS: Readonly<Record<HubPropId, HubPropMeta>> = {
  // `locked` is drawn for session 06 (unlock rules); the hub shows `open` or `ready` until then.
  gate: { box: { x: 262, y: 52, w: 40, h: 58 }, hit: { x: 264, y: 56, w: 36, h: 52 }, layer: 'far', states: ['open', 'ready', 'locked'] },
  'study-tent': { box: { x: 0, y: 70, w: 62, h: 72 }, hit: { x: 2, y: 86, w: 56, h: 54 }, layer: 'mid', states: ['idle', 'active'] },
  'hero-tent': { box: { x: 60, y: 84, w: 44, h: 58 }, hit: { x: 62, y: 100, w: 38, h: 40 }, layer: 'mid', states: ['idle', 'attention'] },
  'quest-board': { box: { x: 100, y: 82, w: 52, h: 60 }, hit: { x: 102, y: 92, w: 48, h: 48 }, layer: 'mid', states: ['idle', 'flags'] },
  'journal-desk': { box: { x: 150, y: 112, w: 38, h: 30 }, hit: { x: 152, y: 118, w: 34, h: 24 }, layer: 'mid', states: ['idle'] },
  campfire: { box: { x: 184, y: 100, w: 30, h: 44 }, hit: null, layer: 'mid', states: ['l0', 'l1', 'l2', 'l3', 'l4'] },
  'library-wagon': { box: { x: 224, y: 92, w: 90, h: 56 }, hit: { x: 230, y: 100, w: 84, h: 46 }, layer: 'mid', states: ['idle', 'due'] },
};

function gate(c: Canvas, state: string): void {
  c.rect(268, 66, 30, 40, 'fForest7');
  c.rect(266, 62, 4, 6, 'fForest7'); c.rect(280, 58, 4, 10, 'fForest7'); c.rect(294, 62, 4, 6, 'fForest7');
  if (state === 'ready') {
    arch(c, 283, 106, 16, 24, 'fTeal7');
    arch(c, 283, 106, 10, 18, 'fTeal5');
    c.rect(282, 70, 3, 3, 'fGold'); // a key-light above the arch: you have the energy to go in
  } else if (state === 'locked') {
    arch(c, 283, 106, 16, 24, 'fWood7');
    for (let x = 277; x <= 289; x += 4) c.rect(x, 90, 2, 16, 'fForest7');
    c.rect(281, 98, 5, 4, 'fGold'); // padlock
  } else {
    arch(c, 283, 106, 16, 24, 'fForest');
  }
}

function tent(c: Canvas, cx: number, baseY: number, w: number, apexY: number, body: 'parch' | 'violet', door: 'fForest' | 'fGold'): void {
  const l = cx - w / 2;
  c.poly([[cx, apexY], [l + w, baseY], [l, baseY]], body);
  c.poly([[cx, apexY], [l + w, baseY], [cx + w / 4, baseY]], body === 'parch' ? 'fParch3' : 'fViolet7');
  c.poly([[cx, apexY + (baseY - apexY) * 0.42], [cx + w / 6, baseY], [cx - w / 6, baseY]], door);
}

function studyTent(c: Canvas, state: string): void {
  const active = state === 'active';
  tent(c, 30, 140, 56, 96, 'parch', active ? 'fGold' : 'fForest');
  c.rect(29, 88, 2, 10, 'fWood5'); c.rect(31, 88, 9, 5, 'ember');
  if (active) {
    c.rect(24, 140, 13, 2, 'fGold'); // light spilling out of the door
    // a sand timer over the tent: the session is running
    c.rect(24, 72, 11, 2, 'fWood5'); c.rect(24, 86, 11, 2, 'fWood5');
    c.poly([[25, 74], [34, 74], [30, 80]], 'fParch'); c.poly([[30, 80], [25, 86], [34, 86]], 'fParch');
    c.poly([[27, 75], [32, 75], [30, 78]], 'fGold'); c.rect(28, 83, 5, 3, 'fGold');
  }
}

function heroTent(c: Canvas, state: string): void {
  tent(c, 82, 140, 38, 106, 'violet', 'fForest');
  c.rect(81, 98, 2, 9, 'fWood5');
  c.rect(83, 98, 7, 4, 'fGold7'); // the academy crest pennant
  if (state === 'attention') {
    // unspent skill points: a second, raised gold pennant (static)
    c.rect(81, 88, 2, 11, 'fWood5'); c.rect(83, 88, 9, 5, 'fGold'); c.rect(85, 89, 2, 3, 'fGold7');
  }
}

function questBoard(c: Canvas, state: string): void {
  c.rect(106, 100, 3, 38, 'fWood7'); c.rect(142, 100, 3, 38, 'fWood7');
  c.rect(102, 94, 46, 28, 'wood');
  c.rect(105, 97, 40, 22, 'fWood5');
  const notes: readonly [number, number][] = [[108, 100], [122, 102], [134, 99], [112, 110], [128, 111]];
  for (const [x, y] of notes) { c.rect(x, y, 9, 8, 'fParch'); c.rect(x + 1, y + 2, 7, 1, 'fParch5'); c.px(x + 4, y, 'fEmber5'); }
  if (state === 'flags') {
    // quests ready to claim: gold pennants on poles over the board
    for (const x of [110, 124, 138]) { c.rect(x, 86, 2, 9, 'fWood7'); c.rect(x + 2, 86, 6, 4, 'fGold'); c.px(x + 2, 89, 'fGold7'); }
  }
}

function journalDesk(c: Canvas): void {
  c.rect(154, 130, 3, 10, 'fWood7'); c.rect(181, 130, 3, 10, 'fWood7');
  c.rect(152, 126, 34, 4, 'wood');
  c.rect(160, 119, 18, 7, 'fParch'); c.rect(168, 119, 2, 7, 'fParch5');
  c.rect(162, 121, 5, 1, 'fParch5'); c.rect(171, 121, 5, 1, 'fParch5'); c.rect(162, 123, 5, 1, 'fParch5'); c.rect(171, 123, 5, 1, 'fParch5');
  c.line(180, 124, 184, 116, 'fEmber5'); // a quill
}

function campfire(c: Canvas, state: string): void {
  const level = Number(state.slice(1));
  c.rect(188, 138, 22, 4, 'fWood7');
  if (level === 0) {
    for (const x of [193, 198, 203]) c.px(x, 137, 'fEmber7'); // cold embers: no streak yet
    return;
  }
  const h = [0, 11, 17, 22, 26][level] ?? 11;
  c.poly([[199, 138 - h], [207, 138], [191, 138]], 'fEmber5');
  c.poly([[199, 138 - Math.round(h * 0.7)], [204, 138], [194, 138]], 'fGold');
  c.poly([[199, 138 - Math.round(h * 0.4)], [201, 138], [197, 138]], 'fParch');
  if (level >= 3) c.poly([[190, 138 - Math.round(h * 0.45)], [194, 138], [187, 138]], 'fEmber5');
  if (level >= 4) for (const [x, y] of [[196, 104], [203, 108], [208, 102]] as const) c.px(x, y, 'fGold');
}

function wagonLantern(c: Canvas, lit: boolean): void {
  c.rect(232, 104, 2, 36, 'fWood7');
  c.rect(229, 98, 8, 8, lit ? 'fGold' : 'fWood7');
  c.rect(231, 100, 4, 4, lit ? 'fParch' : 'fCoal8');
  if (lit) for (const [x, y] of [[227, 96], [238, 96], [227, 107], [238, 107]] as const) c.px(x, y, 'fGold5');
}

function libraryWagon(c: Canvas, state: string): void {
  c.rect(236, 106, 54, 28, 'wood');
  c.rect(239, 109, 48, 22, 'fForest');
  const colors = ['fEmber7', 'fTeal7', 'fGold7', 'fViolet7'] as const;
  for (let x = 240; x < 284; x += 4) c.rect(x, 110 + (x % 3), 3, 9 - (x % 3), colors[(x / 4) % 4] ?? 'fEmber7');
  c.rect(239, 120, 48, 2, 'fWood5');
  c.disc(246, 138, 9, 'fWood7'); c.disc(246, 138, 4, 'fWood5');
  c.disc(282, 138, 9, 'fWood7'); c.disc(282, 138, 4, 'fWood5');
  c.poly([[290, 114], [310, 122], [290, 124]], 'fWood5');
  wagonLantern(c, state === 'due');
}

const DRAW: Record<HubPropId, (c: Canvas, state: string) => void> = {
  gate,
  'study-tent': studyTent,
  'hero-tent': heroTent,
  'quest-board': questBoard,
  'journal-desk': (c) => journalDesk(c),
  campfire,
  'library-wagon': libraryWagon,
};

const cache = new Map<string, PixelGrid>();
/** One prop in one state, cropped to its box (scene colours: flat, no outline). */
export function hubPropGrid(id: HubPropId, state: string): PixelGrid {
  const key = `${id}:${state}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const meta = HUB_PROPS[id];
  const full = new Canvas(SCENE_W, SCENE_H);
  DRAW[id](full, meta.states.includes(state) ? state : (meta.states[0] ?? 'idle'));
  const crop = new Canvas(meta.box.w, meta.box.h).blit(full, -meta.box.x, -meta.box.y);
  const grid = crop.bake({ outline: false, shade: false });
  cache.set(key, grid);
  return grid;
}

/** The gold "go here" marker above a prop (Next best action, session 07): a down arrow, 9 x 7 art pixels. */
export const MARKER_SIZE = { w: 9, h: 7 } as const;
export function markerGrid(): PixelGrid {
  const c = new Canvas(MARKER_SIZE.w, MARKER_SIZE.h);
  c.rect(0, 0, 9, 3, 'gold');
  c.poly([[0, 3], [8, 3], [4, 7]], 'gold');
  c.rect(1, 0, 7, 1, 'fGold5');
  return c.bake({ outline: true, shade: false });
}
