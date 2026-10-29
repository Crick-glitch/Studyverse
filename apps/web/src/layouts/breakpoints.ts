/** At or below this width the phone layout applies (HUD shows fewer parts, hotbar spans the screen).
 *  Keep in step with the 640px media queries in the layouts/*.module.css files. */
export const MOBILE_QUERY = '(max-width: 640px)';

/** From this width up the player and the navigation live in a left "camp panel" (AppLayout); below it the layout is the
 *  top HUD bar plus the bottom hotbar. The layout is chosen in JavaScript (one set of focusable elements, never two), so
 *  no CSS needs to repeat this number. */
export const DESKTOP_QUERY = '(min-width: 1024px)';

/** Phones narrower than this (a 360 px Android) cannot fit a 5-segment XP bar beside the session chip. */
export const NARROW_QUERY = '(max-width: 380px)';
