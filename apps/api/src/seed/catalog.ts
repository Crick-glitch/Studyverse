/** Static catalogs seeded into the database (04-rpg-design-spec). Effects are implemented by the battle engine later. */
import type { ItemSlot, Rarity, SkillBranch } from '../generated/prisma/client.js';

export interface ItemSeed {
  slug: string;
  name: string;
  slot: ItemSlot;
  rarity: Rarity;
  atk: number;
  def: number;
  effectKey: string | null;
}

export const ITEMS: ItemSeed[] = [
  {
    slug: 'iron-sword',
    name: 'Iron Sword',
    slot: 'weapon',
    rarity: 'common',
    atk: 3,
    def: 0,
    effectKey: null,
  },
  {
    slug: 'steel-sword',
    name: 'Steel Sword',
    slot: 'weapon',
    rarity: 'uncommon',
    atk: 5,
    def: 0,
    effectKey: null,
  },
  {
    slug: 'dragon-slayer',
    name: 'Dragon Slayer',
    slot: 'weapon',
    rarity: 'rare',
    atk: 8,
    def: 0,
    effectKey: 'ignore_def_25',
  },
  {
    slug: 'scribes-staff',
    name: "Scribe's Staff",
    slot: 'weapon',
    rarity: 'uncommon',
    atk: 4,
    def: 0,
    effectKey: 'focus_first_correct',
  },
  {
    slug: 'quillblade',
    name: 'Quillblade',
    slot: 'weapon',
    rarity: 'rare',
    atk: 6,
    def: 0,
    effectKey: 'hard_damage_20',
  },
  {
    slug: 'tome-hammer',
    name: 'Tome Hammer',
    slot: 'weapon',
    rarity: 'uncommon',
    atk: 5,
    def: 0,
    effectKey: 'shatter_guard_any',
  },
  {
    slug: 'leather-armor',
    name: 'Leather Armor',
    slot: 'armor',
    rarity: 'common',
    atk: 0,
    def: 2,
    effectKey: null,
  },
  {
    slug: 'iron-plate',
    name: 'Iron Plate',
    slot: 'armor',
    rarity: 'uncommon',
    atk: 0,
    def: 4,
    effectKey: null,
  },
  {
    slug: 'dragon-scale',
    name: 'Dragon Scale',
    slot: 'armor',
    rarity: 'rare',
    atk: 0,
    def: 6,
    effectKey: null,
  },
  {
    slug: 'scholars-robe',
    name: "Scholar's Robe",
    slot: 'armor',
    rarity: 'uncommon',
    atk: 0,
    def: 2,
    effectKey: 'battle_xp_10',
  },
  {
    slug: 'cartographers-mail',
    name: "Cartographer's Mail",
    slot: 'armor',
    rarity: 'uncommon',
    atk: 0,
    def: 3,
    effectKey: 'wrong_damage_minus_10',
  },
  {
    slug: 'wardens-plate',
    name: "Warden's Plate",
    slot: 'armor',
    rarity: 'rare',
    atk: 0,
    def: 5,
    effectKey: 'first_wrong_half',
  },
];

export interface SkillSeed {
  slug: string;
  name: string;
  branch: SkillBranch;
  cost: number;
  prerequisites: string[];
  effectKey: string;
}

export const SKILLS: SkillSeed[] = [
  {
    slug: 'power-strike',
    name: 'Power Strike',
    branch: 'might',
    cost: 1,
    prerequisites: [],
    effectKey: 'power_strike',
  },
  {
    slug: 'berserk',
    name: 'Berserk',
    branch: 'might',
    cost: 3,
    prerequisites: ['power-strike'],
    effectKey: 'berserk',
  },
  {
    slug: 'executioner',
    name: 'Executioner',
    branch: 'might',
    cost: 3,
    prerequisites: ['berserk'],
    effectKey: 'executioner',
  },
  {
    slug: 'iron-skin',
    name: 'Iron Skin',
    branch: 'guard',
    cost: 1,
    prerequisites: [],
    effectKey: 'iron_skin',
  },
  {
    slug: 'stone-wall',
    name: 'Stone Wall',
    branch: 'guard',
    cost: 3,
    prerequisites: ['iron-skin'],
    effectKey: 'stone_wall',
  },
  {
    slug: 'second-wind',
    name: 'Second Wind',
    branch: 'guard',
    cost: 3,
    prerequisites: ['stone-wall'],
    effectKey: 'second_wind',
  },
  {
    slug: 'scholar-insight',
    name: 'Scholar Insight',
    branch: 'mind',
    cost: 2,
    prerequisites: [],
    effectKey: 'scholar_insight',
  },
  {
    slug: 'sage-memory',
    name: 'Sage Memory',
    branch: 'mind',
    cost: 3,
    prerequisites: ['scholar-insight'],
    effectKey: 'sage_memory',
  },
  {
    slug: 'quick-study',
    name: 'Quick Study',
    branch: 'mind',
    cost: 3,
    prerequisites: ['sage-memory'],
    effectKey: 'quick_study',
  },
];

export interface AchievementSeed {
  slug: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: AchievementSeed[] = [
  { slug: 'novice', name: 'Novice', description: 'Reach level 1' },
  { slug: 'warrior', name: 'Warrior', description: 'Reach level 5' },
  { slug: 'legend', name: 'Legend', description: 'Reach level 10' },
  { slug: 'first-victory', name: 'First Victory', description: 'Win 1 raid' },
  { slug: 'raid-master', name: 'Raid Master', description: 'Win 5 raids' },
  { slug: 'streak-3', name: 'On a Roll', description: 'Study 3 days in a row' },
  { slug: 'streak-7', name: 'Week Warrior', description: 'Study 7 days in a row' },
  { slug: 'streak-14', name: 'Fortnight Scholar', description: 'Study 14 days in a row' },
  {
    slug: 'perfect-battle',
    name: 'Perfect Battle',
    description: 'Win a battle without a wrong answer',
  },
  { slug: 'reviews-100', name: 'Memory Keeper', description: 'Review 100 flashcards' },
  {
    slug: 'subject-wins-10',
    name: 'Subject Specialist',
    description: 'Win 10 battles in a single subject',
  },
  { slug: 'first-boss', name: 'Boss Slayer', description: 'Defeat your first boss' },
];
