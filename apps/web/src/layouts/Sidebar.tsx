import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Sprite } from '../features/art/components/Sprite';
import { PixelIcon } from '../features/art/kit';
import { useFocusTrap } from '../ui/useFocusTrap';
import { NAV } from './nav';
import styles from './Sidebar.module.css';

export const SIDEBAR_ID = 'app-sidebar';

interface Props {
  /** Phone layout: the sidebar is a slide-in drawer. */
  isMobile: boolean;
  /** Drawer open (phone layout only). */
  open: boolean;
  /** Icons only (desktop layout only). */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** 'navigate' means a link was followed (focus then goes to the page); 'dismiss' means Escape, backdrop or the close button. */
  onClose: (reason: 'dismiss' | 'navigate') => void;
}

/**
 * The game-menu navigation. Desktop: a collapsible left sidebar. Phone: a drawer that traps focus while open,
 * closes on Escape and returns focus to the menu button. Every link keeps its text (visually hidden when only
 * icons show), so the accessible names never change.
 */
export function Sidebar({ isMobile, open, collapsed, onToggleCollapsed, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const trapped = isMobile && open;
  useFocusTrap(ref, trapped, () => onClose('dismiss'));

  // Opening the drawer moves focus to its first link.
  useEffect(() => {
    if (trapped) ref.current?.querySelector<HTMLElement>('a[href]')?.focus();
  }, [trapped]);

  const icons = !isMobile && collapsed;
  return (
    <>
      {trapped && <div className={styles.backdrop} data-testid="drawer-backdrop" aria-hidden="true" onClick={() => onClose('dismiss')} />}
      <aside
        id={SIDEBAR_ID}
        ref={ref}
        className={styles.sidebar}
        data-mobile={isMobile ? 'true' : 'false'}
        data-open={open ? 'true' : 'false'}
        data-collapsed={icons ? 'true' : 'false'}
      >
        <div className={styles.top}>
          <span className={styles.brand}>
            <Sprite id="ui.crest" scale={2} decorative />
            <span className={styles.brandText}>StudyVerse</span>
          </span>
          {isMobile && (
            <button type="button" className={styles.iconButton} onClick={() => onClose('dismiss')}>
              <X aria-hidden size={22} />
              <span className={styles.srOnly}>Close menu</span>
            </button>
          )}
        </div>
        <nav aria-label="Main" className={styles.nav}>
          <ul className={styles.list}>
            {NAV.map(({ to, label, icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end ?? false}
                  className={styles.link}
                  {...(icons ? { title: label } : {})}
                  onClick={() => {
                    if (isMobile) onClose('navigate');
                  }}
                >
                  <PixelIcon name={icon} scale={2} />
                  <span className={styles.label}>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {!isMobile && (
          <button
            type="button"
            className={styles.collapse}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronsRight aria-hidden size={20} /> : <ChevronsLeft aria-hidden size={20} />}
            <span className={styles.label}>{collapsed ? 'Expand menu' : 'Collapse menu'}</span>
          </button>
        )}
      </aside>
    </>
  );
}
