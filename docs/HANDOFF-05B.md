# Handoff: session 05b (restyle the whole app, game-style navigation)

Branch `rebuild/fullstack-ts`, on top of the 05 art pass. Not committed: review `git status`, then commit.
Note: the `05c` file in the prompt pack replaces the sidebar built here with a HUD, hotbar and Menu overlay (see "Next").

## Done (with evidence)
| Item | Evidence |
|---|---|
| Collapsible left sidebar (pixel icons + labels), icons-only on narrow desktops, drawer on phones | `layouts/Sidebar.tsx`, `AppLayout.test.tsx` (13 tests: links, `aria-current`, collapse + remembered, narrow default, blocked storage, skip link, drawer open/Escape/close button/backdrop/Tab trap/focus return/inert) |
| Top HUD with real `/me` data | `layouts/Hud.tsx`; test reads name, level, XP bar values, energy and streak from a mocked `/me` |
| Every screen restyled (Login, Quest Board, Sessions, Lab, import dialog, Dialog, ConfirmDialog, Tabs, state views, placeholders, battle layout) | `docs/screens/` (56 PNGs: 15 screens x 3 widths + collapsed sidebar + open drawer) |
| Existing behaviour untouched | all 282 earlier web tests pass without edits; 15 new tests added (297 total); shared 57/57 |
| `npm run lint`, `tsc`, `vite build` | all pass (build: 462 kB JS, 39 kB CSS) |
| Layout checks at 390 / 768 / 1280 | `npm run shots -w apps/web`: no horizontal overflow, no console errors, no tap target under 40px |
| WCAG AA contrast | computed from tokens; lowest pairing 5.2:1 (see DECISIONS) |
| Tests have teeth | broke the focus trap, the saved state and the focus handoff on purpose; the matching tests failed each time, then passed once restored |
| Reference galleries for HUD, camp/hub, inventory, skill tree | `docs/ART-REFERENCES.md` rows 11-14 (pages confirmed; images not viewable here) |

## Found and fixed while checking
- The level number was hidden by the star on the XP crest (now on a plate).
- An unbreakable `<code>` in the CSV panel pushed the Lab page 37px wider than a phone.
- Pixel-font "5" reads as "S" at HUD size (HUD numbers use the body font).
- HUD on phones overlapped the name; drawer breakpoint moved from 768 to 640 so tablets keep a nav.

## Not done / honest limits
- **Not compared with real HUD or menu screenshots.** I could not open gallery images. The look comes from the spec and the
  rendered screenshots. Upload two or three screenshots you like and the gaps can be listed.
- **No automated accessibility scan** (axe) yet; session 08 asks for it. Done by hand: roles/names kept, focus rings, focus trap, contrast numbers.
- **No Playwright test files**, only the screenshot tool. Real e2e needs the API and Supabase.
- The mock data in `scripts/mock-api.mjs` is invented for pictures; the real API was never contacted.
- Pixel checkboxes/radios and the select arrow are CSS only; not checked in Firefox or Safari (only Chromium 141 here).
- The Cinzel package is no longer imported but is still a dependency.
- API workspace tests were not run (nothing there changed).

## Owner checks (2 minutes)
`npm install`, `npm run build:shared`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then
`npx playwright install chromium` and `npm run shots -w apps/web`. Open a few PNGs in `docs/screens/`, or run `npm run dev`
and look at the real screens against the real API (the mock data hides any layout issue caused by long real text).

## Next
Run `05c-game-navigation.md`. It deletes this sidebar and its `localStorage` key and builds the HUD/hotbar/Menu from the same pieces:
`layouts/Hud.tsx` (reuse and extend), `ui/useFocusTrap.ts` (the overlay's focus trap), `lib/useMediaQuery.ts`, and the
`AppLayout.test.tsx` cases (replace the sidebar ones, keep the HUD ones). Then `06`.
