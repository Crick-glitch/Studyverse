# Handoff: session 05c (game-style navigation), STOPPED EARLY on the owner's request

## Done (evidence in brackets)
- **P0 built:** `GET /api/v1/summary` (shared `SummaryDto`, `services/summary.ts`, `routes/summary.ts`, registered in `app.ts`);
  slim HUD (portrait link to `/camp` with "!" for skill points, level, XP bar, energy, flame, session chip with server-time countdown);
  bottom hotbar (Home/Quests/Study/Library/Adventure + Menu) with live badges and hidden text equivalents; hotkeys 1-5, M, H with the on/off switch;
  Menu overlay (Progress, Leaderboard, Settings, Credits, shortcut toggle, Sign out; focus trap, inert background, focus return);
  sidebar, `useSidebar`, the drawer and `studyverse.sidebar-collapsed` DELETED; new sprites `ui.campfire`, `ui.satchel`, `ui.portrait-frame`.
- **P1 built:** Home hub scene (`scene.hub` + seven prop sprites `prop.*` with states, `ui.marker`), `HubScene`, `HomePage`, state-reactive names; travel wipe.
- Browser harness: 114/114 behaviour checks in Chromium; 53/53 pure test cases through a shim; art contact sheet looked at; screenshots viewed at 390/768/1280 (see `docs/05c-verification/`).

## NOT RUN (do these first)
In this session's sandbox (no network) none of these ran:
`npm install`, `npm run lint`, `npm run typecheck` (only a shimmed `tsc`, which found no real type errors in the new files but had no React types),
`npm run test` (web, shared AND api), `npm run build`, `npm run shots -w apps/web`, `prisma generate`, any API test.
**Baseline was not re-verified** (you reported eslint/tsc clean, vite build ok, web 297/297, shared 57/57). Expect to fix small lint/type nits.

## Tests (written, UNRUN under real Vitest)
- API: `summary.test.ts` (pure + 401), `summary.int.test.ts` (needs `TEST_DATABASE_URL`).
- Web new: `layouts/hotkeys.test.ts`, `badges.test.ts`, `HeroPortrait.test.ts`, `TravelWipe.test.tsx`, `features/hub/hubState.test.ts`, `HubScene.test.tsx`, `lib/queryClient.test.ts`.
- **Replaced/changed (you asked for this list):**
  1. `layouts/AppLayout.test.tsx`: ALL sidebar/drawer tests (collapse, persisted collapsed key, drawer open/close, Escape, focus trap, inert, `aria-current` in the sidebar) replaced by hotbar, hotkey, Menu-overlay tests. HUD tests KEPT (name/level/XP/energy/streak) except: the `Log out` button assertion and the "signs out from the HUD" test (sign-out moved to the Menu; covered by the Menu "Sign out" test). Added HUD tests: portrait link, "!" , session chip, paused chip, phone level plate.
  2. `router.test.tsx`: placeholder headings `Camp`->`Hero`, `Dungeons`->`Adventure`, `Stats`->`Progress`; `api.summary` mock added; two tests added (login has no hotbar/HUD; hotbar destinations).
  3. `features/art/manifest.test.ts`: scene count 2 -> 3 and a prop count (7).
- Most likely first failures: jsdom `matchMedia` handling in `AppLayout`/`HubScene` tests, the two countdown tests (they mock `performance.now` and wait for the chip's 500 ms tick), and `findByRole` name strings.

## Not started
- **P2:** quest tracker chip, per-screen location banners.
- `docs/screens/` was NOT regenerated (the `shots` tool needs vite). `route-shots.mjs` and `mock-api.mjs` were edited for the new navigation (sidebar shots removed; menu-open, hud-session, hotbar-quiet added; `/summary` mocked) but never executed.
- Next-action marker is built (`<HubScene nextAction=...>`) but nothing passes it until session 07.
- Gate `locked` sprite is drawn but unused until session 06 unlock rules.

## Owner decisions / to confirm
1. Lato licence line in the in-app Credits and `ASSETS.md` (written from knowledge): confirm against `node_modules/@fontsource/lato/LICENSE`.
2. Avatar preset names in `packages/shared/src/avatars.ts` (mage/ranger/guardian) differ from the art ids (wizard/elf/knight): `portraitSource()` maps them; unify in session 07.
3. Real screens still say "Lab", "Quest Board", "Study Sessions" while the hotbar says Library/Quests/Study: align in 07.
4. Energy is shown as a count, not "pips" (05b decision kept).
5. The summary adds `serverNow`, `pausedAt`, `remainingSec` beyond 05c's shape (see `docs/DECISIONS.md`, Phase 5c #1).

## Honest look
The HUD, hotbar and Menu read as a game UI (gold-framed raised slots, pixel icons, portrait in a frame), and the hub scene has live props. Weakest parts: the HUD portrait is small (48 px, forced by the 64/56 px height limit); the campfire and satchel icons are plain; props are simple (flat shapes, no animation); the Menu is a flat parchment card. Upgrade first: the hub prop art and the HUD portrait (a purpose-drawn 18x18 face), then the Menu look.

## Exact next prompt
"Continue StudyVerse 05c from docs/HANDOFF-05C.md. Network may be on now: run `npm install`, then lint, typecheck, vitest (web, shared, api; api with TEST_DATABASE_URL if available), build. Fix everything that fails, starting with the tests listed under 'Most likely first failures'. Then run `npm run shots -w apps/web` (PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome) and LOOK at menu-open, hud-session, hotbar-quiet and the home hub at 390/768/1280. Then P2 (quest tracker chip, location banners) if wanted, then session 06."
