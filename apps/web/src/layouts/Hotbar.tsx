import type { SummaryDto } from '@studyverse/shared';
import type { RefObject } from 'react';
import { NavLink } from 'react-router-dom';
import { Sprite } from '../features/art/components/Sprite';
import { slotBadge, type Badge } from './badges';
import { HOTBAR, MENU_HOTKEY } from './nav';
import styles from './Hotbar.module.css';

export const MENU_OVERLAY_ID = 'menu-overlay';

interface Props {
  summary: SummaryDto | undefined;
  /** Tooltips show each slot's key only while shortcuts are on. */
  hotkeys: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  menuRef: RefObject<HTMLButtonElement>;
}

function BadgeMark({ badge }: { badge: Badge }) {
  // Drawn only; the equivalent text is in the slot's aria-label.
  return (
    <span className={styles.badge} data-kind={badge.kind} aria-hidden="true">
      {badge.text}
    </span>
  );
}

/**
 * The five things you do daily plus the Menu, always at the bottom (the same component on desktop and phone).
 * Labels are always visible. The selected slot is raised, gold-framed and marked under the icon (not colour alone)
 * and carries aria-current="page". Badges are real numbers from GET /summary and each has a hidden text equivalent.
 */
export function Hotbar({ summary, hotkeys, menuOpen, onMenu, menuRef }: Props) {
  const tip = (label: string, key: string) => (hotkeys ? `${label} (${key})` : label);
  return (
    <div className={styles.hotbar} data-hotbar>
      <nav aria-label="Main" className={styles.bar}>
        <ul className={styles.list}>
          {HOTBAR.map((slot) => {
            const badge = slotBadge(slot.id, summary);
            return (
              <li key={slot.id} className={styles.item}>
                <NavLink
                  to={slot.to}
                  end={slot.end ?? false}
                  className={styles.slot}
                  title={tip(slot.label, slot.hotkey)}
                  // The visible label comes first, so the name still contains it; the badge's text equivalent follows.
                  aria-label={badge ? `${slot.label}, ${badge.sr}` : undefined}
                >
                  <span className={styles.icon} data-ring={badge?.kind === 'resume' ? 'true' : undefined}>
                    <Sprite id={slot.sprite} scale={2} decorative />
                    {badge && <BadgeMark badge={badge} />}
                  </span>
                  <span className={styles.label}>{slot.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li className={styles.item}>
            <button
              ref={menuRef}
              type="button"
              className={styles.slot}
              title={tip('Menu', MENU_HOTKEY)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? MENU_OVERLAY_ID : undefined}
              onClick={onMenu}
            >
              <span className={styles.icon}>
                <Sprite id="ui.satchel" scale={2} decorative />
              </span>
              <span className={styles.label}>Menu</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
