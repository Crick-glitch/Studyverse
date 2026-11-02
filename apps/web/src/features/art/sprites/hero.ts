import { overlay, type PixelGrid } from '../grid';
import { defaultFrame } from './frames';
import { Canvas } from '../draw/canvas';
import { ARMOR_SLUGS, WEAPON_SLUGS, armorLayer, weaponLayer, type ArmorSlug, type WeaponSlug } from './hero-gear';
import { backLayer, bodyLayer, faceLayer, offhandLayer } from './hero-body';
import {
  HERO_LAYERS, clampFrame, frame, shadowLayer,
  type HeroClass, type HeroLayer, type HeroState,
} from './hero-rig';

export {
  ATTACK_PHASES, HERO_CLASSES, HERO_FRAMES, HERO_GROUND, HERO_LAYERS, HERO_SIZE, HERO_STATES, HERO_X0,
  type AttackPhase, type HeroClass, type HeroLayer, type HeroState,
} from './hero-rig';
export { ARMOR_SLUGS, WEAPON_SLUGS, type ArmorSlug, type WeaponSlug };

/** Kept for existing callers: the Warrior's starting kit. */
export const DEFAULT_WEAPON: WeaponSlug = 'iron-sword';
export const DEFAULT_ARMOR: ArmorSlug = 'leather-armor';
/** What each class wears when no equipment is given (previews, class cards). */
export const CLASS_GEAR: Readonly<Record<HeroClass, { weapon: WeaponSlug; armor: ArmorSlug }>> = {
  warrior: { weapon: 'iron-sword', armor: 'leather-armor' },
  tank: { weapon: 'iron-sword', armor: 'iron-plate' },
  scholar: { weapon: 'scribes-staff', armor: 'scholars-robe' },
};

export interface HeroGear {
  weapon?: WeaponSlug;
  armor?: ArmorSlug;
}
export interface HeroOpts extends HeroGear {
  /** One-frame white flash (applied on top of any state, normally `hit`). */
  flash?: boolean;
  /** Frame within the state (idle 0-1, attack 0-2 = wind-up, impact, recovery). Defaults to the state's still frame. */
  frame?: number;
}

export function heroLayerGrid(cls: HeroClass, state: HeroState, layer: HeroLayer, gear: HeroOpts = {}): PixelGrid {
  const f = frame(cls, state, gear.frame ?? defaultFrame(state));
  const flash = !!gear.flash;
  const bake = (c: Canvas) => c.bake({ flash });
  const kit = CLASS_GEAR[cls];
  switch (layer) {
    case 'shadow':
      return shadowLayer(f).bake({ outline: false });
    case 'back':
      return bake(backLayer(cls, f));
    case 'body':
      return bake(bodyLayer(cls, f));
    case 'face':
      return faceLayer(f).bake({ flash: false, outline: false });
    case 'armor':
      return bake(armorLayer(gear.armor ?? kit.armor, f));
    case 'offhand':
      return bake(offhandLayer(cls, f));
    case 'weapon':
      return bake(weaponLayer(gear.weapon ?? kit.weapon, f));
  }
}

const cache = new Map<string, PixelGrid>();
/** The composed hero: shadow, back gear, body, armour, off-hand, weapon. Cached per class/state/frame/gear. */
export function heroGrid(cls: HeroClass, state: HeroState, gear: HeroOpts = {}): PixelGrid {
  const kit = CLASS_GEAR[cls];
  const idx = clampFrame(state, gear.frame ?? defaultFrame(state));
  const key = `${cls}|${state}|${idx}|${gear.weapon ?? kit.weapon}|${gear.armor ?? kit.armor}|${gear.flash ? 'f' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const grid = overlay(HERO_LAYERS.map((l) => heroLayerGrid(cls, state, l, { ...gear, frame: idx })));
  cache.set(key, grid);
  return grid;
}
