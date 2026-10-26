import { Canvas, type Pt } from '../draw/canvas';
import type { PixelGrid } from '../grid';
import { ARMOR_SLUGS, WEAPON_SLUGS, type ArmorSlug, type WeaponSlug } from './hero';

export const ITEM_ICON_SIZE = 32;
export const FRAME_SIZE = 36;
export const RARITIES = ['common', 'uncommon', 'rare'] as const;
export type Rarity = (typeof RARITIES)[number];
export type ItemSlug = WeaponSlug | ArmorSlug;

/** Rarity of each catalog item (04-rpg-design-spec.md, Gear table). */
export const ITEM_RARITY: Record<ItemSlug, Rarity> = {
  'iron-sword': 'common',
  'steel-sword': 'uncommon',
  'dragon-slayer': 'rare',
  'scribes-staff': 'uncommon',
  quillblade: 'rare',
  'tome-hammer': 'uncommon',
  'leather-armor': 'common',
  'iron-plate': 'uncommon',
  'dragon-scale': 'rare',
  'scholars-robe': 'uncommon',
  'cartographers-mail': 'uncommon',
  'wardens-plate': 'rare',
};
export const ITEM_SLOT = (slug: ItemSlug): 'weapon' | 'armor' =>
  (WEAPON_SLUGS as readonly string[]).includes(slug) ? 'weapon' : 'armor';
export const ITEM_SLUGS: readonly ItemSlug[] = [...WEAPON_SLUGS, ...ARMOR_SLUGS];

/** A corner-to-corner blade: from the pommel (x0,y0) to the tip (x1,y1). */
function sword(c: Canvas, blade: 'iron' | 'steel', guard: 'coal' | 'gold' | 'ember', wide: number): void {
  c.line(10, 22, 27, 5, blade, wide);
  c.line(11, 21, 26, 6, blade === 'iron' ? 'steel' : 'white', 1);
  c.line(6, 18, 14, 26, guard, 2);
  c.line(10, 22, 5, 27, 'wood', 3);
  c.disc(4, 28, 1.6, guard === 'coal' ? 'iron' : guard);
}

function weapon(slug: WeaponSlug): Canvas {
  const c = new Canvas(ITEM_ICON_SIZE, ITEM_ICON_SIZE);
  switch (slug) {
    case 'iron-sword':
      sword(c, 'iron', 'coal', 3);
      break;
    case 'steel-sword':
      sword(c, 'steel', 'gold', 3);
      break;
    case 'dragon-slayer':
      sword(c, 'steel', 'ember', 5);
      for (const [x, y] of [[13, 18], [16, 15], [19, 12], [22, 9]] as const) c.px(x, y, 'fEmber');
      c.poly([[4, 16], [9, 14], [12, 19]], 'ember');
      c.poly([[16, 28], [14, 23], [19, 25]], 'ember');
      break;
    case 'scribes-staff':
      c.line(7, 28, 22, 9, 'wood', 3);
      c.line(9, 25, 11, 23, 'gold', 3);
      c.disc(24, 7, 4.5, 'teal');
      c.disc(24, 7, 2, 'fTeal');
      c.px(20, 4, 'fTeal'); c.px(28, 10, 'fTeal');
      break;
    case 'quillblade':
      c.line(7, 26, 12, 21, 'wood', 3);
      c.line(8, 20, 15, 27, 'gold', 2);
      c.poly([[12, 21], [14, 11], [24, 5], [28, 4], [27, 8], [21, 19], [16, 22]], 'parch');
      c.line(13, 21, 27, 5, 'steel', 1);
      c.line(16, 18, 22, 17, 'fParch5', 1);
      c.line(18, 14, 24, 13, 'fParch5', 1);
      break;
    case 'tome-hammer': {
      c.line(6, 28, 20, 13, 'wood', 3);
      const C: Pt = [22, 11];
      const p: Pt = [5.25, 4.6];
      const d: Pt = [3.3, -3.75];
      const corner = (a: number, b: number): Pt => [C[0] + p[0] * a + d[0] * b, C[1] + p[1] * a + d[1] * b];
      c.poly([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], 'ember');
      const q = (a: number, b: number): Pt => corner(a * 0.78, b * 0.7);
      c.poly([q(-1, -1), q(1, -1), q(1, 1), q(-1, 1)], 'parch');
      c.line(...corner(-1, 0), ...corner(1, 0), 'gold', 2);
      break;
    }
  }
  return c;
}

/** Armour icons are front-view chest pieces, drawn as the left half and mirrored. */
function armor(slug: ArmorSlug): Canvas {
  const c = new Canvas(ITEM_ICON_SIZE, ITEM_ICON_SIZE);
  c.symmetric(() => {
    switch (slug) {
      case 'leather-armor':
        c.poly([[16, 7], [11, 7], [6, 11], [5, 17], [8, 17], [8, 27], [16, 27]], 'wood');
        c.rect(8, 21, 8, 2, 'gold'); c.px(9, 14, 'fWood7'); c.px(9, 17, 'fWood7');
        c.line(12, 8, 12, 20, 'fWood7', 1);
        break;
      case 'iron-plate':
        c.poly([[16, 6], [10, 6], [5, 10], [5, 16], [8, 17], [9, 27], [16, 27]], 'iron');
        c.rect(7, 7, 5, 3, 'steel');
        c.rect(9, 18, 7, 2, 'steel'); c.rect(9, 22, 7, 2, 'steel');
        c.px(7, 12, 'gold'); c.px(10, 25, 'gold'); c.px(15, 14, 'gold');
        break;
      case 'dragon-scale':
        c.poly([[16, 7], [10, 7], [4, 10], [4, 16], [8, 17], [9, 27], [16, 27]], 'ember');
        for (let row = 0; row < 5; row++) for (let i = 0; i < 4; i++) {
          const x = 9 + i * 2 + (row % 2); const y = 12 + row * 3;
          if (x < 16) c.px(x, y, 'fEmber7');
        }
        c.poly([[5, 9], [2, 3], [8, 7]], 'bone'); c.rect(8, 22, 8, 2, 'gold');
        break;
      case 'scholars-robe':
        c.poly([[16, 6], [11, 6], [7, 9], [3, 22], [6, 26], [9, 20], [10, 28], [16, 28]], 'teal');
        c.rect(12, 6, 4, 3, 'parch'); c.rect(15, 9, 2, 14, 'parch');
        c.px(14, 12, 'fGold'); c.px(14, 18, 'fGold'); c.rect(8, 21, 8, 1, 'gold');
        break;
      case 'cartographers-mail':
        c.poly([[16, 6], [10, 6], [5, 10], [5, 16], [8, 17], [9, 27], [16, 27]], 'iron');
        for (let y = 9; y < 27; y += 2) for (let x = 6 + (y % 4 === 1 ? 1 : 0); x < 16; x += 2) c.px(x, y, 'fCoal6');
        c.rect(9, 25, 7, 3, 'parch'); c.rect(7, 7, 5, 2, 'parch');
        c.px(13, 16, 'fGold'); c.px(13, 14, 'fGold'); c.px(13, 18, 'fGold'); c.px(12, 16, 'fGold'); c.px(14, 16, 'fGold');
        break;
      case 'wardens-plate':
        c.poly([[16, 6], [9, 6], [3, 10], [3, 16], [7, 17], [9, 27], [16, 27]], 'steel');
        c.rect(3, 8, 7, 4, 'iron'); c.rect(9, 18, 7, 2, 'iron');
        c.poly([[11, 12], [16, 12], [16, 22], [14, 25], [11, 22]], 'moss');
        c.px(14, 16, 'fGold'); c.px(14, 17, 'fGold'); c.px(13, 17, 'fGold');
        break;
    }
  });
  return c;
}

const iconCache = new Map<ItemSlug, PixelGrid>();
/** The 32x32 icon for a catalog item, without its rarity frame. */
export function itemIconGrid(slug: ItemSlug): PixelGrid {
  const hit = iconCache.get(slug);
  if (hit) return hit;
  const canvas = ITEM_SLOT(slug) === 'weapon' ? weapon(slug as WeaponSlug) : armor(slug as ArmorSlug);
  const grid = canvas.bake();
  iconCache.set(slug, grid);
  return grid;
}

/** A 36x36 rarity frame: dark slot, 2px border in the rarity colour, corner studs. */
export function rarityFrameGrid(rarity: Rarity): PixelGrid {
  const c = new Canvas(FRAME_SIZE, FRAME_SIZE);
  const edge = rarity === 'rare' ? 'fGold5' : rarity === 'uncommon' ? 'fMoss5' : 'fCoal6';
  const glow = rarity === 'rare' ? 'fGold7' : rarity === 'uncommon' ? 'fMoss7' : 'fCoal8';
  const stud = rarity === 'rare' ? 'fGold' : rarity === 'uncommon' ? 'fMoss' : 'fParch3';
  c.rect(0, 0, FRAME_SIZE, FRAME_SIZE, edge);
  c.rect(2, 2, FRAME_SIZE - 4, FRAME_SIZE - 4, glow);
  c.rect(3, 3, FRAME_SIZE - 6, FRAME_SIZE - 6, 'fForest');
  for (const [x, y] of [[0, 0], [FRAME_SIZE - 1, 0], [0, FRAME_SIZE - 1], [FRAME_SIZE - 1, FRAME_SIZE - 1]] as const) c.px(x, y, null as never);
  for (const [x, y] of [[1, 1], [FRAME_SIZE - 2, 1], [1, FRAME_SIZE - 2], [FRAME_SIZE - 2, FRAME_SIZE - 2]] as const) c.px(x, y, stud);
  return c.bake({ outline: false, shade: false });
}
