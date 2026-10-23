# Phase 4 handoff (partial): what is done, what is not

Status: Phase 4 (`03-core-modules.md`) is **partly built**. Everything below marked DONE typechecks and has
tests; everything marked TODO does not exist yet. Phase 3 and the foundation are untouched except where
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

## DONE
- Schema + migration `20261022120000_phase4_core_modules` (hand-written; drift test passes against local
  PostgreSQL 16): `SessionKind` enum, `StudySession.kind` / `outcomeReason`, `SessionClaimQuestion` now holds
  snapshots (`text`, `choices`, `correctIndex`, nullable `questionId`, new nullable `cardId`), new
  `QuestionReport` table (RLS on, no policies). **Run `npx prisma migrate dev` once on your machine
  (or `npm run db:deploy` to apply it to Supabase) and confirm there is no drift.**
- `packages/shared` (57 tests pass): balance constants for sessions/SRS/flashcards/CSV/import limits;
  `subjects`, `random`, `period` (UTC day/ISO week keys), `srs` (SM-2 + Sage Memory), `rewards` (pure session
  reward math), `choices` (placeholder detection, distractor cleaning, 3-choice builder), `csv` (RFC 4180
  parser/writer, formula-injection hardening, flashcard CSV parse/export with row-level errors), `avatars`,
  and Zod schemas + DTO types for tasks, sessions, flashcards, quests and local import.
- API helpers/services written and typechecking, **but not yet covered by tests and not mounted on any route**:
  `lib/playerLock.ts`, `services/streak.ts` (touchStreak, addEnergy, getModifiers), `services/quests.ts`
  (instances, recordQuestEvent, list, idempotent claim), `services/tasks.ts` (CRUD, complete with
  `grantXp`, reopen, daily paid-completion cap).
- Existing suites still pass: shared 57, API 48.

## TODO (in this order)
1. `services/sessions.ts` + `routes/sessions.ts`: create, start (one running/paused at a time, stale auto-abandon),
   pause, resume, finish (server elapsed time, 80% rule, focus clamp, builds the claim quiz snapshot),
   `GET /sessions/active`, `GET /sessions/:id/claim` (no answers), `POST /sessions/:id/claim` (grade
   server-side, `computeSessionReward`, `grantXp(sourceType='session')`, energy, quests, SRS for review
   sessions; idempotent), abandon, review-session creation from due cards.
2. `services/decks.ts`, `cards.ts`, `review.ts`, `csv.ts` + `routes/flashcards.ts`: deck/card CRUD (batch insert,
   ownership), `GET /flashcards/due` (choice vs reveal mode), review submit (compare-and-set on `dueAtSeen`),
   CSV preview / import (dedupe by normalized question, limits) / export.
3. `routes/tasks.ts`, `routes/quests.ts`, `routes/questions.ts` (`POST /questions/:id/report`), and
   `services/importLocal.ts` + `routes/import.ts` (preflight, import with merge confirmation, `payloadHash`
   idempotency, one `legacy_import` ledger row with `leaderboardEligible=false`). Mount them in `app.ts`;
   give the import and CSV routes a 2 MB JSON limit (global limit is 100 KB) and the import rate limiter.
4. Question bank seed (`seed/questionBank.ts`): load the old `questions.js` in a `vm` sandbox (fake `window`),
   upsert by `legacyId`, flag suspicious entries `needsReview=true` (never edit them), seed the 5 quest
   definitions (daily: finish a session, review 10 cards, win a battle; weekly: win 5 battles, study 150 min),
   add to `runSeed`. Question count must be read from the file, not hardcoded (it should be 148).
   Suggested manual flags: hist-h-007 (malformed), hist-h-004, hist-m-005, sci-e-007, sci-e-008, math-m-003,
   lang-m-008, lang-h-005, other-h-005, plus near-duplicates (sci-m-009/bio-e-003, sci-m-005/bio-h-006,
   sci-e-002/other-e-007, lang-h-003/lang-h-006) and automated checks (duplicate choices, bad correctIndex).
5. API tests (against local PostgreSQL, like the existing ones): task complete twice and reopen/complete pays
   once, daily cap, ownership 404s; session lifecycle with an injected clock, <80% pays nothing, claim twice
   pays once, concurrent claims pay once, claim endpoints never leak `correctIndex` before submit; flashcards
   add 3 then a 4th keeps all 4, CSV round trip and duplicate skip, other user gets 404; quest claim
   idempotency; import into empty account, retry (no duplicates), existing progress requires merge; seed
   count equals the count computed from the source file, every `correctIndex` maps to the same choice text,
   seeding twice creates no duplicates.
6. Web: real `/quests`, `/sessions`, `/lab` screens (TanStack Query, refetch after every mutation, server
   clock for the timer, claim quiz, review mode, CSV preview/import/export), and the first-login import
   dialog (Import / Not now / Download backup; write `studyverse-data-backup-<timestamp>` before importing).
   No emoji art; escape via React only.
7. Update `docs/DECISIONS.md` (suggested entries: tasks daily paid cap; include `needsReview` questions with a
   report action; sessions elapsed-time rules; claim-quiz snapshots; quest counting rules; import mapping
   incl. energy/raid counters/attribute points NOT imported; CSV formula hardening), `docs/HANDOFF.md`,
   run lint/typecheck/tests/build, and write the final report.

## Changes to Phase 3 files
`apps/api/package.json` (scripts), `apps/api/tsconfig.json` (+ new `tsconfig.build.json`),
`apps/api/prisma/schema.prisma` (Phase 4 additions; also re-formatted by `prisma format`),
`apps/api/src/schema.int.test.ts` (table count 22 to 23), `packages/shared/src/index.ts` and `balance.ts`.

## Not verified
Nothing in Phase 4 has run against Supabase or a browser. The new migration was only run on local PostgreSQL 16.
