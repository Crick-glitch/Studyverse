import 'dotenv/config';
import { createPrisma } from '../src/lib/prisma.js';
import { runSeed } from '../src/seed/run.js';

const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!url) {
  console.error('DATABASE_URL is not set (see apps/api/.env.example).');
  process.exit(1);
}
const prisma = createPrisma(url);
runSeed(prisma)
  .then(({ questions, ...counts }) => {
    console.log('Seed complete:', { ...counts, questionsStored: questions.stored });
    console.log(`Question bank: ${questions.stored} of ${questions.sourceCount} stored, ${questions.flagged} flagged needsReview.`);
    for (const s of questions.skipped) console.warn(`  skipped: ${s.reason}`);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
