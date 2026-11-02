# Handoff: art-quality pass (after Phase 5) - FINAL for this session

## What was done
1. **Heroes redrawn** (`apps/web/src/features/art/sprites/hero*.ts`, split into hero-rig / head / body / gear / hero): three classes differ by
   silhouette (Warrior V-torso + spiky hair + cape + big sword; Tank wide body + plumed helm + tower shield; Scholar slim + glasses
   + flaring robe + staff + book). Heads ~40% of height, 2x2 eyes with a glint, five expressions, kneeling defeat.
2. **Animation frames**: heroes and enemies have idle x2 and attack x3 (wind-up, impact, recovery). `manifest.ts` has per-state `anim`
   (frames, ms, loop, still); `Sprite` plays them (idle loops, attack plays once, holds, fires `onAnimationDone`), static under
   reduced motion (attack shows impact). `/dev/art` shows every frame plus a live replay.
3. **Polish**: rim form-shading for the three flat/dark enemies; slash is a thick tapered 3-tone crescent; impact is solid spikes.
4. **docs/ART-REFERENCES.md** replaced with 10 verified screenshot galleries (images themselves could not be viewed).
5. **UI kit** (viewed in Chromium via /dev/art): row spacing fixed, skill node text centred.

## Verification (honest)
- No npm registry in the sandbox: `npm install`, eslint, real vitest, jsdom component tests and `vite build` were NOT run.
- Run here: 167 pure art tests (126 original + 41 new) under a home-made vitest stand-in (negative control confirmed it fails when it
  should); `tsc` 6.0.3 strict on the art sources (repo pins 5.9); esbuild parse of touched TSX; real headless Chromium 141 checks of
  Sprite playback (frame timings 168/95 ms vs spec 150/90, idle ~520 ms, done fires once, reduced motion static, no console errors);
  Chromium screenshots of /dev/art. Fonts were stubbed (Pixelify Sans missing) and React was 19 (repo uses 18).
- **New test files you must run with real vitest**: `sprites/frames.test.ts` (pure, passed under the stand-in) and
  `components/Sprite.frames.test.tsx` (RTL + fake timers; NOT run under vitest; behaviour verified in Chromium instead).

## First things to do on your machine
`npm install && npm run build:shared && npm run lint && npm run typecheck && npm test && npm run build`, then `npm run art:sheets -w apps/web`.
If `Sprite.frames.test.tsx` fails, check fake-timer interaction with `act` first (the Chromium run shows the component behaves).

## Known weak spots / what to fix next
- Warrior palette is very brown (hair, armour, boots); legs are flat black blocks without knee/boot detail.
- Boss idle frames and enemy wind-ups are subtle (generic transforms). Per-enemy `pose.wind` / `pose.idle2` hooks are unused.
- The Scholar's glasses read as a gold bar at 1x; faces are readable only at 3x and up.
- Bar labels are aria-only (not visible) in the kit; left unchanged.
- Hero class weapon sizes are larger than before; re-check item icons still match their in-hand sprites.

## Not started
- Phase 05b (restyle + collapsible sidebar + HUD): its spec file was not in the zip, and the web app's own deps (router, query, supabase) were
  not installable here, so it could not be rendered or tested.
