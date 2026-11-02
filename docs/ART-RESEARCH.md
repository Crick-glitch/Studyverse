# Art research (Phase 5, Step 1) - PARTIAL, honest notes

**How this was done.** Web search worked; direct downloads did not. From the build sandbox `kenney.nl`,
`opengameart.org` and `itch.io` fail DNS resolution (`github.com` and the npm registry are reachable). So
**no third-party pack was downloaded or vendored.** Everything below comes from search-result pages, not from
opening the downloaded files. Re-check the license on the pack's own page at the moment you download it.

## Candidates

| Pack | Author | Where seen | License (as seen) | Size | Covers | Verdict |
|---|---|---|---|---|---|---|
| Tiny Dungeon | Kenney | kenney-assets.itch.io/tiny-dungeon, opengameart.org/content/tiny-dungeon | CC0 | 16x16 | heroes, monsters, items, tiles | Licence fine. Too small for our 48/64/96 px sprites and a different style from the procedural art; possible later for tiny item/tile accents only. |
| Tiny Creatures | Clint Bellanger | opengameart.org/node/160872, clintbellanger.itch.io/tiny-creatures | CC0 | small | creatures | Same size/style problem. |
| DungeonTileset II | 0x72 | 0x72.itch.io/dungeontileset-ii | CC0, stated by the author in the page comments (not a licence field) - confirm on download | 16x16 | characters, monsters, tiles | Same size problem; confirm licence wording first. |
| Pixel UI pack (750 assets) | Kenney | opengameart.org/content/pixel-ui-pack-750-assets | CC0 | small UI sprites | panels, buttons, icons | Best candidate to vendor if you want a downloaded UI kit; our CSS/SVG kit is the baseline. |
| "Backgrounds" (RPG battle) | Nidhoggn (OpenGameArt) | OpenGameArt search result | CC0 as shown in the snippet; **URL not recorded - re-find and re-check** | single images, not layered | battle backgrounds | Would need splitting into far/mid/near layers. |
| Battle Backgrounds Pack 5 | Ansimuz | ansimuz.itch.io/battle-backgrounds-pack-5 | licence not visible in what I saw | - | battle backgrounds | **Rejected until the owner checks the licence.** |
| 101 Pixel Art RPG Backgrounds | marcomyly (itch.io) | marcomyly.itch.io/101-pixel-art-rpg-backgrounds-16-bit-fantasy-scenes-1280720-parallax-ready | custom terms | 1280x720 | backgrounds | **Rejected: custom, non-CC0/CC-BY terms.** |
| Space Merc Redux techno dungeon backgrounds | (OpenGameArt) | opengameart.org/content/space-merc-redux-techno-dungeon-backgrounds | not re-checked | - | sci-fi backgrounds | Rejected on theme (sci-fi). |
| Kenney "Complete UI Essential Pack" | Kenney | only a third-party roundup page said "CC BY 4.0" | **unverified** | - | UI | Not used. |
| Pixelify Sans (font) | Pixelify Sans Project Authors | fontsource.org, jsdelivr, npm `@fontsource/pixelify-sans` | OFL-1.1 (I read the `LICENSE` file inside the installed package: "Copyright 2021 The Pixelify Sans Project Authors") | - | pixel display font | **Used.** Installed, license copied to `apps/web/public/assets/vendor/pixelify-sans/OFL.txt`. |

## Decision
All art in the baseline is **original and procedural** (see `docs/HANDOFF-PHASE5.md`). The packs above are all
16x16-scale and would clash with the 48-96 px procedural sprites ("do not mix many styles"), so they are not needed
for the baseline.

## Manual shopping list (only if you want vendored art later)
Download from the pack's own page, confirm the licence there, and put files + the licence text in
`apps/web/public/assets/vendor/<pack-name>/`, then add manifest entries (`kind: 'image' | 'sheet'`):
1. Kenney Pixel UI pack (CC0) - optional UI sprites.
2. A CC0/CC-BY layered battle-background pack at ~320x180 (none confirmed yet).
3. Optional: Kenney Tiny Dungeon (CC0) for small decorative icons only.
