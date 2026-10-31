import { describe, expect, it } from 'vitest';
import {
  ENEMIES,
  BOSSES,
  DUNGEONS,
  accuracyMult,
  allDungeonStatuses,
  battleEnergy,
  battleXp,
  BALANCE,
  bossGate,
  deriveStats,
  dungeonGate,
  enemiesForSubject,
  getDungeon,
  rollRarity,
  scaleEnemy,
  type UnlockFacts,
} from '../index.js';

describe('roster (04-rpg-design-spec)', () => {
  it('has the 9 regular enemies and 3 bosses with the 04 stats', () => {
    expect(ENEMIES).toHaveLength(9);
    expect(BOSSES.map((b) => [b.slug, b.tier, b.hp, b.atk, b.def])).toEqual([
      ['procrastination-wyrm', 1, 220, 16, 6],
      ['archivist-lich', 2, 240, 20, 8],
      ['clockwork-titan', 3, 275, 26, 12],
    ]);
    const golem = ENEMIES.find((e) => e.slug === 'gearwork-golem');
    expect([golem?.hp, golem?.atk, golem?.def, golem?.affinity]).toEqual([90, 11, 7, 'Math']);
    expect(new Set([...ENEMIES, ...BOSSES].map((e) => e.slug)).size).toBe(12);
  });
  it('picks enemies by subject affinity (any always qualifies)', () => {
    expect(enemiesForSubject('Math').map((e) => e.slug)).toContain('gearwork-golem');
    expect(enemiesForSubject('Math').map((e) => e.slug)).not.toContain('inkwraith');
    expect(enemiesForSubject('Math').map((e) => e.slug)).toContain('goblin-chieftain');
    expect(enemiesForSubject('Any')).toHaveLength(9);
  });
  it('scales enemy stats by 10% per player level above 1', () => {
    const goblin = ENEMIES[0]!;
    // regular HP carries the tuned x1.2 (docs/DECISIONS.md, session 06 balance)
    expect(scaleEnemy(goblin, 1)).toEqual({ maxHp: 72, atk: 8, def: 3 });
    expect(scaleEnemy(goblin, 6)).toEqual({ maxHp: 108, atk: 12, def: 5 });
    expect(scaleEnemy(BOSSES[0]!, 1).maxHp).toBe(220);
  });
});

describe('deriveStats', () => {
  it('level 1 hero without gear: 100 HP / 10 ATK / 5 DEF', () => {
    const s = deriveStats({ level: 1, playerClass: null });
    expect([s.maxHp, s.atk, s.def]).toEqual([100, 10, 5]);
  });
  it('scales with level and adds gear, skills and training', () => {
    const s = deriveStats({
      level: 5,
      playerClass: 'warrior',
      weapon: { atk: 5, effectKey: null },
      armor: { def: 4, effectKey: null },
      skillKeys: ['power_strike', 'iron_skin'],
      training: { atk: 2, def: 1, hp: 3 },
    });
    expect(s.maxHp).toBe(100 + 40 + 15);
    expect(s.atk).toBe(10 + 8 + 5 + 2 + 4);
    expect(s.def).toBe(5 + 4 + 4 + 2 + 1);
    expect(s.effects.bonusAtk).toBe(2);
  });
  it('caps attribute training at 5 purchases each', () => {
    const s = deriveStats({ level: 1, playerClass: null, training: { atk: 99 } });
    expect(s.atk).toBe(10 + 5 * 2);
  });
  it('maps gear and skill effect keys to effects', () => {
    const s = deriveStats({
      level: 3,
      playerClass: 'tank',
      weapon: { atk: 8, effectKey: 'ignore_def_25' },
      armor: { def: 5, effectKey: 'first_wrong_half' },
      skillKeys: ['berserk', 'executioner', 'stone_wall', 'second_wind', 'quick_study'],
    });
    expect(s.effects).toMatchObject({
      tankWrongMult: 0.75,
      ignoreDefPct: 0.25,
      firstWrongHalf: true,
      berserk: true,
      executioner: true,
      stoneWall: true,
      secondWind: true,
      quickStudy: true,
    });
  });
  it('is identical whatever cosmetics exist (they are not an input)', () => {
    const a = deriveStats({ level: 4, playerClass: 'scholar' });
    const b = deriveStats({ level: 4, playerClass: 'scholar' });
    expect(a).toEqual(b);
  });
});

const facts = (over: Partial<UnlockFacts> = {}): UnlockFacts => ({
  level: 1,
  defeatedBosses: [],
  raidWinsByTier: {},
  ...over,
});

describe('unlock rules (04 "Dungeons, level gates and unlock rules")', () => {
  const [t1, t2, t3] = DUNGEONS;
  it('tier 1 is open at level 1; its boss needs level 3 and 3 raid wins', () => {
    expect(dungeonGate(t1!, facts()).open).toBe(true);
    expect(bossGate(t1!, facts({ level: 3, raidWinsByTier: { 1: 2 } })).reason).toBe('Win 1 more raid here');
    expect(bossGate(t1!, facts({ level: 2, raidWinsByTier: { 1: 3 } })).reason).toBe('Reach level 3');
    expect(bossGate(t1!, facts({ level: 2, raidWinsByTier: { 1: 1 } })).reason).toBe('Reach level 3 and win 2 more raids here');
    expect(bossGate(t1!, facts({ level: 3, raidWinsByTier: { 1: 3 } })).open).toBe(true);
  });
  it('tier 2 needs level 5 AND the tier 1 boss defeated', () => {
    expect(dungeonGate(t2!, facts({ level: 9 })).reason).toBe('Defeat The Procrastination Wyrm');
    expect(dungeonGate(t2!, facts({ level: 4, defeatedBosses: ['procrastination-wyrm'] })).reason).toBe('Reach level 5');
    expect(dungeonGate(t2!, facts({ level: 5, defeatedBosses: ['procrastination-wyrm'] })).open).toBe(true);
    expect(dungeonGate(t2!, facts({ level: 1 })).reason).toBe('Reach level 5 and defeat The Procrastination Wyrm');
  });
  it('tier 3 needs level 9 and the tier 2 boss; the boss at level 12', () => {
    expect(dungeonGate(t3!, facts({ level: 9, defeatedBosses: ['procrastination-wyrm'] })).open).toBe(false);
    const f = facts({ level: 9, defeatedBosses: ['procrastination-wyrm', 'archivist-lich'], raidWinsByTier: { 3: 3 } });
    expect(dungeonGate(t3!, f).open).toBe(true);
    expect(bossGate(t3!, f).reason).toBe('Reach level 12');
  });
  it('a locked dungeon reports its own reason for the boss gate', () => {
    expect(bossGate(t2!, facts({ level: 7 })).open).toBe(false);
  });
  it('lists all three dungeons with progress', () => {
    const all = allDungeonStatuses(facts({ level: 3, raidWinsByTier: { 1: 2 } }));
    expect(all.map((d) => d.dungeon.open)).toEqual([true, false, false]);
    expect(all[0]).toMatchObject({ raidWins: 2, raidWinsNeeded: 3, bossDefeated: false });
    expect(getDungeon(2)?.name).toBe('The Sunken Library');
  });
});

describe('battle rewards (04 "Rewards")', () => {
  it('accuracy multiplier runs 0.8 -> 1.2', () => {
    expect(accuracyMult(0)).toBeCloseTo(0.8);
    expect(accuracyMult(0.5)).toBeCloseTo(0.8);
    expect(accuracyMult(0.75)).toBeCloseTo(1.0);
    expect(accuracyMult(1)).toBeCloseTo(1.2);
  });
  const base = { level: 1, isBoss: false, accuracy: 0.75, mode: 'raid' as const, victory: true, scholar: false, gearXpMult: 1 };
  it('battleXp = round(25 x (1 + 0.04 x level) x accuracyMult), boss x2.5', () => {
    expect(battleXp(base)).toBe(26);
    expect(battleXp({ ...base, isBoss: true })).toBe(65);
    expect(battleXp({ ...base, level: 5, accuracy: 1 })).toBe(36);
  });
  it('defeat pays 40%, practice 25%, scholar and robe multiply', () => {
    expect(battleXp({ ...base, victory: false })).toBe(10);
    expect(battleXp({ ...base, mode: 'practice' })).toBe(7);
    expect(battleXp({ ...base, scholar: true })).toBe(30);
    expect(battleXp({ ...base, gearXpMult: 1.1 })).toBe(29);
  });
  it('is always at least 1 and adds duplicate XP on victory only', () => {
    expect(battleXp({ ...base, accuracy: 0, mode: 'practice', victory: false })).toBeGreaterThanOrEqual(1);
    expect(battleXp({ ...base, duplicateXp: 10 })).toBe(36);
    expect(battleXp({ ...base, victory: false, duplicateXp: 10 })).toBe(10);
  });
  it('energy on victory is fixed (1, +1 for Scholars) so no raid is energy-neutral', () => {
    expect(battleEnergy(false)).toBe(1);
    expect(battleEnergy(true)).toBe(2);
    expect(battleEnergy(true)).toBeLessThan(BALANCE.raid.energyCost);
  });
  it('rarity rolls follow the weights and pity forces uncommon or better', () => {
    expect(rollRarity(0.0, false, false)).toBe('common');
    expect(rollRarity(0.69, false, false)).toBe('common');
    expect(rollRarity(0.71, false, false)).toBe('uncommon');
    expect(rollRarity(0.99, false, false)).toBe('rare');
    expect(rollRarity(0.0, false, true)).toBe('uncommon');
    expect(rollRarity(0.0, true, false)).toBe('common');
    expect(rollRarity(0.5, true, false)).toBe('uncommon');
    expect(rollRarity(0.9, true, false)).toBe('rare');
  });
});
