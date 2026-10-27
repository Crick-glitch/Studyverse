import { AVATAR_PRESETS } from '@studyverse/shared';
import { describe, expect, it } from 'vitest';
import { getAsset } from '../features/art/manifest';
import { portraitSource } from './HeroPortrait';

describe('portraitSource', () => {
  it('maps every API avatar preset to a real bust in the manifest (the two lists were named separately)', () => {
    for (const key of AVATAR_PRESETS) {
      const src = portraitSource({ avatarKey: key, playerClass: null });
      expect(getAsset(src.id), `${key} -> ${src.id}`).toBeTruthy();
    }
  });

  it('falls back to the class portrait, then the student bust', () => {
    expect(portraitSource({ avatarKey: null, playerClass: 'tank' }).id).toBe('portrait.tank');
    expect(portraitSource({ avatarKey: null, playerClass: null }).id).toBe('avatar.student');
    expect(portraitSource({ avatarKey: 'not-a-preset', playerClass: 'scholar' }).id).toBe('portrait.scholar');
    for (const c of ['warrior', 'tank', 'scholar'] as const) expect(getAsset(portraitSource({ avatarKey: null, playerClass: c }).id)).toBeTruthy();
  });

  it('prefers the chosen avatar over the class', () => {
    expect(portraitSource({ avatarKey: 'mage', playerClass: 'warrior' }).id).toBe('avatar.wizard');
  });
});
