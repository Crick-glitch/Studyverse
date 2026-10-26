import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LocalImportPrompt } from '../features/import/LocalImportPrompt';
import { api } from '../lib/api';
import { useMediaQuery } from '../lib/useMediaQuery';
import styles from './AppLayout.module.css';
import { Hud } from './Hud';
import { Sidebar } from './Sidebar';
import { MOBILE_QUERY, useSidebarCollapsed } from './useSidebar';

/** Offers the old-save import once the player's id is known (never imports by itself). */
function ImportGate() {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  return me.data ? <LocalImportPrompt userId={me.data.user.id} /> : null;
}

/**
 * Signed-in shell: collapsible sidebar (a drawer on phones), HUD on top, page in the middle.
 * While the phone drawer is open the rest of the page is `inert`, so focus and screen readers stay in the menu.
 */
export function AppLayout() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { collapsed, toggle } = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const open = isMobile && drawerOpen;

  // Growing past the phone width closes the drawer.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const column = columnRef.current;
    if (column) column.inert = open;
  }, [open]);

  const close = useCallback((reason: 'dismiss' | 'navigate') => {
    setDrawerOpen(false);
    // Make the page the focus target after following a link; otherwise return to the button that opened the menu.
    // (Deferred one tick so `inert` is lifted first.)
    window.setTimeout(() => (reason === 'navigate' ? mainRef.current : menuRef.current)?.focus(), 0);
  }, []);

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main-content">
        Skip to main content
      </a>
      <Sidebar isMobile={isMobile} open={open} collapsed={collapsed} onToggleCollapsed={toggle} onClose={close} />
      <div ref={columnRef} className={styles.column}>
        <Hud drawerOpen={open} onMenu={() => setDrawerOpen(true)} menuRef={menuRef} compact={isMobile} />
        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </div>
      <ImportGate />
    </div>
  );
}
