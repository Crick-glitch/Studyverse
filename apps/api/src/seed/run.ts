import type { PrismaClient } from '../lib/prisma.js';
import { ACHIEVEMENTS, ITEMS, SKILLS } from './catalog.js';
import { seedQuestionBank, type QuestionSeedReport } from './questionBank.js';
import { QUESTS } from './quests.js';

/**
 * Repeatable and safe to run twice: every row is upserted by its unique slug.
 * Also loads the old question bank (data/questions.js) and the quest definitions.
 */
export async function runSeed(prisma: PrismaClient): Promise<{
  items: number;
  skills: number;
  achievements: number;
  quests: number;
  questions: QuestionSeedReport;
}> {
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
  for (const q of QUESTS) {
    await prisma.questDefinition.upsert({ where: { slug: q.slug }, update: q, create: q });
  }
  const questions = await seedQuestionBank(prisma);
  return {
    items: ITEMS.length,
    skills: SKILLS.length,
    achievements: ACHIEVEMENTS.length,
    quests: QUESTS.length,
    questions,
  };
}
