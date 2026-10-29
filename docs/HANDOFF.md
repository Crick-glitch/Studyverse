# HANDOFF — Session 06 (battle screen): INCOMPLETE — only Step 0 is built

Branch `rebuild/fullstack-ts`. Base commit `1bcdf1c` (05c verified). This session stopped early at the owner's request.
**Do not describe session 06 as finished. Only Step 0 of P0 is done.** Read `00-master-context.md`, then `06-battle-screen.md`, `04-rpg-design-spec.md` (v2) and `DESIGN-BLUEPRINT.md` as before.

## Done (with evidence)
- **Step 0, `grantXp` extension.** `packages/shared/src/balance.ts` has `DAILY_XP_CAPS` and `FIRST_CLEAR_XP`. `apps/api/src/lib/xp.ts` has optional `dailyCap { group, amount }` and `now`; results add `requested` and `capped`; a capped grant writes a 0 XP ledger row; the player row is already locked so the cap sum cannot race. Tests: `apps/api/src/xpCaps.int.test.ts` (9 tests: parallel grants, capped source stays idempotent, UTC rollover with a fake clock at midnight, group sums, uncapped unchanged, level-up on a partly capped grant, leaderboard flag). Written first, then the code.
- **Step 0, additive migration** `apps/api/prisma/migrations/20261029000000_session06_battle/migration.sql` plus matching `schema.prisma` edits (see `docs/DECISIONS.md`, "Session 06"). `npx prisma validate` and `prisma generate` pass. RLS: no new tables, nothing to enable.

## Checks actually run (after the last edit)
| Command | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` (web, shared, api) | pass |
| API tests (`apps/api`, PostgreSQL 16) | pass, 14 files, 147 tests (includes the 9 new + 11 existing XP tests) |
| shared tests | pass, 57 tests |
| web tests, `npm run build`, Playwright, `scripts/design-shots.mjs` | **NOT run** this session (no web changes yet) |
| `prisma migrate dev` | **NOT run** (schema engine stubbed). The migration SQL is hand-written; run `cd apps/api && npx prisma migrate dev` on a real machine and confirm it reports no drift. |

## Not started (priority order; P0 first, never half-build a tier)
**P0**
1. Shared, pure, tested first: battle constants in `balance.ts` (moves, intent multipliers, strike formula, combo table, boss phases, loot weights, enemy scaling), enemy roster and dungeon/boss tables (`packages/shared`, slugs match `apps/web/src/features/art/sprites/enemies*.ts` and `bosses.ts`), `deriveStats` (level, class, gear effects, skills; there is no derived-stats function yet), battle DTO Zod schemas (move, ability, create, answer, `BattleDto`, `AnswerResultDto`, `BattleSummaryDto`).
2. Pure engine `apps/api/src/battle/engine.ts` (no Express, no Prisma), `(state, action, rng)`; actions `chooseMove`, `armAbility`, `answer`, `continue` (+ retreat). Unit tests incl. every formula in 04, each intent, each move, Brace cancelling Heavy x1.6 and Drain heal, boss phases, Cleave/Bulwark/Insight timing, Second Wind, derived stats with gear, fairness invariants (Insight removes exactly one wrong choice; nothing returns the answer).
3. API under `/api/v1` (table in 06): `POST /battles` (Idempotency-Key, energy deducted in the same transaction, unlock rules, no question in the response), `GET /battles/:id`, `POST /battles/:id/move|ability|answer|retreat|finish`. Reuse `withPlayerLock`, `ensurePlayer`, `getModifiers`, `addEnergy`, `recordQuestEvent`, `applyCardReview`, `buildCardQuizItems`, the question-selection helpers in `services/questions.ts`; follow the claim-quiz snapshot pattern in `services/sessions.ts`. `finish` pays through `grantXp` (raid `battle`/battleId, defeat 40%; practice `battle_practice`/battleId at 25% with `DAILY_XP_CAPS.battle_practice` and `leaderboardEligible:false`, never loot/raid wins/quest wins) and stores `Battle.rewardSummary` so a second call returns the same summary. Rate-limit the answer route (config `RATE_LIMIT_BATTLE_ANSWER_MAX` exists). API tests as listed in 06 (no `correctIndex`/explanation and no question text before the move; answer before move = 409; same move returns the same question; different move = 409; stale/future turn rejected; duplicate answer idempotent; other user 404; double Start with one key deducts energy once; finish twice pays once; practice rules; defeat 40%).
4. Web: `/battle/:battleId` in the existing `BattleLayout` (no HUD, hotbar or camp panel), reducer-based client state machine, move panel (Steady/Brace/Bold with exact effect text), question panel, feedback, ability buttons with Focus pips, intent banner, 3-layer `BattleBackground`, hero/enemy `Sprite` at integer scale, keyboard (`Q/W/E`, `1/2/3`, `Enter`, `A`), refresh resumes from server state, mobile layout (battlefield ~45vh), a minimal start form on `/dungeons`. Rewards screen (XP count-up, cap line, level-up, energy, loot card, missed questions + "Add missed questions to my flashcards" (needs a small endpoint), weak-spot line, defeat "Prepare and retry"). CSS steps for idle/hit (Anime.js is **not installed**; it is P2).
5. Simulation test (`battle-balance.test.ts`, real engine, four policies, targets in 04, XP-per-minute audit); tune `balance.ts`, log final numbers.
6. Design check: render with `scripts/design-shots.mjs` at 1440x900, 1280x800, 768x1024, 390x844, 360x800, look at every shot, fix clipping/overflow/empty space/unreadable text before calling the screen finished.

**P1** (only after P0 is complete): `/dungeons` region map, first-clear reward (`first_clear`/bossSlug + `onFirstClear` hook), boss prep panel, unlock-rule tests. **P2**: Anime.js `useBattleAnimations`, Playwright at both widths. Then, only if budget is left: 05c P2 (quest tracker chip, location banners).

## Design decisions already made (carry over; also in `docs/DECISIONS.md`)
Engine in `apps/api/src/battle/`; seeded RNG derived from `(seed, turn, salt)`; combo uses the streak after the current correct answer; the `BattleTurn` row is created when the turn opens (intent known) and the question is snapshotted when the move is chosen; server phases are `awaitingMove | awaitingAnswer | ended` and `GET` returns `lastResult` (no persisted `feedback` phase); a wrong question may be re-queued once, only if its difficulty fits the chosen move; unlock enforcement lives in `POST /battles` (it is in the P0 API table), the map UI and tests are P1; starter gear (Iron Sword + Leather Armor) is granted lazily when a player with no gear starts a battle, and loot only auto-equips into an empty slot (Camp equipping is session 07); achievements/cosmetics are evaluated in 07, session 06 only leaves the `onFirstClear` hook; Insight removes one wrong choice and gives no hint text; bosses: Wyrm T1, Lich T2, Titan T3.

## Environment notes for the next session
- `binaries.prisma.sh` is blocked: `PRISMA_SCHEMA_ENGINE_BINARY=<stub script that exits 0>` and `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` made `prisma generate` and `prisma validate` work. I used the stub.
- PostgreSQL 16 from apt needed `apt-get update` first; start it with `pg_ctlcluster 16 main start`; create `studyverse_test`; `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studyverse_test`. I had to use this.
- `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` for screenshots: not used yet.
- `npm install` works (no `node_modules` in the zip); run `npm run build:shared` before API tests; run `prisma generate` for `apps/api/src/generated`.

## Owner decisions still open
None new. (The earlier list in `CHANGES-v2.md` section 7 still applies: caps, 3 raid wins per boss gate, move multipliers, reroll count, S5, leaderboard.)
