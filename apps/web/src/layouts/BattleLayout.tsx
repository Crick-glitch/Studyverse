import { Outlet } from 'react-router-dom';
import styles from './BattleLayout.module.css';

/**
 * Battle route layout (06-battle-screen.md): no HUD, no hotbar, no camp panel. The battle screen draws its own top bar
 * (Retreat, sound, Auto-Steady) and the rewards screen links back out, so nothing here can pull the player away mid-fight.
 */
export function BattleLayout() {
  return (
    <div className={styles.shell}>
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
