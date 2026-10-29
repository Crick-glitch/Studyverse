# Handoff: session 05c. VERIFIED by the real toolchain, then redesigned after a desktop design review

## Status (latest)
| Check | Result |
|---|---|
| `npm install` | pass (562 packages) |
| `npm run lint` | pass |
| `npm run typecheck` | pass (needs the Prisma stand-in below in a sandbox without `binaries.prisma.sh`) |
| `npm run test` | pass: web 384, shared 57, API 138 (API run against a local PostgreSQL 16 via `TEST_DATABASE_URL`, not Supabase) |
| `npm run build` | pass |
| `npm run shots -w apps/web` | pass (no overflow, console errors, undersized targets, leftover travel wipe) |
| `node scripts/design-shots.mjs <label>` | pass at 1440x900, 1280x800, 768x1024, 390x844, 360x800: no overflow, no clipping |

**Sandbox only:** `prisma generate` was run with `PRISMA_SCHEMA_ENGINE_BINARY` pointing at a stub script and `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`
(the sandbox blocks `binaries.prisma.sh`). `prisma migrate` / `prisma validate` were NOT run; the test harness applied the migration SQL with `pg`. On your machine none of this is needed.

### Bugs the real toolchain and a browser found (the 371 unit tests could not)
1. **Travel wipe left a gold strip on screen after every route change** (CSS `fill-mode: both` parked the bar at the right edge) and **fired on first load in dev** (a `useRef` "first run" flag does not survive React StrictMode). Fixed; 3 tests added; `route-shots.mjs` now checks it in a real browser.
2. **`flashcards.int.test.ts` was date-dependent**: cards get `dueAt = now()` from the database clock while the test pinned the app clock at 2026-10-23, so once the real date passed it every new card looked "not due" (6 failures). The test clock now starts mid-January of next year.
3. **XP bar clipped on a 360 px phone with a running session**: the 5th (empty) segment was cut off, so an 80% bar looked 100% full. Now 4 segments at <=380 px and 8 px side padding; `design-shots.mjs` fails on any HUD/hotbar clipping.

### Desktop design review (owner feedback on the 1280 px render)
The first implementation followed 05c's desktop numbers literally (64 px HUD, ~640 px hotbar, 2x scene) and had never been looked at on a desktop. Measured at 1280x800: HUD + bottom hotbar = 156 px (20% of the height) while the page used 50-75% of the width;
three unrelated alignment axes (HUD x=24..1416, content x=170..1270, hotbar x=400..1040 at 1440); a 48 px portrait and 17 px name were the smallest things in the HUD; energy and streak were bare numbers; the first content card started at y=488.
New design (decisions in `docs/DECISIONS.md`, "Desktop design review"):
- **>= 1024 px: a left "camp panel"** (264 px, `AppLayout` `data-rail`): player card (72 px portrait, name, level and class, full-width XP bar with numbers, labeled Energy and Streak, unspent skill points, session timer) above the same hotbar as a vertical slot list with visible key caps; Menu pinned to the bottom. The page gets the full height.
- **< 1024 px: unchanged model** (top HUD bar + bottom hotbar), hotbar now full width on tablets, resource labels visible from 641 px up.
- Home on desktop (>= 1280 px): camp scene and dashboard column side by side. Menu overlay: dimmed (not opaque), centred on desktop, full-height sheet with Sign out at the bottom on phones.

### Not done / known issues
- **05c P2 (quest tracker chip, location banners) and session 06 are NOT started.**
- The lower half of Home is empty on desktop because the dashboard is still a placeholder (session 07), not because of the shell.
- Hotbar says "Library" but the page title says "Lab" (and "Quests" vs "Quest Board", "Study" vs "Study Sessions"); other placeholders still use the old "Phase N" labels. Align in 07.
- **Not tested:** landscape phones (e.g. 844x390: the compact layout would spend ~40% of the height on bars), windows shorter than 800 px high (the panel scrolls; only 800 and 900 high were measured), widths above 1440, Firefox/Safari, real touch devices, reduced-motion rendering.
- Hero art (portrait) is still the weakest art; the scene stays 2x on large screens (could be 3x when content is wider than ~1000 px).
- "Skip scene" in-flow-on-focus shift is still inferred from CSS, not observed.

## Exact next prompt
"Continue StudyVerse from docs/HANDOFF-05C.md. Start with 05c P2 (quest tracker chip, location banners) only if I say so; otherwise run session 06 (06-battle-screen.md) with Step 0 first, tests first, P0 before anything else."

---

## Older notes (kept for history; the "Status" section above is current)

**The network was off again** (DNS for registry.npmjs.org does not resolve; `vitest`, `vite`, `jsdom`, `eslint`, `zod`, `react-router`,
`@testing-library/*` and Prisma are not on disk). So `npm install` and everything that needs it **did not run**:
`npm run lint`, `typecheck`, `test` (web, shared, api), `build`, `npm run shots`, `prisma generate`.
Nothing below should be read as "the project's checks pass". They have not been run on the 05c code by anyone.

## What this pass did
**1. Read every unrun web test line by line against its component** (the three failure areas you predicted, plus the rest):
`AppLayout.test.tsx`, `HubScene.test.tsx`, `TravelWipe.test.tsx`, `queryClient.test.ts`, `router.test.tsx`, `useMediaQuery.test.tsx`.
- *jsdom `matchMedia`*: the source (`useMediaQuery`, `useReducedMotion`) is already guarded with `typeof window.matchMedia === 'function'`,
  and every test that installs a fake also deletes it in `afterEach`. No defect found.
- *Session-chip countdown tests*: they use the same `vi.spyOn(performance, 'now')` mechanism as the baseline `useSessionClock.test.ts`
  (which passed), the anchor is taken when the chip mounts, and a 500 ms tick re-reads the clock. On paper they pass (13:00 -> 12:57 after +3 s).
- *Accessible names*: each expected string (`Library, 12 cards due`, `Hero, 2 unspent skill points`, `Quests, 1 quest ready to claim`,
  `Adventure, 4 energy, enough for a raid`, hub prop names, `Study session running...`) was traced to the code that builds it (`plural()`, `slotBadge()`,
  `hubProps()`). They match.
- `inert` is set as a **property** (`page.inert = menuOpen`); jsdom has no `inert`, so it becomes a plain expando and the tests read the property back
  (works). In real Chromium it is the real thing (covered by the harness).
- `LocalImportPrompt` (rendered for real by `AppLayout`'s `ImportGate`) guards every storage read, so the "storage blocked" test cannot crash it.
- **Result: no definite defect found. That is "plausible on paper", not "passes".**

**2. Compiler pass** with the one real compiler available (global TypeScript 6.0.3), over `apps/web/src`, `packages/shared/src` and the API summary files,
with the repo's `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, plus `noUnusedLocals/Parameters`. Every remaining diagnostic is caused by
missing third-party types (React JSX runtime, `import.meta.env`, `PixelButtonProps` extending React attributes) and appears in untouched baseline files too.
**None** of: unused symbols, undefined names, missing exports from local modules, missing `import type`. (Not a substitute for `tsc -b` with real types.)

**3. API read against `schema.prisma`:** every field in `services/summary.ts` exists with that name and type; `periodKey` and
`BALANCE.sessions.staleOpenHours` exist in shared; `buildTestApp(prisma, {}, clock)`, `noDb`, `createTestPrisma`, `hasTestDb`, `newPlayer`, `client`, `runSeed` exist
with those signatures; auth middleware is mounted before the summary router, and `UNAUTHENTICATED` is the real error code. The `sessions.ts` refactor
(`sessionElapsedSec` moved to `sessionTime.ts` and re-exported) is behaviour-preserving and nothing else used the removed `TimedSession` type.

**4. Fixed (three real things):**
- **ESLint would have failed on `docs/05c-verification/*`** (16 files with `any`, `require()` in `.cjs`, no globals). `eslint.config.js` now ignores `docs/**`.
- **"Skip scene" link was 26 px tall while parked off-screen.** `route-shots.mjs`'s own audit flags targets under 40 px, so `npm run shots` would have exited non-zero on Home
  at every width. `HubScene.module.css` now gives it a 44 px minimum height in every state. Found by running that audit's exact logic on the harness; after the fix 18/18 state x width
  combinations are clean.
- **`apps/api/.env.example` and `apps/web/.env.example` were missing** (the previous zip stripped `.env*` and git showed them deleted). Restored from git; they hold only public values/placeholders.

**5. Executed for the first time:** `apps/web/scripts/mock-api.mjs` (the `/summary` shape equals the DTO's exact key set; `hud-session` and `hotbar-quiet` scenarios behave as `route-shots.mjs` assumes).
Both `.mjs` scripts pass a syntax check and an unused/undefined-name check.

**6. Re-ran the Chromium harness from the repo** (it was not reproducible from the zip: `global-nofont.css` was a lost scratch file; `build.cjs` now generates it).
114/114 behaviour checks, 53/53 pure test cases through the shim, layout audit clean. See `docs/05c-verification/README.md` for exact reproduce steps and what it does **not** cover.

**7. Looked at the screenshots** (harness renders: fallback fonts, stubbed data, **not** `npm run shots`): home hub, Menu, session chip, quiet hotbar at 390 / 768 / 1280.
They read as a game UI. Details in "Honest look".

## (Historical) DO THESE FIRST: done, see "Status" above
```
npm install
npm run lint
npm run typecheck
npm run test                       # web, shared, api; for the DB tests set TEST_DATABASE_URL (database name must contain "test")
npm run build
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run shots -w apps/web   # regenerates docs/screens (still the PRE-05c set)
```
If something fails, where I would look first (ordered by my own risk estimate, which is a guess):
1. `AppLayout.test.tsx`: any `findByRole(... name: ...)` that fails: dom-testing-library's name algorithm can differ from Chromium's on `title` vs content; compare with `hotbar().getAllByRole('link').map(a => a.getAttribute('aria-label'))`.
2. `useFocusTrap` Tab tests: they rely on DOM order `close, 3 links, Credits, checkbox, Sign out`.
3. React Router version-specific warnings are not failures. Real TanStack Query, `MemoryRouter` and Testing Library are exactly what the harness replaced, so the first run of those is the first run.
4. API: `prisma generate` must run before `tsc -b`; `summary.int.test.ts` is skipped without `TEST_DATABASE_URL`.
5. ESLint: I scanned the 44 touched TS/TSX files for `any`, `@ts-ignore`, empty blocks, `var`, `eval` (none) and for unused symbols via tsc (none). `react-hooks/exhaustive-deps` is the rule I could only check by reading (`AppLayout`, `HubScene`, `useFocusTrap`, `TravelWipe`; no issue seen).

## Not started
- **P2** (quest tracker chip, per-screen location banners): the spec says only that and the owner has not said whether they want it. Not built.
- **Session 06**: deliberately NOT started. The pack's own rule (README step 3) says not to start the next phase while checks have not passed, and 06 adds a migration,
  a battle engine and routes on top of a baseline that has never been verified. Do the block above first.
- Next-action hub marker is built but nothing passes it until session 07. Gate `locked` sprite is unused until session 06's unlock rules.

## Owner decisions / to confirm
1. Lato licence line in the in-app Credits and `ASSETS.md` (written from knowledge): confirm against `node_modules/@fontsource/lato/LICENSE` after `npm install`.
2. Avatar preset names in `packages/shared/src/avatars.ts` (mage/ranger/guardian) differ from art ids (wizard/elf/knight); `portraitSource()` maps them; unify in session 07.
3. Real screens still say "Lab", "Quest Board", "Study Sessions" while the hotbar says Library/Quests/Study: align in 07.
4. Energy is a count, not "pips" (05b decision kept).
5. The summary adds `serverNow`, `pausedAt`, `remainingSec` beyond 05c's shape (`docs/DECISIONS.md`, Phase 5c #1).
6. **NEW: do you want P2?** And do you want the Menu to become a full-height journal on phones (see below)?

## Honest look (written BEFORE the desktop design review; superseded by the review section above)
HUD, hotbar, Menu and hub scene read as a game interface: gold-framed raised slots, pixel icons, a portrait in a frame, a camp whose props are links, a calm quiet state with no badges,
and a session chip that replaces some XP-bar segments instead of crowding the row. Weakest parts, in order:
1. **Menu**: a flat parchment card; on a phone it is top-aligned and the bottom third is empty dark green (not full-screen as 05c describes). Upgrade first together with the hub props.
2. **HUD portrait** is small (48 px, forced by the 56/64 px height limit); a purpose-drawn 18x18 face would help.
3. Hub props are simple flat shapes with no animation; campfire and satchel icons are plain.
4. "9+" badge slightly overlaps the flask icon on 390 px.
5. "Skip scene" is in the flow when focused (`position: static` in the CSS), so it should shift the scene down by its own height; inferred from the CSS, not observed.

## Exact next prompt
"Run the block under 'DO THESE FIRST' from docs/HANDOFF-05C.md and paste me every failure. Fix them in the order listed under 'where I would look first'. When lint, typecheck, test (web, shared, api) and build pass and you have looked at the new docs/screens (menu-open, hud-session, hotbar-quiet, dashboard at 390/768/1280), commit, then tell me whether to do P2 or go straight to session 06."
