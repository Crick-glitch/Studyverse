# Phase 4 handoff (partial): what is done, what is not

Status: Phase 4 (`03-core-modules.md`): the **API half is done and tested**; the **web screens are not**. Phase 3 and the foundation are untouched except where
noted under "Changes to Phase 3 files".

## Fixes for the two errors you hit

1. `db:seed` failed with a missing `src/generated/prisma/client.js`: Prisma 7 does not generate the client
   on its own. `apps/api/package.json` scripts `dev`, `build`, `typecheck`, `db:migrate`, `db:deploy`,
   `db:seed`, `db:studio` now run `prisma generate` first. (You can also run `npx prisma generate` once.)
2. `prisma.config.ts` "Cannot find name 'process'": the file was outside `tsconfig.json`'s `include`, so
   the editor used a bare config. `apps/api/tsconfig.json` now includes `prisma`, `prisma.config.ts` and
   `vitest.config.ts` (noEmit, used by the editor and `typecheck`); `tsconfig.build.json` is the emit config
   used by `npm run build -w apps/api` (output still `dist/server.js`). Restart the TS server in VS Code
   (Ctrl+Shift+P, "TypeScript: Restart TS Server") if the red underline stays.
   The first `db:deploy` P1001 ("can't reach database") then success on retry was a transient network/pooler
   hiccup, not a code problem.

## DONE (all of this ran: API suite 124 tests pass against local PostgreSQL 16, shared 57, eslint clean)

- Schema + migration `20261022120000_phase4_core_modules` (hand-written; the drift test passes locally).
  **Run `npx prisma migrate dev` once on your machine (or `npm run db:deploy` for Supabase) and confirm no drift.**
- `packages/shared`: balance, subjects, random, period, srs, rewards, choices, csv, avatars, Zod schemas + DTOs
  (tasks, sessions, flashcards, quests, import, `questionReportSchema`). `ClaimResultDto.questions[]` now carries
  `questionId` (so the UI can offer "Report this question").
- API services + routes, all mounted in `app.ts` behind one auth step, all scoped to `req.user.id`:
  - sessions (`/sessions`, `/sessions/active`, `/sessions/review`, `/sessions/:id/{start,pause,resume,finish,abandon}`,
    `GET|POST /sessions/:id/claim`, `DELETE /sessions/:id`), server clock only, claim quiz snapshots, idempotent claim;
  - tasks (`/tasks`, `/tasks/:id/{complete,reopen}`), quests (`/quests`, `/quests/:id/claim`),
    `POST /questions/:id/report`;
  - flashcards (`/decks`, `/decks/:id/cards`, `/cards/:id`, `/flashcards/due`, `/cards/:id/review`,
    `/decks/:id/csv/{preview,import}`, `GET /decks/:id/csv`, `GET /flashcards/csv`);
  - local import (`GET /import/local/preflight`, `POST /import/local`). CSV + import routes accept 2 MB JSON bodies
    (everything else 100 KB) and use the import rate limiter.
  - `AppDeps.clock` is injectable (tests move time without sleeping).
- Seed: `seed/questionBank.ts` (vm sandbox, upsert by `legacyId`, flags `needsReview`, never edits), `seed/quests.ts`
  (5 quests), both run by `runSeed`. The count is read from the file (148).
- Tests (`apps/api/src`): `sessions.int`, `tasks-quests.int`, `flashcards.int`, `import.int`, `questionBank.int`.
- Bugs found and fixed while testing: stale-session detection and the daily task cap compared the database clock
  with the injected clock (both now use timestamps stamped from the same clock); the stricter auth rate limiter was
  accidentally applied to every private route (now only `/me`, `/profile`, `/progress`).

## TODO (in this order)

6. Web (`apps/web`): real `/quests`, `/sessions`, `/lab` screens (TanStack Query, refetch after every mutation,
   server clock for the timer, claim quiz, review mode, CSV preview/import/export) and the first-login import dialog
   (Import / Not now / Download backup; write `studyverse-data-backup-<timestamp>` before importing).
   No emoji art; React escaping only.
7. `docs/DECISIONS.md` entries (see list at the bottom), `docs/HANDOFF.md`, final lint/typecheck/test/build, report.

DECISIONS to log (made in code, not yet written down): tasks daily paid cap (10/day, counted by `rewardedAt`);
`needsReview` questions stay in the game with a report action; ineligible sessions (<80% time or <0.5 focus) are
stored as `abandoned` with `outcomeReason`; claim quiz is a snapshot (bank quizzes built at finish, review quizzes at
creation, choices shuffled); a quiz with zero questions (empty bank) counts as a pass; quest counting
(`sessions_claimed` and `study_minutes` at claim, `cards_reviewed` per applied review or review-session card, only
due cards can be reviewed); review sessions use subject "Flashcards", difficulty easy; import maps (XP = one
`legacy_import` ledger row, once per account, capped at 500 000, not leaderboard-eligible; tasks arrive rewarded;
sessions are history only; skills re-derived from points; avatar images, emoji pictures, streak, energy, raid
counters, attribute points NOT imported; raid history archived in `ImportBatch.report.archive`); CSV formula
hardening (`=`,`+`,`-`,`@` prefixed on export, restored on import).

## Changes to Phase 3 files

`apps/api/package.json` (scripts), `apps/api/tsconfig.json` (+ new `tsconfig.build.json`),
`apps/api/prisma/schema.prisma` (Phase 4 additions; also re-formatted by `prisma format`),
`apps/api/src/schema.int.test.ts` (table count 22 to 23), `packages/shared/src/index.ts` and `balance.ts`.

## Not verified

Nothing in Phase 4 has run against Supabase or a browser. The new migration was only run on local PostgreSQL 16.
