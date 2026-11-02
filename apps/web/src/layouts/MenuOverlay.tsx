import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Sprite } from '../features/art/components/Sprite';
import { PixelButton } from '../features/art/kit';
import { useFocusTrap } from '../ui/useFocusTrap';
import { MENU_OVERLAY_ID } from './Hotbar';
import { MENU_HOTKEY, MENU_LINKS } from './nav';
import styles from './MenuOverlay.module.css';

interface Props {
  /** 'navigate' means a link was followed (focus then goes to the page); 'dismiss' means Escape, the close button or the backdrop. */
  onClose: (reason: 'dismiss' | 'navigate') => void;
  hotkeys: boolean;
  onHotkeys: (on: boolean) => void;
  onSignOut: () => void;
}

/**
 * The pause menu: everything that is not on the hotbar. A full-screen "journal" dialog: focus moves in, Tab stays
 * inside, Escape or the close button dismisses it (AppLayout returns focus to the Menu slot and makes the rest of the
 * page inert while it is open).
 */
export function MenuOverlay({ onClose, hotkeys, onHotkeys, onSignOut }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [credits, setCredits] = useState(false);
  useFocusTrap(ref, true, () => onClose('dismiss'));
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div className={styles.overlay} data-testid="menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose('dismiss')}>
      <div ref={ref} id={MENU_OVERLAY_ID} role="dialog" aria-modal="true" aria-labelledby="menu-title" className={styles.journal}>
        <div className={styles.top}>
          <h2 id="menu-title" className={styles.title}>
            Menu
          </h2>
          <button ref={closeRef} type="button" className={styles.close} onClick={() => onClose('dismiss')}>
            <X aria-hidden size={22} />
            <span className={styles.srOnly}>Close menu</span>
          </button>
        </div>

        <ul className={styles.links}>
          {MENU_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} className={styles.link} onClick={() => onClose('navigate')}>
                <Sprite id={l.sprite} scale={2} decorative />
                <span>{l.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <div className={styles.section}>
          <button
            type="button"
            className={styles.disclosure}
            aria-expanded={credits}
            aria-controls="menu-credits"
            onClick={() => setCredits((v) => !v)}
          >
            <Sprite id="ui.nav.quests" scale={2} decorative />
            <span>Credits</span>
          </button>
          {credits && (
            <div id="menu-credits" className={styles.credits}>
              <p>All pixel art, sprites and scenes are original, drawn in code for this project.</p>
              <p>Pixelify Sans (headings and the HUD) and Lato (everything else) are used under the SIL Open Font License 1.1.</p>
              <p>No third-party art is used, so there are no other attributions yet.</p>
            </div>
          )}
        </div>

        <label className={styles.toggle}>
          <input type="checkbox" checked={hotkeys} onChange={(e) => onHotkeys(e.target.checked)} />
          <span>
            <span className={styles.toggleName}>Keyboard shortcuts</span>
            <span className={styles.hint}>
              1 to 5 jump to the hotbar, {MENU_HOTKEY} opens this menu, H opens your hero. They stay off while you type.
            </span>
          </span>
        </label>

        <PixelButton variant="danger" className={styles.signOut} onClick={onSignOut}>
          Sign out
        </PixelButton>
      </div>
    </div>
  );
}
