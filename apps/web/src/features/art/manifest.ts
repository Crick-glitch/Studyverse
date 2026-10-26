import type { PixelGrid } from './grid';
import { AVATAR_IDS, AVATAR_SIZE, PORTRAIT_SIZE, avatarGrid, portraitGrid } from './sprites/avatars';
import { EFFECT_FRAME_COUNT, EFFECT_IDS, EFFECT_SIZE, effectFrame, type EffectId } from './sprites/effects';
import { ALL_ENEMIES, ENEMY_FRAMES, enemyGrid, enemyStates, type EnemyState } from './sprites/enemies';
import { ENEMY_TIMING, HERO_TIMING, defaultFrame, type Timing } from './sprites/frames';
import {
  ARMOR_SLUGS,
  HERO_CLASSES,
  HERO_FRAMES,
  HERO_GROUND,
  HERO_SIZE,
  HERO_STATES,
  HERO_X0,
  WEAPON_SLUGS,
  heroGrid,
  type ArmorSlug,
  type HeroClass,
  type HeroState,
  type WeaponSlug,
} from './sprites/hero';
import {
  CREST_SIZE,
  ENERGY_SIZE,
  FLAME_LEVELS,
  ICON_SIZE,
  NAV_ICON_IDS,
  crestGrid,
  energyGrid,
  flameGrid,
  navIconGrid,
} from './sprites/icons';
import {
  FRAME_SIZE,
  ITEM_ICON_SIZE,
  RARITIES,
  itemIconGrid,
  rarityFrameGrid,
  type ItemSlug,
} from './sprites/items';
import { DUNGEON_SCENES, dungeonScene, type DungeonSceneId } from './sprites/scenes';
import { HUB_SCENES, hubScene, type HubSceneId } from './sprites/scenes-hub';
import { SCENE_H, SCENE_W, type SceneLayer } from './sprites/scene-kit';

export const PROCEDURAL_LICENSE = 'original, created for this project';

export type AssetGroup = 'hero' | 'monster' | 'item' | 'avatar' | 'scene' | 'effect' | 'ui';

/** Options a drawing function may honour. Unknown options are ignored. */
export interface GridOptions {
  flash?: boolean;
  weapon?: WeaponSlug;
  armor?: ArmorSlug;
  /** Frame within the state (heroes and enemies). Defaults to the state's still frame. */
  frame?: number;
}

/** How one state of a grid entry animates. States without an entry are a single still frame. */
export interface StateAnim {
  frames: number;
  /** Milliseconds each frame stays up; length equals `frames`. */
  ms: readonly number[];
  /** Idle loops; an attack plays once and holds its last frame. */
  loop: boolean;
  /** Frame shown when motion is reduced (and by default when not animating). */
  still: number;
}
export const STILL_ANIM: StateAnim = { frames: 1, ms: [0], loop: false, still: 0 };

interface Base {
  key: string;
  group: AssetGroup;
  /** Native size in art pixels. */
  size: { w: number; h: number };
  /** Default whole-number display scale in the game. */
  scale: number;
  /** Where the sprite "stands", in art pixels (feet / centre). Used for layout and flipping. */
  anchor: { x: number; y: number };
  license: string;
  source: string;
}

/** One pixel grid per state (heroes, enemies, icons, items, avatars). */
export interface GridEntry extends Base {
  kind: 'grid';
  states: readonly string[];
  grid: (state: string, opts: GridOptions) => PixelGrid;
  /** Per-state animation. Absent or missing states are one still frame. */
  anim?: Readonly<Record<string, StateAnim>>;
}
/** A scene: three parallax layers stacked far to near. */
export interface SceneEntry extends Base {
  kind: 'grid';
  layers: () => Record<SceneLayer, PixelGrid>;
}
/** A procedural frame sheet (effects). */
export interface SheetEntry extends Base {
  kind: 'sheet';
  frames: number;
  frame: (index: number) => PixelGrid;
}
/** Hand-made or vendored art stored in the repo. `src` must be a local path, never a URL. */
export interface FileEntry extends Base {
  kind: 'svg' | 'image';
  src: string;
  frames?: number;
}
export type AssetEntry = GridEntry | SceneEntry | SheetEntry | FileEntry;
export type Manifest = Readonly<Record<string, AssetEntry>>;

export const isSceneEntry = (e: AssetEntry): e is SceneEntry => e.kind === 'grid' && 'layers' in e;
export const animOf = (e: GridEntry, state: string): StateAnim => e.anim?.[state] ?? STILL_ANIM;

/** Build a state's animation from its frame count and timing. */
function animTable(frames: Readonly<Record<string, number>>, timing: Readonly<Record<string, Timing>>): Record<string, StateAnim> {
  const out: Record<string, StateAnim> = {};
  for (const [state, n] of Object.entries(frames)) {
    const t = timing[state];
    if (n > 1 && t) out[state] = { frames: n, ms: t.ms.slice(0, n), loop: t.loop, still: defaultFrame(state) };
  }
  return out;
}
const HERO_ANIM = animTable(HERO_FRAMES, HERO_TIMING);
const ENEMY_ANIM = animTable(ENEMY_FRAMES, ENEMY_TIMING);

export const isGridEntry = (e: AssetEntry): e is GridEntry => e.kind === 'grid' && 'grid' in e;

const procedural = (file: string) => ({ license: PROCEDURAL_LICENSE, source: `procedural: sprites/${file}` });
const at = (x: number, y: number) => ({ x, y });

function build(): Record<string, AssetEntry> {
  const m: Record<string, AssetEntry> = {};
  const add = (e: AssetEntry) => {
    m[e.key] = e;
  };

  for (const cls of HERO_CLASSES) {
    add({
      key: `hero.${cls}`, group: 'hero', kind: 'grid', size: { w: HERO_SIZE, h: HERO_SIZE }, scale: 3,
      anchor: at(24 + HERO_X0, HERO_GROUND), ...procedural('hero.ts'), states: HERO_STATES, anim: HERO_ANIM,
      grid: (state, o) => heroGrid(cls as HeroClass, state as HeroState, o),
    });
    add({
      key: `portrait.${cls}`, group: 'avatar', kind: 'grid', size: { w: PORTRAIT_SIZE, h: PORTRAIT_SIZE }, scale: 3,
      anchor: at(20, 39), ...procedural('avatars.ts'), states: ['idle'], grid: () => portraitGrid(cls),
    });
  }
  for (const def of ALL_ENEMIES) {
    add({
      key: `monster.${def.slug}`, group: 'monster', kind: 'grid', size: { w: def.size, h: def.size },
      scale: def.size === 96 ? 2 : 4, anchor: at(def.size / 2, def.ground),
      ...procedural(def.size === 96 ? 'bosses.ts' : 'enemies-*.ts'), states: enemyStates(def.slug), anim: ENEMY_ANIM,
      grid: (state, o) => enemyGrid(def.slug, state as EnemyState, o),
    });
  }
  for (const slug of [...WEAPON_SLUGS, ...ARMOR_SLUGS] as ItemSlug[]) {
    const kind = (WEAPON_SLUGS as readonly string[]).includes(slug) ? 'weapon' : 'armor';
    add({
      key: `${kind}.${slug}`, group: 'item', kind: 'grid', size: { w: ITEM_ICON_SIZE, h: ITEM_ICON_SIZE }, scale: 2,
      anchor: at(16, 16), ...procedural('items.ts'), states: ['icon'], grid: () => itemIconGrid(slug),
    });
  }
  for (const r of RARITIES) {
    add({
      key: `frame.${r}`, group: 'item', kind: 'grid', size: { w: FRAME_SIZE, h: FRAME_SIZE }, scale: 2,
      anchor: at(18, 18), ...procedural('items.ts'), states: ['idle'], grid: () => rarityFrameGrid(r),
    });
  }
  for (const id of AVATAR_IDS) {
    add({
      key: `avatar.${id}`, group: 'avatar', kind: 'grid', size: { w: AVATAR_SIZE, h: AVATAR_SIZE }, scale: 3,
      anchor: at(16, 31), ...procedural('avatars.ts'), states: ['idle'], grid: () => avatarGrid(id),
    });
  }
  const sceneBase = { group: 'scene' as const, size: { w: SCENE_W, h: SCENE_H }, scale: 3, anchor: at(160, 128) };
  for (const id of Object.keys(DUNGEON_SCENES) as DungeonSceneId[]) {
    add({ key: `dungeon.${id}`, kind: 'grid', ...sceneBase, ...procedural('scenes.ts'), layers: () => dungeonScene(id) });
  }
  for (const id of Object.keys(HUB_SCENES) as HubSceneId[]) {
    add({ key: `scene.${id}`, kind: 'grid', ...sceneBase, ...procedural('scenes-hub.ts'), layers: () => hubScene(id) });
  }
  for (const id of EFFECT_IDS as readonly EffectId[]) {
    add({
      key: `effect.${id}`, group: 'effect', kind: 'sheet', size: { w: EFFECT_SIZE, h: EFFECT_SIZE }, scale: 4,
      anchor: at(16, 16), ...procedural('effects.ts'), frames: EFFECT_FRAME_COUNT[id], frame: (i) => effectFrame(id, i),
    });
  }
  for (const id of NAV_ICON_IDS) {
    add({
      key: `ui.nav.${id}`, group: 'ui', kind: 'grid', size: { w: ICON_SIZE, h: ICON_SIZE }, scale: 2,
      anchor: at(8, 8), ...procedural('icons.ts'), states: ['idle'], grid: () => navIconGrid(id),
    });
  }
  for (const level of FLAME_LEVELS) {
    add({
      key: `ui.flame.${level}`, group: 'ui', kind: 'grid', size: { w: ICON_SIZE, h: ICON_SIZE }, scale: 3,
      anchor: at(8, 14), ...procedural('icons.ts'), states: ['idle'], grid: () => flameGrid(level),
    });
  }
  add({
    key: 'ui.crest', group: 'ui', kind: 'grid', size: { w: CREST_SIZE, h: CREST_SIZE }, scale: 3, anchor: at(12, 12),
    ...procedural('icons.ts'), states: ['idle'], grid: () => crestGrid(),
  });
  add({
    key: 'ui.energy', group: 'ui', kind: 'grid', size: { w: ENERGY_SIZE, h: ENERGY_SIZE }, scale: 2, anchor: at(7, 7),
    ...procedural('icons.ts'), states: ['idle'], grid: () => energyGrid(),
  });
  return m;
}

/** Every game asset, by key. Swap art by changing an entry here; gameplay code only knows the keys. */
export const MANIFEST: Manifest = build();
export const manifestKeys = (m: Manifest = MANIFEST): string[] => Object.keys(m);
export const getAsset = (key: string, m: Manifest = MANIFEST): AssetEntry | undefined => m[key];
export const entryStates = (e: AssetEntry): readonly string[] => (isGridEntry(e) ? e.states : ['idle']);
