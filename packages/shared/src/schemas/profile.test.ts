import { describe, expect, it } from 'vitest';
import { displayNameSchema, profilePatchSchema } from './profile.js';

describe('displayNameSchema', () => {
  it('trims and collapses whitespace', () => {
    expect(displayNameSchema.parse('  Ada   Lovelace ')).toBe('Ada Lovelace');
  });
  it.each([
    'ab',
    'a'.repeat(21),
    'bob@example.com',
    'x.y.z',
    '-lead',
    'trail-',
    'a/b',
    '<b>hi</b>',
  ])('rejects %s', (v) => {
    expect(displayNameSchema.safeParse(v).success).toBe(false);
  });
  it.each(['Ada', 'Jose_99', 'Ana-Maria', 'Zoë Q'])('accepts %s', (v) => {
    expect(displayNameSchema.safeParse(v).success).toBe(true);
  });
});

describe('profilePatchSchema', () => {
  it('rejects unknown keys such as id', () => {
    expect(profilePatchSchema.safeParse({ id: 'x', displayName: 'Ada' }).success).toBe(false);
  });
  it('rejects an empty patch', () => {
    expect(profilePatchSchema.safeParse({}).success).toBe(false);
  });
  it('accepts a valid patch', () => {
    expect(
      profilePatchSchema.safeParse({ playerClass: 'tank', showOnLeaderboard: true }).success,
    ).toBe(true);
  });
  it('rejects an unknown class', () => {
    expect(profilePatchSchema.safeParse({ playerClass: 'wizard' }).success).toBe(false);
  });
});
