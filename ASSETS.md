# Assets

Every file group, where it came from and under what terms. All pixel art in the baseline is **original, created for this project** (drawn in code); nothing third-party is vendored except one font.

| Group | Count | Origin | Author | License | Added | Where / modifications |
|---|---|---|---|---|---|---|
| Hero sprites: Warrior, Tank, Scholar x idle/attack/hit/defeat/victory; 6 weapons and 6 armours as separate layers | 15 frames + 12 layers | Original, created for this project | StudyVerse project | Project code license | Phase 5 | Procedural: `apps/web/src/features/art/sprites/hero.ts` |
| Enemies: 9 regular (48 px) x 4 states, 3 bosses (96 px) x 4 states + phase 2 | 51 frames | Original, created for this project | StudyVerse project | Project code license | Phase 5 | `sprites/enemies-beasts.ts`, `enemies-arcane.ts`, `bosses.ts`, composed by `enemy-kit.ts` |
| Item icons (6 weapons, 6 armours, 32 px) and rarity frames (common / uncommon / rare, 36 px) | 15 | Original | StudyVerse project | Project code license | Phase 5 | `sprites/items.ts` |
| Effects: slash, impact, spark, heal, shield, guard-shatter, victory, level-up (32 px frame sheets) | 8 sheets, 36 frames | Original | StudyVerse project | Project code license | Phase 5 | `sprites/effects.ts` |
| Scenes: Archive, Sunken Library, Clockwork Foundry battle backgrounds; camp; dungeon-select map (320x180, far/mid/near) | 5 scenes, 15 layers | Original | StudyVerse project | Project code license | Phase 5 | `sprites/scenes.ts`, `scenes-hub.ts`, `scene-kit.ts` |
| Avatar busts (6, 32 px) and class portraits (3, 40 px) | 9 | Original | StudyVerse project | Project code license | Phase 5 | `sprites/avatars.ts` (portraits are cropped hero layers) |
| UI art: 9 navigation icons, streak flame levels 0-4, XP crest, energy bolt | 16 | Original | StudyVerse project | Project code license | Phase 5 | `sprites/icons.ts` |
| Hotbar and HUD art: campfire (Home), satchel (Menu), HUD portrait frame | 3 | Original | StudyVerse project | Project code license | Phase 5c | `sprites/icons.ts` (`ui.campfire`, `ui.satchel`, `ui.portrait-frame`) |
| Lato (body font) | npm `@fontsource/lato` | Lato Project Authors | SIL OFL 1.1 (**to confirm against the package's LICENSE file**) | Phase 1 | none |
| Palette (32 colours), drawing toolkit | n/a | Original | StudyVerse project | Project code license | Phase 5 | `palette.ts`, `draw/canvas.ts`, `grid.ts`; mirrored in `styles/tokens.css` |
| Pixelify Sans (display font) | npm `@fontsource/pixelify-sans` 5.3.0 (design: Pixelify Sans Project Authors, https://github.com/eifetx/Pixelify-Sans) | Pixelify Sans Project Authors | SIL OFL 1.1 (copy: `apps/web/public/assets/vendor/pixelify-sans/OFL.txt`) | Phase 5 | none |

Third-party art packs: **none vendored** (see `docs/ART-RESEARCH.md` for why and for the manual download list).

Review without a browser: `npm run art:sheets -w apps/web` writes contact sheets to `docs/art-sheets/` (heroes, hero-gear, enemies, bosses, items, effects, avatars, ui, scenes, stages). In development, `/dev/art` shows every manifest asset in every state.

CC-BY attributions would go here and in an in-app credits section; there are none yet.
