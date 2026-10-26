import { useCallback, useState } from 'react';
import { useMediaQuery } from '../lib/useMediaQuery';

export const STORAGE_KEY = 'studyverse.sidebar-collapsed';
/** At or below this width the drawer replaces the sidebar. Keep in step with the media query in Sidebar.module.css. */
export const MOBILE_QUERY = '(max-width: 640px)';
/** Narrow desktops start with icons only (until the player chooses). */
export const NARROW_QUERY = '(max-width: 1100px)';

function read(): boolean | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null; // storage blocked: fall back to the width-based default
  }
}

function write(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* not remembered; nothing else depends on it */
  }
}

/** Collapsed state of the desktop sidebar: the player's saved choice, else icons-only on narrow desktops. */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const narrow = useMediaQuery(NARROW_QUERY);
  const [stored, setStored] = useState<boolean | null>(read);
  const collapsed = stored ?? narrow;
  const toggle = useCallback(() => {
    const next = !collapsed;
    setStored(next);
    write(next);
  }, [collapsed]);
  return { collapsed, toggle };
}
