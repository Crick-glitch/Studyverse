import { randomUUID } from 'node:crypto';
import { createPrisma, type PrismaClient } from '../lib/prisma.js';
import { ensurePlayer } from '../services/player.js';

export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];
/** Integration tests need a real PostgreSQL. They are skipped (and say so) when none is configured. */
export const hasTestDb = Boolean(TEST_DATABASE_URL);

export function createTestPrisma(): PrismaClient {
  if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  return createPrisma(TEST_DATABASE_URL);
}

/** Creates a fresh player (profile + progress) with a random id; tests never share users. */
export async function newPlayer(prisma: PrismaClient): Promise<string> {
  const id = randomUUID();
  await ensurePlayer(prisma, id);
  return id;
}
