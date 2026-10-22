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
  .then((counts) => console.log('Seed complete:', counts))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
