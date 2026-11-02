# Phase 5 handoff (art, sprites, pixel UI kit)

## State: baseline complete, one honest gap

Everything in the asset list of `05-art-and-sprites.md` exists, is in the manifest and is tested. What was **not** possible: downloading third-party packs (the sandbox could not reach kenney.nl, opengameart.org or itch.io), and looking at the CSS UI kit or `/dev/art` in a real browser (no Chromium could be installed). Sprites, items, effects and scenes were checked as rendered PNGs (`docs/art-sheets/`); the UI kit's CSS (stepped box-shadow borders, button states, bars) is **unverified visually**.

## Checks run

| Check | Result |
|---|---|
| `eslint .` | no problems |
| `npm run typecheck -w packages/shared`, `-w apps/web` | pass |
| `npm run test -w apps/web` | 234 pass (was 51) |
| `npm run build -w apps/web` | pass; no `DevArtPage` chunk in `dist` |
| `npm run typecheck -w apps/api`, API tests | **not run**: `prisma generate` must download an engine from binaries.prisma.sh (blocked here) and tests need Postgres |
| Playwright | not run (no browser available) |

Run `npm install` then `npm run build:shared` first: `packages/shared/dist` is not in the zip and web typecheck fails without it.

## What exists (`apps/web/src/features/art/`)

- `palette.ts`, `grid.ts`, `draw/canvas.ts`: 32-colour palette, material canvas, bake (shade, outline, flash, gray).
- `sprites/`: `hero.ts`, `enemy-kit.ts` + `enemies-beasts.ts` + `enemies-arcane.ts` + `bosses.ts` + `enemies.ts`, `items.ts`, `effects.ts`, `avatars.ts`, `icons.ts`, `scene-kit.ts` + `scenes.ts` + `scenes-hub.ts`.
- `manifest.ts`: every asset by key (`hero.warrior`, `monster.gearwork-golem`, `weapon.quillblade`, `frame.rare`, `avatar.wizard`, `portrait.tank`, `dungeon.archive`, `scene.camp`, `scene.map`, `effect.slash`, `ui.nav.quests`, `ui.flame.2`, `ui.crest`, `ui.energy`).
- `components/`: `Sprite`, `ItemIcon`, `BattleBackground`, `PixelGridSvg`, `MissingArt`, `useReducedMotion`, `integerScale`.
- `kit/`: `PixelPanel`, `PixelButton`, `PixelBar`, `InventorySlot`, `SkillNode`, `StreakFlame`, `XpCrest`, `PixelIcon` (imports the pixel font; import from `features/art/kit`).
- `dev/DevArtPage.tsx` at `/dev/art` (development only).
- Tests: palette vs `tokens.css`, no-emoji scan, manifest (licence, source, no URL, sizes, palette), heroes, enemies (edge clipping, states, silhouettes), components, kit, dev page, router.

Note for later phases: nothing outside `features/art` imports the art yet. Phase `05b` wires `PixelPanel/PixelButton/PixelIcon/StreakFlame/XpCrest` into the real screens.

## Known weaknesses (cosmetic, in order of value)

1. **Heroes:** the three classes differ mainly by headgear and back gear; faces are small and the head is chunky; the kneeling `defeat` pose is cramped.
2. **Backgrounds** look good as flat scenes but have no animation or parallax yet (layers are separate elements with `data-layer` for the battle screen).
3. **Enemy `attack` shifts are small** (1-3 px, clamped to avoid clipping); real lunges belong to Anime.js in phase 06.
4. **Effects** are simple (the slash is thin).
5. `docs/ART-REFERENCES.md` is mostly articles and tutorial hubs rather than screenshot galleries; replace with 6-10 real reference pages when web access allows.

## Remaining for this phase

- Vendor a CC0 / CC-BY pack if the owner wants richer art: follow the shopping list in `docs/ART-RESEARCH.md`, check each licence on the pack's own page, add `kind: 'image' | 'sheet'` manifest entries with `src` under `/assets/vendor/<pack>/` and a `docs`/`ASSETS.md` row. Gameplay code does not change.
- Look at `/dev/art` in a browser (`npm run dev -w apps/web`, open `/dev/art`) and report anything that looks wrong in the UI kit.

## Paste-ready prompt for the next chat

> Read `00-master-context.md`, `05-art-and-sprites.md`, `05b-restyle-and-navigation.md` and `docs/HANDOFF-PHASE5.md`. Phase 5 art and the pixel UI kit are done (see the handoff for what was and was not verified). Run `npm install` and `npm run build:shared`, then run lint, typecheck, test and build and confirm they match the handoff. Then do Phase 05b: replace the top bar with the collapsible pixel sidebar and HUD, and restyle Login, Quest Board, Sessions, Lab, the import dialog, `Dialog`, `ConfirmDialog`, `Tabs` and the state views with the kit in `features/art/kit`. Keep every route, label and ARIA role so existing tests pass; list any test you change. Use Pixelify Sans for headings and HUD only. Report honestly what you could and could not verify (a browser may not be available).
