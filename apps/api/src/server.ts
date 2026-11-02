import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createTokenVerifier } from './lib/auth.js';
import { createPrisma } from './lib/prisma.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  console.error('\nCopy .env.example to .env and fill in the values (see README.md).');
  process.exit(1);
}

const prisma = createPrisma(config.DATABASE_URL as string);
const verifyToken = createTokenVerifier({
  supabaseUrl: config.SUPABASE_URL as string,
  ...(config.SUPABASE_JWKS_URL ? { jwksUrl: config.SUPABASE_JWKS_URL } : {}),
});
const app = createApp(config, { prisma, verifyToken });

const server = app.listen(config.PORT, () => {
  console.log(`StudyVerse API listening on http://localhost:${config.PORT}/api/v1`);
});

const shutdown = () => {
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
