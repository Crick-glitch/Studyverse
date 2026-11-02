/**
 * Preset avatar keys. The illustrated busts arrive with the art phase (05-art-and-sprites.md); until
 * then the key is stored and the UI shows a labeled placeholder, never an emoji.
 */
export const AVATAR_PRESETS = [
  'student',
  'mage',
  'ranger',
  'scientist',
  'teacher',
  'guardian',
] as const;
export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

/**
 * The old app's emoji avatars (written as code points so no emoji lives in the source), mapped to the
 * preset that replaces each. Used only by the local-data import.
 */
export const LEGACY_EMOJI_TO_PRESET: Readonly<Record<string, AvatarPreset>> = {
  '\u{1F9D1}\u200D\u{1F393}': 'student',
  '\u{1F9D9}': 'mage',
  '\u{1F9DD}\u200D\u2640\uFE0F': 'ranger',
  '\u{1F469}\u200D\u{1F52C}': 'scientist',
  '\u{1F469}\u200D\u{1F3EB}': 'teacher',
  '\u{1F6E1}\uFE0F': 'guardian',
};
