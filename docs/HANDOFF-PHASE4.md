# Phase 4 handoff: status

**Phase 4 (`03-core-modules.md`) is complete in code. Its API half was run against local PostgreSQL 16 in an earlier session. Its web half and the explanations tooling were written in a session with no network, no `node_modules` and no database, so they have NOT been run.** Nothing in Phase 4 has been run against Supabase or in a browser.

## What exists

- API (`apps/api`): sessions, tasks, quests, question report, decks/cards/review/CSV, local import, question-bank seed, quest seed. 124 API tests passed locally earlier (shared 57).
- Web (`apps/web`): real `/quests` (My Tasks + Adventure Quests), `/sessions` (planner, server-clock timer, claim quiz, outcome, history, review sessions), `/lab` (decks, batch card entry, edit/delete, review mode, CSV preview/import/export), first-login import dialog (`features/import`), shared `ui/` (Dialog with focus trap, Tabs, ConfirmDialog, state views).
- Explanations tooling: `npm run explanations:draft` / `explanations:apply` (`apps/api/src/seed/explanations*.ts`).
- Decisions 23 to 38 in `docs/DECISIONS.md`.

## What was verified this session (and how)

- Typecheck of all new web code (and its tests) against hand-written type stubs for React, TanStack Query, React Router and zod, plus the REAL shared DTO types: no errors in new files; a planted wrong field name was caught. This is NOT the repo's real `npm run typecheck`.
- Unused-import scan of the new web files: clean after one fix.
- The old question file really holds 148 entries (read with node `vm`).

## NOT verified (run these first, in order)

1. `npm install`
2. `npm run format` (prettier was not available; the new files are hand-formatted and `prettier --check` may fail until this runs)
3. `npm run lint`, `npm run typecheck`, `npm run build`
4. `npm run test` (new web tests: router, Dialog, TasksPanel, CardsForm, useSessionClock, LocalImportPrompt, format; new API test: explanations). If a web test fails, suspect the test first: they were written without being run (fake-timer and focus tests are the likeliest to need a tweak).
5. `cd apps/api && npx prisma migrate dev` once (must report no drift), then `npm run db:deploy` and `npm run db:seed` against Supabase.
6. `npm run dev`, then in a browser: sign up, add a task and complete it, run a 10-minute session (the timer must survive a refresh), pass and fail a claim quiz, add 3 cards then a 4th (all must remain), review them, CSV import/export a deck, and import an old `studyverse-data` save.

## Known gaps / things to watch

- Nothing in the UI is covered by Playwright yet (Phase 5/6 add the smoke tests).
- `ClaimResultDto` has no per-question explanation field; "No explanation yet" display belongs to the battle screen (Phase 5).
- The dashboard, camp, battle, stats, settings and leaderboard routes are still honest "Coming soon" placeholders.
- Avatar upload and "Export my data" / "Reset progress" are Phase 6 (Settings).

## Next

Phase 5a/5b/6: `05-art-and-sprites.md` (sprite system) then `06-battle-screen.md`, then `07-camp-dashboard-stats-social.md`, then `08-verification-and-deploy.md`. Use `grantXp` for every reward; user id only from `req.user`.
