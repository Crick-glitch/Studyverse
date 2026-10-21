import { Link, Outlet } from 'react-router-dom';
import styles from './BattleLayout.module.css';

/** Battle route layout: no main navigation (06-battle-screen.md). Retreat/sound/motion controls arrive in Phase 5. */
export function BattleLayout() {
  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <Link to="/dungeons">Leave to dungeon select</Link>
      </footer>
    </div>
  );
}
