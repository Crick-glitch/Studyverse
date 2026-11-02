import { HOME_CONTENT_ID, HubScene } from '../features/hub/HubScene';
import { ComingSoon } from './ComingSoon';
import styles from './HomePage.module.css';

/**
 * Home: the camp scene next to the dashboard content (stacked on narrower screens). The dashboard itself arrives with
 * session 07; the column it will fill is already laid out so the scene is never alone in a wide window.
 */
export function HomePage() {
  return (
    <div className={styles.home}>
      <HubScene />
      <div id={HOME_CONTENT_ID} tabIndex={-1} className={styles.content}>
        <ComingSoon
          flush
          title="Dashboard"
          icon="dashboard"
          phase="Session 07"
          description="Level, XP, streak, active session, quests and your next best action will appear here once the API and game systems exist."
        />
      </div>
    </div>
  );
}
