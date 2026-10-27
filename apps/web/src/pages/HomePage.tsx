import { HOME_CONTENT_ID, HubScene } from '../features/hub/HubScene';
import { ComingSoon } from './ComingSoon';

/** Home: the camp scene above the dashboard content. The dashboard itself arrives with session 07. */
export function HomePage() {
  return (
    <>
      <HubScene />
      <div id={HOME_CONTENT_ID} tabIndex={-1} style={{ outline: 'none' }}>
        <ComingSoon
          title="Dashboard"
          icon="dashboard"
          phase="Phase 6"
          description="Level, XP, streak, active session, quests and your next best action will appear here once the API and game systems exist."
        />
      </div>
    </>
  );
}
