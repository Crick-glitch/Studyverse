import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { LocalImportPrompt } from '../features/import/LocalImportPrompt';
import { useSummary } from '../features/summary/useSummary';
import { api } from '../lib/api';
import { useMediaQuery } from '../lib/useMediaQuery';
import styles from './AppLayout.module.css';
import { MOBILE_QUERY } from './breakpoints';
import { Hotbar } from './Hotbar';
import { type HotkeyAction, useHotkeys, useHotkeysSetting } from './hotkeys';
import { Hud } from './Hud';
import { MenuOverlay } from './MenuOverlay';

/** Offers the old-save import once the player's id is known (never imports by itself). */
function ImportGate() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  return me.data ? <LocalImportPrompt userId={me.data.user.id} /> : null;
}

/**
 * Signed-in shell, game style (05c): a slim HUD on top, the page in the middle, the hotbar at the bottom and the
 * Menu as a pause-menu overlay. While the Menu is open everything behind it is `inert`, so focus and screen readers
 * stay inside it; closing returns focus to the Menu slot. The battle and login routes do not use this layout, so
 * they have no HUD and no hotbar.
 */
export function AppLayout() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const summary = useSummary();
  const { enabled: hotkeys, setEnabled: setHotkeys } = useHotkeysSetting();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    if (page) page.inert = menuOpen;
  }, [menuOpen]);

  const closeMenu = useCallback((reason: 'dismiss' | 'navigate') => {
    setMenuOpen(false);
    // After following a link the page is the focus target; otherwise return to the slot that opened the menu.
    // (Deferred one tick so `inert` is lifted first.)
    window.setTimeout(() => (reason === 'navigate' ? mainRef.current : menuRef.current)?.focus(), 0);
  }, []);

  const onHotkey = useCallback(
    (a: HotkeyAction) => {
      if (a.kind === 'menu') setMenuOpen(true);
      else {
        navigate(a.to);
        window.setTimeout(() => mainRef.current?.focus(), 0);
      }
    },
    [navigate],
  );
  useHotkeys(hotkeys && !menuOpen, onHotkey);

  return (
    <div className={styles.shell}>
      <div ref={pageRef} className={styles.page}>
        <a className={styles.skip} href="#main-content">
          Skip to main content
        </a>
        <Hud compact={isMobile} summary={summary.data} hotkeys={hotkeys} />
        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
        <Hotbar summary={summary.data} hotkeys={hotkeys} menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} menuRef={menuRef} />
      </div>
      {menuOpen && (
        <MenuOverlay
          onClose={closeMenu}
          hotkeys={hotkeys}
          onHotkeys={setHotkeys}
          onSignOut={() => {
            setMenuOpen(false);
            void signOut();
          }}
        />
      )}
      <ImportGate />
    </div>
  );
}
