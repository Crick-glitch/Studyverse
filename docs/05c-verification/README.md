# 05c verification (what ran, and what did not)

The sandbox for this session had **no network**, so `npm install` could not fetch packages: ESLint, Vitest, `tsc` with real
React types, `vite build` and `npm run shots` did **not** run. This folder holds what was run instead. It is evidence about the
components, not a substitute for the project's own checks.

- `build.cjs`, `entry.tsx`, `rr.tsx`, `rq.tsx`, `stubs-*.ts*`, `lucide.tsx`, `zod.ts`: bundle the REAL `AppLayout`, `Hud`, `Hotbar`,
  `MenuOverlay`, `HubScene` with esbuild, using tiny stand-ins for react-router, TanStack Query, the API and Supabase.
- `shots.cjs`, `behave.cjs` (+ `behave-results.txt`): drive that bundle in Chromium with Playwright. 114 checks, 114 passed
  (hotkeys, badges and their names, Menu focus trap/inert/Escape/focus return, session chip countdown, layout metrics at 360/390/768/1280, hub targets, travel wipe, reduced motion).
- `run.cjs`, `vitest-shim.js`, `rr-clean.tsx`, `pure-results.txt`: ran the real test files `badges`, `hotkeys`, `HeroPortrait`, `hubState`,
  `manifest` and the pure part of `summary` (`summary-pure.test.ts`) through a minimal Vitest-compatible shim in Chromium: 53/53.
- `screens/`: screenshots from the harness (fonts are fallbacks, not Pixelify Sans/Lato, so text widths are approximate).

NOT covered by anything here: `AppLayout.test.tsx`, `HubScene.test.tsx`, `TravelWipe.test.tsx`, `queryClient.test.ts`,
`router.test.tsx` (need jsdom + Testing Library), and every API test (need Prisma + PostgreSQL).
Paths inside the scripts are absolute to the sandbox (/tmp, /home/claude); adjust before reusing.
