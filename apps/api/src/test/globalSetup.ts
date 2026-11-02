import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

/**
 * When TEST_DATABASE_URL is set: wipe the public schema of that database and apply every migration
 * file in order, so the tests also prove the migration SQL itself works from scratch.
 *
 * Safety: refuses to run unless the database name contains "test" (never point this at real data).
 */
export default async function setup() {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    console.warn(
      '\n[tests] TEST_DATABASE_URL not set: database integration tests will be SKIPPED.\n',
    );
    return;
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to reset database "${dbName}": its name must contain "test".`);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const root = join(import.meta.dirname, '../../prisma/migrations');
    const dirs = readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      await client.query(readFileSync(join(root, dir, 'migration.sql'), 'utf8'));
    }
  } finally {
    await client.end();
  }
}
