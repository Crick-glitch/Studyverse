# Art references (study only)

Screenshot galleries of shipped pixel-art RPGs, used for **composition, proportion, animation conventions, menu/HUD layout and mood only**.
Nothing is copied, traced or recreated; no third-party image is vendored (see `ASSETS.md`). Every link below was opened
and confirmed to be a real gallery page listing numbered screenshots.

**What I could and could not check.** The pages and their screenshot counts were verified. This environment cannot
fetch the images themselves, so the one-line takeaways come from what these games are widely known for, not from
inspecting these specific screenshots. If you upload a few screenshots from the galleries, they can be compared directly.

| # | Gallery | Shots | What to study |
|---|---|---|---|
| 1 | RPGFan, Chrono Trigger: https://www.rpgfan.com/gallery/chrono-trigger-screenshots/ | 22 | Chibi proportions: head about a third of the body, readable at tiny sizes; each hero identifiable by hair and silhouette alone; battle stances. |
| 2 | RPGFan, Chrono Trigger (2018 release): https://www.rpgfan.com/gallery/chrono-trigger-2018-screenshots/ | n/a | Same sprites under a different frame and UI: how the HUD frames a battle without covering the combatants. |
| 3 | RPGFan, Chrono Trigger (2008 release): https://www.rpgfan.com/gallery/chrono-trigger-2008-screenshots/ | n/a | Battle layout at a small canvas: party left, enemies right, menu below. |
| 4 | Time Extension, Chrono Trigger: https://timeextension.com/games/snes/chrono_trigger | 12 | Curated shots across the game: variety of enemy silhouettes, boss scale versus party scale. |
| 5 | RPGFan, Final Fantasy VI (Pixel Remaster): https://www.rpgfan.com/gallery/final-fantasy-vi-pixel-remaster-screenshots/ | 19 | Side-view party lineup; class identity through silhouette (cape, helm, robe) and colour; kneeling low-health pose. |
| 6 | RPGFan, Final Fantasy VI (1999): https://www.rpgfan.com/gallery/final-fantasy-vi-1999-screenshots/ | 12 | The original low-resolution look: how few pixels carry a face and a class. |
| 7 | RPGFan, Final Fantasy VI (2014): https://www.rpgfan.com/gallery/final-fantasy-vi-2014-screenshots/ | 15 | Menu, equipment and status screens: slot grids and panel framing for the Camp screens. |
| 8 | RPGFan, Sea of Stars: https://www.rpgfan.com/gallery/sea-of-stars-screenshots/ (page 2: `?page=2`) | 90 | Modern take on 16-bit: larger sprites with expressive faces, soft light on flat pixels, layered backgrounds with parallax depth. |
| 9 | RPGFan, Sea of Stars: Throes of the Watchmaker: https://www.rpgfan.com/gallery/sea-of-stars-throes-of-the-watchmaker-screenshots/ | 25 | Clockwork environments: reference for the Clockwork Foundry mood. |
| 10 | RPGFan, Sea of Stars: Dawn of Equinox: https://www.rpgfan.com/gallery/sea-of-stars-dawn-of-equinox-screenshots/ | 13 | Effects and combat feedback: how impact and spell effects read against sprites. |
| 11 | RPGFan, CrossCode: https://www.rpgfan.com/gallery/crosscode-screenshots/ (page 2: `/2/`) | 68 | **HUD.** A pixel game that keeps a lot of live numbers on screen (health, resources, skill shortcuts) in small framed corners. Look at what stays visible during play and what hides in menus, for the HUD in `05b` and the in-battle bars in `06`. Also the circuit-style skill menu: layout for the Camp skill tree. |
| 12 | RPGFan, CrossCode: A New Home: https://www.rpgfan.com/gallery/crosscode-a-new-home-screenshots/ | 20 | Extra menu and town screens from the same UI: a second look at how one frame style is reused for every panel. |
| 13 | RPGFan, Eastward: https://www.rpgfan.com/gallery/eastward-screenshots/ | 31 | **Inventory and camp/hub.** Item-slot grids with rarity or category cues, item detail panels, and cosy campsite and town scenes that double as a hub. Reference for the Camp inventory, equipment slots and the camp scene in `07`. |
| 14 | RPGFan, Chained Echoes: https://www.rpgfan.com/gallery/chained-echoes-screenshots/ | 18 | **Skill tree and equipment.** A 16-bit-style game with a grid-based skill and gear screen: how nodes, connections and locked/available/unlocked states are drawn, for the Might/Guard/Mind graph in `07`. |

## How these guided the redraw

- **Proportions.** Heroes now have heads about 40% of sprite height (was about 30%), after the chibi ratios in 1, 5 and 8.
- **Class by silhouette.** Warrior (broad V torso, spiky hair, headband, cape), Tank (wide boxy body, plumed helm, tower
  shield) and Scholar (slim, long hair, glasses, flaring robe, staff, held book) differ in outline, not just headgear.
- **Faces.** A 2x2 eye with one glint pixel, brows, a mouth, and five expressions (calm, fierce, wince, closed, happy).
- **Animation.** Two-frame idle, and a three-beat attack (wind-up, impact, recovery) for every hero and enemy.
- **Kneeling defeat.** A kneeling pose leaning on the planted weapon, after the low-health stance in 5.
- **Effects.** Thicker, three-tone strokes and spikes with a bright core, not hairlines.

## Menus, HUD, inventory and skill trees (galleries 11-14)

Added in the `05b` session because the first ten galleries were almost all battle screens, while `05` asks for HUD,
camp/hub, inventory and skill-tree layouts too. Same limits as above: each page and its screenshot count was confirmed,
the images themselves could not be opened here.

Where each is meant to be used:

| Need | Look at | Used in |
|---|---|---|
| Always-visible HUD (level, XP, resources, streak) | 11 | `05b` HUD (done, built from the spec, not from these shots) and the battle bars in `06` |
| Camp / hub scene with clickable places | 13 (campsites, towns), plus the camp scene already in `docs/art-sheets/scenes.png` | `07` Camp |
| Inventory grid, item detail, equip comparison | 13 | `07` Camp inventory (the `InventorySlot` kit piece already exists) |
| Skill tree graph with locked / available / unlocked nodes | 11, 14 | `07` Camp skill tree (the `SkillNode` kit piece already exists) |

## Still to do with real references
- The `05b` sidebar and HUD were designed from the spec and checked against rendered screenshots of this app
  (`docs/screens/`), **not** against galleries 11-14. If you upload two or three screenshots of a HUD or menu you like,
  they can be compared directly with `docs/screens/` and the gaps listed.
- Compare the redrawn heroes against galleries 1, 5 and 8 side by side and list what still feels flatter than the references.
- Study 8 and 10 for sprite lighting and for impact effects that interact with the target.
- Before `07`: open 13 and 14 for the inventory and skill-tree screens and write down slot size, node spacing and how
  locked nodes are dimmed, so Camp is built against something concrete.
