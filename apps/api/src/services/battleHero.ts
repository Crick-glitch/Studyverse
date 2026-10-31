import {
  EFFECT_TEXT,
  deriveStats,
  levelFromTotalXp,
  type BattleGearDto,
  type DerivedStats,
  type PlayerClassKey,
} from '@studyverse/shared';
import type { Prisma } from '../lib/prisma.js';
import type { BattleMeta } from './battleTypes.js';

type Tx = Prisma.TransactionClient;

const STARTER = { weapon: 'iron-sword', armor: 'leather-armor' } as const;

/** New heroes start with Iron Sword and Leather Armor (04 "Gear"), given once, the first time they fight. */
export async function ensureStarterGear(tx: Tx, userId: string): Promise<void> {
  if ((await tx.playerItem.count({ where: { userId } })) > 0) return;
  const defs = await tx.itemDefinition.findMany({ where: { slug: { in: [STARTER.weapon, STARTER.armor] } } });
  const weaponDef = defs.find((d) => d.slug === STARTER.weapon);
  const armorDef = defs.find((d) => d.slug === STARTER.armor);
  if (!weaponDef || !armorDef) return; // catalog not seeded: fight bare-handed rather than fail
  const [weapon, armor] = await Promise.all([
    tx.playerItem.create({ data: { userId, itemDefinitionId: weaponDef.id, source: 'starter' } }),
    tx.playerItem.create({ data: { userId, itemDefinitionId: armorDef.id, source: 'starter' } }),
  ]);
  await tx.equipment.upsert({
    where: { userId },
    create: { userId, weaponItemId: weapon.id, armorItemId: armor.id },
    update: { weaponItemId: weapon.id, armorItemId: armor.id },
  });
}

const gearDto = (d: { slug: string; name: string; rarity: BattleGearDto['rarity']; effectKey: string | null }): BattleGearDto => ({
  slug: d.slug,
  name: d.name,
  rarity: d.rarity,
  effect: d.effectKey ? (EFFECT_TEXT[d.effectKey] ?? null) : null,
});

const CLASS_PERK: Record<PlayerClassKey, string> = {
  warrior: 'Warrior: +2 base damage on correct answers.',
  tank: 'Tank: -25% damage from wrong answers.',
  scholar: 'Scholar: +15% XP and +1 energy on victory.',
};

/** Everything a battle needs to know about the hero, all of it DERIVED (hard rule 4). */
export async function loadHero(tx: Tx, userId: string): Promise<{ stats: DerivedStats; meta: BattleMeta }> {
  const [profile, progress, equipment, skills] = await Promise.all([
    tx.playerProfile.findUniqueOrThrow({ where: { id: userId }, select: { playerClass: true } }),
    tx.playerProgress.findUniqueOrThrow({ where: { userId }, select: { totalXp: true } }),
    tx.equipment.findUnique({
      where: { userId },
      include: { weapon: { include: { itemDefinition: true } }, armor: { include: { itemDefinition: true } } },
    }),
    tx.playerSkill.findMany({ where: { userId }, include: { skill: { select: { effectKey: true } } } }),
  ]);
  const weapon = equipment?.weapon?.itemDefinition ?? null;
  const armor = equipment?.armor?.itemDefinition ?? null;
  const skillKeys = skills.map((s) => s.skill.effectKey);
  const stats = deriveStats({
    level: levelFromTotalXp(progress.totalXp).level,
    playerClass: profile.playerClass,
    weapon: weapon && { atk: weapon.atk, effectKey: weapon.effectKey },
    armor: armor && { def: armor.def, effectKey: armor.effectKey },
    skillKeys,
  });
  const perks = [
    ...(profile.playerClass ? [CLASS_PERK[profile.playerClass]] : []),
    ...skillKeys.map((k) => EFFECT_TEXT[k]).filter((t): t is string => Boolean(t)),
  ];
  return {
    stats,
    meta: { weapon: weapon && gearDto(weapon), armor: armor && gearDto(armor), perks },
  };
}

