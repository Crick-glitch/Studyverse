import type { Subject } from '../subjects.js';
import { BATTLE } from './constants.js';
import type { IntentKey, TierNumber } from './types.js';

export interface EnemyDef {
  slug: string;
  name: string;
  /** Subject the enemy belongs to, or 'any'. */
  affinity: Subject | 'any';
  hp: number;
  atk: number;
  def: number;
  intents: readonly IntentKey[];
}

/** The 9 regular enemies of 04-rpg-design-spec (slugs match the art manifest `monster.<slug>`). */
export const ENEMIES: readonly EnemyDef[] = [
  { slug: 'goblin-chieftain', name: 'Goblin Chieftain', affinity: 'any', hp: 60, atk: 8, def: 3, intents: ['strike', 'heavy'] },
  { slug: 'orc-warlord', name: 'Orc Warlord', affinity: 'any', hp: 80, atk: 12, def: 4, intents: ['strike', 'heavy', 'guard'] },
  { slug: 'dragon-hatchling', name: 'Dragon Hatchling', affinity: 'Science', hp: 100, atk: 15, def: 6, intents: ['strike', 'heavy', 'guard'] },
  { slug: 'hollow-mage', name: 'Hollow Mage', affinity: 'History', hp: 70, atk: 14, def: 3, intents: ['strike', 'drain'] },
  { slug: 'shadow-assassin', name: 'Shadow Assassin', affinity: 'any', hp: 65, atk: 16, def: 2, intents: ['strike', 'heavy'] },
  { slug: 'gearwork-golem', name: 'Gearwork Golem', affinity: 'Math', hp: 90, atk: 11, def: 7, intents: ['strike', 'guard'] },
  { slug: 'inkwraith', name: 'Inkwraith', affinity: 'Language', hp: 65, atk: 13, def: 2, intents: ['strike', 'drain'] },
  { slug: 'bloom-brute', name: 'Bloom Brute', affinity: 'Biology', hp: 85, atk: 10, def: 4, intents: ['strike', 'drain'] },
  { slug: 'mimic-tome', name: 'Mimic Tome', affinity: 'Other', hp: 70, atk: 12, def: 4, intents: ['strike', 'guard'] },
];

export interface BossDef extends EnemyDef {
  tier: TierNumber;
  /** One fixed line shown when the fight starts. */
  intro: string;
}

const ALL_INTENTS: readonly IntentKey[] = ['strike', 'heavy', 'guard', 'drain'];

/** Wyrm = Tier 1, Lich = Tier 2, Titan = Tier 3 (docs/DECISIONS.md, session 06). */
export const BOSSES: readonly BossDef[] = [
  { slug: 'procrastination-wyrm', name: 'The Procrastination Wyrm', affinity: 'any', hp: 220, atk: 16, def: 6, intents: ALL_INTENTS, tier: 1, intro: 'It coils around your unfinished work. "Later," it hisses. "Always later."' },
  { slug: 'archivist-lich', name: 'The Archivist Lich', affinity: 'any', hp: 240, atk: 20, def: 8, intents: ALL_INTENTS, tier: 2, intro: 'Dust stirs. The Lich opens a ledger: every answer you ever got wrong is written in it.' },
  { slug: 'clockwork-titan', name: 'The Clockwork Titan', affinity: 'any', hp: 275, atk: 26, def: 12, intents: ALL_INTENTS, tier: 3, intro: 'Gears the size of wagon wheels grind awake. Only a hard answer will crack its guard.' },
];

export interface DungeonDef {
  tier: TierNumber;
  slug: 'archive' | 'library' | 'foundry';
  name: string;
  /** Art manifest key of the battle background. */
  background: string;
  opensAtLevel: number;
  /** The previous tier's boss must have been defeated in a raid. */
  requiresBossSlug: string | null;
  bossSlug: string;
  bossOpensAtLevel: number;
  /** Raid victories over regular enemies in THIS dungeon before the boss gate opens. */
  bossGateRaidWins: number;
}

export const DUNGEONS: readonly DungeonDef[] = [
  { tier: 1, slug: 'archive', name: 'The Whispering Archive', background: 'dungeon.archive', opensAtLevel: 1, requiresBossSlug: null, bossSlug: 'procrastination-wyrm', bossOpensAtLevel: 3, bossGateRaidWins: 3 },
  { tier: 2, slug: 'library', name: 'The Sunken Library', background: 'dungeon.library', opensAtLevel: 5, requiresBossSlug: 'procrastination-wyrm', bossSlug: 'archivist-lich', bossOpensAtLevel: 7, bossGateRaidWins: 3 },
  { tier: 3, slug: 'foundry', name: 'The Clockwork Foundry', background: 'dungeon.foundry', opensAtLevel: 9, requiresBossSlug: 'archivist-lich', bossSlug: 'clockwork-titan', bossOpensAtLevel: 12, bossGateRaidWins: 3 },
];

export const getDungeon = (tier: number): DungeonDef | undefined => DUNGEONS.find((d) => d.tier === tier);
export const getBoss = (slug: string): BossDef | undefined => BOSSES.find((b) => b.slug === slug);
export const getRegularEnemy = (slug: string): EnemyDef | undefined => ENEMIES.find((e) => e.slug === slug);
export const getEnemy = (slug: string): EnemyDef | undefined => getBoss(slug) ?? getRegularEnemy(slug);
export const isBossSlug = (slug: string): boolean => BOSSES.some((b) => b.slug === slug);

/** Regular enemies whose affinity matches the subject (or any), as 04 says; 'Any' means every regular enemy. */
export function enemiesForSubject(subject: string): readonly EnemyDef[] {
  if (subject === 'Any') return ENEMIES;
  const matching = ENEMIES.filter((e) => e.affinity === 'any' || e.affinity === subject);
  return matching.length > 0 ? matching : ENEMIES;
}

export interface ScaledEnemy {
  maxHp: number;
  atk: number;
  def: number;
}

/** Enemy stats for a player of this level: x (1 + 0.10 * (level - 1)), rounded, never below 1 (regular HP x regularHpMult). */
export function scaleEnemy(def: EnemyDef, playerLevel: number): ScaledEnemy {
  const f = 1 + BATTLE.enemyScalePerLevel * Math.max(0, playerLevel - 1);
  const s = (n: number) => Math.max(1, Math.round(n * f));
  const hp = 'tier' in def ? def.hp : def.hp * BATTLE.regularHpMult;
  return { maxHp: s(hp), atk: s(def.atk), def: s(def.def) };
}
