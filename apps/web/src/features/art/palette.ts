/**
 * The one shared palette (05-art-and-sprites.md): 32 colours. The nine design tokens from tokens.css come
 * first; every other entry is a lighter or darker step of the same family for shading and highlights.
 * Every procedural sprite, background and effect uses ONLY these colours. A test keeps this table and
 * tokens.css in agreement, so the UI and the art cannot drift apart.
 */
export const PALETTE = {
  'forest-900': '#0f1f1a',
  'forest-700': '#1d3a30',
  'forest-500': '#2f5a47',
  'charcoal-950': '#121418',
  'charcoal-800': '#23262b',
  'charcoal-600': '#4b5058',
  'charcoal-400': '#8a9099',
  'charcoal-200': '#c9cdd3',
  'teal-700': '#26504f',
  'teal-500': '#3f7f7a',
  'teal-300': '#8ccdc3',
  'parchment-50': '#fbf5e2',
  'parchment-100': '#f1e6c8',
  'parchment-300': '#d9c796',
  'parchment-500': '#a89260',
  'gold-700': '#8f6f1c',
  'gold-500': '#c9a43a',
  'gold-300': '#f0d77a',
  'ember-700': '#7a2a18',
  'ember-500': '#c4532f',
  'ember-300': '#ec8e62',
  'moss-700': '#3d5a28',
  'moss-500': '#6b8e3d',
  'moss-300': '#a8c46e',
  'skin-700': '#a86f4c',
  'skin-500': '#d9a074',
  'skin-300': '#f0c9a0',
  'wood-700': '#5e3b22',
  'wood-500': '#8a5a35',
  'violet-700': '#3b2a5a',
  'violet-500': '#6b4c8a',
  'violet-300': '#a68bc4',
} as const;

export type ColorKey = keyof typeof PALETTE;
export const COLOR_KEYS = Object.keys(PALETTE) as ColorKey[];

/** One character per colour in serialised grids; '.' is transparent. */
export const TRANSPARENT = '.';
export const CHARS = '0123456789abcdefghijklmnopqrstuv';

export const charOf = (key: ColorKey): string => CHARS[COLOR_KEYS.indexOf(key)] ?? TRANSPARENT;
const KEY_BY_CHAR = new Map<string, ColorKey>(COLOR_KEYS.map((k, i) => [CHARS[i] as string, k]));
export const keyOfChar = (ch: string): ColorKey | undefined => KEY_BY_CHAR.get(ch);
export const hexOf = (key: ColorKey): string => PALETTE[key];

/** A shaded family of three tones. Light comes from the top, so top edges get `light`, bottom/right `dark`. */
export interface Ramp {
  dark: ColorKey;
  mid: ColorKey;
  light: ColorKey;
  /** Flat materials are never shaded (eyes, glows, ink lines). */
  flat?: boolean;
  /** Cells of this material do not cast an outline (glows, effects). */
  noOutline?: boolean;
}

const flat = (c: ColorKey, noOutline = false): Ramp => ({ dark: c, mid: c, light: c, flat: true, noOutline });

export const MATERIALS = {
  skin: { dark: 'skin-700', mid: 'skin-500', light: 'skin-300' },
  steel: { dark: 'charcoal-400', mid: 'charcoal-200', light: 'parchment-50' },
  iron: { dark: 'charcoal-600', mid: 'charcoal-400', light: 'charcoal-200' },
  coal: { dark: 'charcoal-950', mid: 'charcoal-800', light: 'charcoal-600' },
  gold: { dark: 'gold-700', mid: 'gold-500', light: 'gold-300' },
  teal: { dark: 'teal-700', mid: 'teal-500', light: 'teal-300' },
  ember: { dark: 'ember-700', mid: 'ember-500', light: 'ember-300' },
  moss: { dark: 'moss-700', mid: 'moss-500', light: 'moss-300' },
  violet: { dark: 'violet-700', mid: 'violet-500', light: 'violet-300' },
  wood: { dark: 'wood-700', mid: 'wood-500', light: 'parchment-500' },
  parch: { dark: 'parchment-500', mid: 'parchment-300', light: 'parchment-100' },
  bone: { dark: 'parchment-300', mid: 'parchment-100', light: 'parchment-50' },
  forest: { dark: 'forest-900', mid: 'forest-700', light: 'forest-500' },
  // flat colours
  ink: flat('charcoal-950'),
  white: flat('parchment-50'),
  fTeal: flat('teal-300', true),
  fEmber: flat('ember-300', true),
  fGold: flat('gold-300', true),
  fMoss: flat('moss-300', true),
  fViolet: flat('violet-300', true),
  fForest: flat('forest-900', true),
  fForest7: flat('forest-700', true),
  fForest5: flat('forest-500', true),
  fTeal7: flat('teal-700', true),
  fTeal5: flat('teal-500', true),
  fCoal8: flat('charcoal-800', true),
  fCoal6: flat('charcoal-600', true),
  fEmber7: flat('ember-700', true),
  fEmber5: flat('ember-500', true),
  fViolet7: flat('violet-700', true),
  fWood7: flat('wood-700', true),
  fWood5: flat('wood-500', true),
  fGold7: flat('gold-700', true),
  fGold5: flat('gold-500', true),
  fParch: flat('parchment-100', true),
  fParch3: flat('parchment-300', true),
  fParch5: flat('parchment-500', true),
  fMoss5: flat('moss-500', true),
  fMoss7: flat('moss-700', true),
  // flat skin tones for faces (existing palette colours, no new swatches)
  fSkin7: flat('skin-700', true),
  fSkin5: flat('skin-500', true),
  fSkin3: flat('skin-300', true),
} satisfies Record<string, Ramp>;

export type MaterialKey = keyof typeof MATERIALS;
export const MATERIAL_KEYS = Object.keys(MATERIALS) as MaterialKey[];
