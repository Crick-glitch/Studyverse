# StudyVerse (rebuild in progress)

Monorepo: `apps/web` (React + Vite), `apps/api` (Express + Prisma), `packages/shared` (Zod schemas, balance, level curve).
Legacy static app: `Studyverse/` (kept until the final verification phase).

## Setup

```
npm install
cp apps/api/.env.example apps/api/.env   # then fill in DATABASE_URL / DIRECT_URL (see below)
cp apps/web/.env.example apps/web/.env
npm run db:migrate    # applies prisma/migrations to your database
npm run db:seed       # items, skills, achievements (safe to run twice)
npm run dev           # web :5173, api :4000
npm run typecheck && npm run lint && npm run test && npm run build
```

## Supabase setup

1. Create a project. Authentication > Providers: enable Email.
2. Authentication > URL Configuration: add your site URLs (`http://localhost:5173` and, later, production and preview origins) as redirect URLs.
3. Dashboard > Connect: copy the **pooled** (transaction pooler, port 6543) string into `DATABASE_URL` and the **direct / session** (port 5432) string into `DIRECT_URL`.
4. Keys: the **publishable** key and project URL go to the web app (`apps/web/.env`). The API only needs the project URL (it verifies tokens against the project's public JWKS). The **secret / service_role key is not used and must never reach the browser or the repo.**

## Access model (important)

Prisma connects with a privileged database role, so **the API is the only authorization layer**: every protected route verifies the Supabase access token (`jose`, JWKS), and the user id comes only from the verified token, never from the request. As defence in depth, Row Level Security is enabled on every table with **no policies** and the `anon`/`authenticated` roles are revoked, so the Supabase client in the browser cannot read or write game tables directly.

## API (Phase 3)

`GET /api/v1/health` (public). Protected: `GET /me`, `GET /profile`, `PATCH /profile`, `GET /progress`. Errors always look like `{ "error": { "code", "message", "details?" } }`. XP is only ever granted through `grantXp` (`apps/api/src/lib/xp.ts`), which is idempotent per `(userId, sourceType, sourceId)`.

## Tests

`npm run test` runs everything. Database tests need PostgreSQL: set `TEST_DATABASE_URL` to a database **whose name contains "test"** (it is wiped and re-migrated on every run, and the runner refuses other names). Without it those tests are skipped with a warning.

## Status

Phase 1 (foundation) and Phase 3 (schema, auth, API plumbing, login screen) are implemented; every other route is a labeled placeholder. See `docs/HANDOFF.md` (what is verified and what you must do next), `docs/DECISIONS.md`, `docs/AUDIT.md`.
