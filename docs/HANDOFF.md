# HANDOFF — Session 06 (battle screen): P0, P1 and P2 BUILT, with the gaps listed below

Branch `rebuild/fullstack-ts`. Read `00-master-context.md`, then the "Session 06" sections of `docs/DECISIONS.md` (the last one, "third sitting", is the newest).
Do not describe anything under "Not done / unverified" as finished.

## Done (with evidence)
- **Server (P0):** `services/battleFinish.ts` (the only place a battle pays), `services/battles.ts` (moved out of `wip/`; `applyCardReview` and `BALANCE.srs.*` names verified), `services/battleHooks.ts` (`onFirstClear`, no-op until session 07), `routes/battles.ts` (`POST /battles` with `Idempotency-Key`, `GET /battles/active`, `GET /battles/:id`, `POST …/move|ability|answer|retreat|finish|missed-to-flashcards`). Tests `battles.int.test.ts` (38), run 6 times in a row with no flakes.
- **P1 server:** `GET /dungeons` (`services/dungeons.ts`, derived from raid `Battle` rows, plus `dueBySubject`); `dungeons.int.test.ts` (7); `battlesFirstClear.int.test.ts` (3: paid once across two victories and repeated `finish`, hook called once, no bonus on defeat).
- **Web (P0):** `/battle/:battleId` in `BattleLayout` (no HUD, hotbar or camp panel): `features/battle/` (reducer 16 tests, keys 5, page 12, rewards 7, animations 7). Moves before the question, intent banner, abilities, feedback with explanation, rewards (XP count-up, daily-cap note, loot, first clear, missed questions, weak spot, "add to flashcards"), retreat confirm, Auto-Steady, sound toggle, gear and perks panel. Refresh resumes from server state.
- **P1 web:** `features/dungeons/DungeonsPage.tsx` (map with node buttons at ≥ 700 px, vertical list always, locked reasons, boss gate and progress, boss prep with due cards and a Library link, resume banner). 9 tests.
- **P2:** Anime.js 4.5 animation library with sound events in sync (`useBattleAnimations`, tested with the real library in jsdom and with a mock); browser e2e script.
- **Screenshots looked at, five viewports** (1440×900, 1280×800, 768×1024, 390×844, 360×800), battle intro/move/question/feedback/boss/rewards and Adventure: `docs/redesign/battle-final/`, `docs/redesign/dungeons-final/`. The measurements report no sideways scroll, no clipped plates, no text under 12 px, no tap target under 40 px and no last answer below the fold. Real defects found and fixed this way are listed in DECISIONS item 14.

## Checks actually run (after the last edit)
| Command | Result |
|---|---|
| `npm run lint` (`eslint .`) | pass, 0 problems |
| `npm run typecheck` (api, web, shared) | pass |
| `npm run test` | pass: shared 4 files / 76 tests, API 19 files / 275 tests (was 227), web 33 files / 438 tests (was 384) |
| `npm run build` | pass (the web bundle is 559 kB, Vite warns above 500 kB; not split) |
| `node apps/web/scripts/battle-e2e.mjs` | pass: 12 steps, 2 widths, against a SIMULATOR (see DECISIONS 19) |
| `node apps/web/scripts/design-shots.mjs` | run; no problems reported |
| `prisma migrate dev` | NOT run: no schema change this sitting, and the schema engine is stubbed here. Run it once on a real machine and confirm no drift from `20261029000000_session06_battle`. |

## Not done / unverified
- **Not run against a real server and a real login:** the web app has only been driven against mocks (unit, jsdom and the simulator). The API is tested against real PostgreSQL. A first manual run with Supabase credentials is the real end-to-end test.
- **Motion and sound were not seen or heard.** Static frames, the real Anime.js API in jsdom and a console-error-free browser run were verified; the feel of the lunges, numbers and tones needs a human.
- **Not built:** readiness labels on the prep panel (session 07 needs mastery); cape palette and cosmetics on the hero (session 07); `hpBarTween` (on purpose); 05c P2 (quest chip, location banners); a test for the `battleAnswer` rate limit; a code-split of the web bundle.
- **Known limit:** a missed flashcard (as opposed to a bank question) is not re-queued inside the same battle, because answering it reschedules it (DECISIONS 8).
- Moves still cost one click per turn; Auto-Steady removes it. Only playtesting says whether encounters feel quick.

## Next (session 07), in order
Read `07-camp-dashboard-stats-social.md`. P0: S1 task XP cap (one call site) + Camp + Dashboard + Quest Board + Settings. When building Settings, move the two battle toggles there (keys `studyverse.skipTactics`, `studyverse.sound`). P1: S2 mastery, S3 quest generator and reroll, S4 cosmetics (attach to `onFirstClear` in `services/battleHooks.ts`; it receives the finish transaction), then readiness on `/dungeons` (the `Prepare` panel in `DungeonsPage.tsx`).
Exact next prompt: "Continue StudyVerse from the attached zip. Read `00-master-context.md`, `docs/HANDOFF.md` and the Session 06 sections of `docs/DECISIONS.md`. Run `07-camp-dashboard-stats-social.md` from Step 0 S1, priority order, tests first."

## Environment notes (workarounds I used)
- `binaries.prisma.sh` blocked: `PRISMA_SCHEMA_ENGINE_BINARY=/tmp/schema-engine-stub` (a script that exits 0) and `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`; `prisma generate` and `validate` work.
- PostgreSQL 16 from apt (`apt-get update` first), `pg_ctlcluster 16 main start`, database `studyverse_test`, `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studyverse_test`. The sandbox stopped Postgres between turns more than once; restart it before API tests.
- `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- `npm install` works (no `node_modules` in the zip); `npm run build:shared` before API tests; `prisma generate` for `apps/api/src/generated`.

## Owner decisions still open
Those in `CHANGES-v2.md` section 7 (caps, 3 raid wins per boss gate, move multipliers, reroll count, S5, leaderboard), plus: Scholar's raid cycle is 3.6x a session at level 12 (DECISIONS, second sitting, item 4).
