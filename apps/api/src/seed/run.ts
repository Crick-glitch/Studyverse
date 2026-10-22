import type { PrismaClient } from '../lib/prisma.js';
import { ACHIEVEMENTS, ITEMS, SKILLS } from './catalog.js';

/**
 * Repeatable and safe to run twice: every row is upserted by its unique slug.
 * Phase 4 adds the question bank (from data/questions.js) and quest definitions here.
 */
export async function runSeed(
  prisma: PrismaClient,
): Promise<{ items: number; skills: number; achievements: number }> {
  for (const i of ITEMS) {
    const data = { ...i, spriteKey: `item.${i.slug}` };
    await prisma.itemDefinition.upsert({ where: { slug: i.slug }, update: data, create: data });
  }
  for (const s of SKILLS) {
    await prisma.skillDefinition.upsert({ where: { slug: s.slug }, update: s, create: s });
  }
  for (const a of ACHIEVEMENTS) {
    const data = { ...a, spriteKey: `achievement.${a.slug}` };
    await prisma.achievement.upsert({ where: { slug: a.slug }, update: data, create: data });
  }
  return { items: ITEMS.length, skills: SKILLS.length, achievements: ACHIEVEMENTS.length };
}
