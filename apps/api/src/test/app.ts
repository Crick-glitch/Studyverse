import type { Express } from 'express';
import { createApp, type AppConfig } from '../app.js';
import { createTokenVerifier } from '../lib/auth.js';
import type { PrismaClient } from '../lib/prisma.js';
import { createTestKeys, TEST_SUPABASE_URL, type TestKeys } from './jwt.js';

export const baseConfig: AppConfig = {
  CORS_ORIGINS: ['http://localhost:5173'],
  TRUST_PROXY: 0,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_GENERAL_MAX: 10_000,
  RATE_LIMIT_AUTH_MAX: 10_000,
  RATE_LIMIT_BATTLE_ANSWER_MAX: 10_000,
  RATE_LIMIT_IMPORT_MAX: 10_000,
};

export async function buildTestApp(
  prisma: PrismaClient,
  overrides: Partial<AppConfig> = {},
  clock?: () => Date,
): Promise<{ app: Express; keys: TestKeys }> {
  const keys = await createTestKeys();
  const verifyToken = createTokenVerifier({ supabaseUrl: TEST_SUPABASE_URL, keys: keys.keys });
  return { app: createApp(
      { ...baseConfig, ...overrides },
      { prisma, verifyToken, ...(clock && { clock }) },
    ), keys };
}

/** For tests that must never reach the database: any use throws. */
export const noDb = new Proxy({} as PrismaClient, {
  get() {
    throw new Error('This test must not touch the database');
  },
});
