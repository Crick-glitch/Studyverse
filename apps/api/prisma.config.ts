import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Migrations use the DIRECT connection when provided (Supabase: port 5432, not the pooler).
// `prisma generate` needs no database; the placeholder only keeps it from failing without a .env.
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url },
});
