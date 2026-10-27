import { ROUTES } from '@studyverse/shared';

export type HotbarId = 'home' | 'quests' | 'study' | 'library' | 'adventure';

export interface HotbarSlot {
  id: HotbarId;
  to: string;
  label: string;
  /** The key that jumps here (also shown in the slot's tooltip). */
  hotkey: string;
  /** Manifest key of the pixel icon. */
  sprite: string;
  /** Match only the exact path (Home lives at "/"). */
  end?: boolean;
}

/** The five things you do daily, in hotbar order (05c section 2). Slot n answers to key n. */
export const HOTBAR: readonly HotbarSlot[] = [
  { id: 'home', to: ROUTES.dashboard, label: 'Home', hotkey: '1', sprite: 'ui.campfire', end: true },
  { id: 'quests', to: ROUTES.quests, label: 'Quests', hotkey: '2', sprite: 'ui.nav.quests' },
  { id: 'study', to: ROUTES.sessions, label: 'Study', hotkey: '3', sprite: 'ui.nav.sessions' },
  { id: 'library', to: ROUTES.lab, label: 'Library', hotkey: '4', sprite: 'ui.nav.lab' },
  { id: 'adventure', to: ROUTES.dungeons, label: 'Adventure', hotkey: '5', sprite: 'ui.nav.dungeons' },
];

export const MENU_HOTKEY = 'M';
export const HERO_HOTKEY = 'H';
/** The Hero screen (opened from the HUD portrait). */
export const HERO_ROUTE = ROUTES.camp;

export interface MenuLink {
  to: string;
  label: string;
  sprite: string;
}
/** Everything else, in the Menu overlay. Same routes as before; only the labels follow the game's wording. */
export const MENU_LINKS: readonly MenuLink[] = [
  { to: ROUTES.stats, label: 'Progress', sprite: 'ui.nav.stats' },
  { to: ROUTES.leaderboard, label: 'Leaderboard', sprite: 'ui.nav.leaderboard' },
  { to: ROUTES.settings, label: 'Settings', sprite: 'ui.nav.settings' },
];
