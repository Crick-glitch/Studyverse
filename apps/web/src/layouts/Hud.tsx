import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import type { RefObject } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Sprite } from '../features/art/components/Sprite';
import { PixelBar, PixelButton, StreakFlame, XpCrest } from '../features/art/kit';
import { api } from '../lib/api';
import { SIDEBAR_ID } from './Sidebar';
import styles from './Hud.module.css';

interface Props {
  drawerOpen: boolean;
  onMenu: () => void;
  menuRef: RefObject<HTMLButtonElement>;
  /** Fewer XP bar segments on a phone so the bar never forces a horizontal scroll. */
  compact: boolean;
}

/** Top bar: who you are and where you stand. Every number comes from GET /me; nothing is invented. */
export function Hud({ drawerOpen, onMenu, menuRef, compact }: Props) {
  const { signOut } = useAuth();
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const progress = me.data?.progress;
  return (
    <header className={styles.hud}>
      <button
        ref={menuRef}
        type="button"
        className={styles.menu}
        aria-expanded={drawerOpen}
        aria-controls={SIDEBAR_ID}
        onClick={onMenu}
      >
        <Menu aria-hidden size={22} />
        <span className={styles.srOnly}>Open menu</span>
      </button>

      <div className={styles.player}>
        {me.isPending && <span className={styles.status}>Loading…</span>}
        {me.isError && (
          <span role="alert" className={styles.status} title={me.error.message}>
            Profile unavailable
          </span>
        )}
        {me.data && progress && (
          <>
            <XpCrest level={progress.level} scale={2} />
            <div className={styles.identity}>
              <span className={styles.name}>
                {me.data.profile.displayName} · Lv {progress.level}
              </span>
              <PixelBar
                tone="xp"
                label="XP to next level"
                value={progress.currentLevelXp}
                max={progress.xpForNextLevel}
                segments={compact ? 10 : 20}
              />
            </div>
          </>
        )}
      </div>

      {progress && (
        <div className={styles.stats}>
          <span className={styles.stat}>
            <Sprite id="ui.energy" scale={2} decorative />
            <span aria-hidden="true">{progress.studyEnergy}</span>
            <span className={styles.srOnly}>Study energy: {progress.studyEnergy}</span>
          </span>
          <span className={styles.stat}>
            <StreakFlame streak={progress.streak} scale={2} />
            <span aria-hidden="true">{progress.streak}</span>
          </span>
        </div>
      )}

      <PixelButton className={styles.logout} onClick={() => void signOut()}>
        Log out
      </PixelButton>
    </header>
  );
}
