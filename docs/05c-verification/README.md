# 05c verification (what ran, and what did not)

Two sandboxes had **no network**, so `npm install` could not fetch packages. ESLint, Vitest, `tsc` with real React types,
`vite build` and `npm run shots` have **never run** on the 05c code. This folder holds what was run instead. It is evidence
about the components and the logic, **not a substitute for the project's own checks**.

## Reproduce (paths are absolute inside the scripts)
```
cp -r docs/05c-verification /tmp/h && cp -r docs/05c-verification /tmp/t && mkdir -p /tmp/h/out
ln -sfn "$PWD" /home/claude/work/repo            # the scripts import the repo from here
node /tmp/h/build.cjs                            # esbuild bundle of the REAL AppLayout/Hud/Hotbar/MenuOverlay/HubScene
node /tmp/h/behave.cjs                           # 114 behaviour checks in Chromium
node /tmp/h/layout-audit.cjs                     # route-shots.mjs's own overflow / <40px-target audit on every 05c state x 390/768/1280
node /tmp/h/shots.cjs /tmp/h/shots               # screenshots
node /tmp/mock-check.mjs                         # (copy of mock-check.mjs) executes apps/web/scripts/mock-api.mjs scenarios
```
Needs Playwright + esbuild (global installs here: `/home/claude/.npm-global/lib/node_modules/{playwright,tsx/node_modules/esbuild}`)
and Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. `build.cjs` generates `global-nofont.css` from the real
`global.css` (fonts are not installable offline, so text widths in the screenshots are approximate).

## What each piece covers
- `build.cjs`, `entry.tsx`, `rr*.tsx`, `rq.tsx`, `stubs-*.ts*`, `lucide.tsx`, `zod.ts`: the real components with tiny stand-ins for
  react-router, TanStack Query, the API and Supabase. **Because the router and query client are stand-ins, their real behaviour
  is not exercised.**
- `behave.cjs` (+ `behave-results.txt`): 114/114 (hotkeys, badges and their accessible names, Menu focus trap / inert / Escape / focus
  return, session chip countdown, layout metrics at 360/390/768/1280, hub targets, travel wipe, reduced motion). Uses Playwright's
  role engine in real Chromium, not jsdom / dom-accessibility-api.
- `layout-audit.cjs` (+ `layout-audit-results.txt`): the same overflow and "target under 40 px" audit that `route-shots.mjs` applies,
  run on 6 states x 3 widths. It found one real problem (the hub's "Skip scene" link was 26 px tall while parked off-screen); fixed in
  `HubScene.module.css`; now nothing flagged. (The harness's own "Last field" fixture input is excluded.)
- `run.cjs`, `vitest-shim.js` (+ `pure-results.txt`): the real test files `badges`, `hotkeys`, `HeroPortrait`, `hubState`, `manifest` and
  the pure part of `summary` (`summary-pure.test.ts`) through a minimal Vitest-compatible shim in Chromium: 53/53.
- `mock-check.mjs` (+ `mock-check-results.txt`): executes `apps/web/scripts/mock-api.mjs` and checks the `/summary` shape and the
  `hud-session` / `hotbar-quiet` scenarios the screenshot script relies on.
- `screens/`: harness screenshots (default = /quests, home = hub, menu, quiet = no badges, session = running-session chip).

## NOT covered by anything here
`AppLayout.test.tsx`, `HubScene.test.tsx`, `TravelWipe.test.tsx`, `queryClient.test.ts`, `router.test.tsx` (need jsdom + Testing
Library; read line by line against the components in the second session, no defect found, but **unrun**), every API test (need Prisma +
PostgreSQL), ESLint, `tsc -b`, `vite build`, and `npm run shots`.
`docs/screens/` (written by `npm run shots`) is still the PRE-05c set (sidebar era): regenerate it.
This folder is excluded from ESLint (`eslint.config.js`): it is evidence tooling, not product code.
