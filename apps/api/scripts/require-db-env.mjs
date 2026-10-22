// Fails early with a readable message instead of a confusing connection error.
import 'dotenv/config';

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  console.error(
    'DATABASE_URL (and DIRECT_URL for migrations) is not set.\n' +
      'Copy apps/api/.env.example to apps/api/.env and fill in your Supabase connection strings (see README.md).',
  );
  process.exit(1);
}
