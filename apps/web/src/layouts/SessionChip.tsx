import type { SummaryDto } from '@studyverse/shared';
import { Link } from 'react-router-dom';
import { Sprite } from '../features/art/components/Sprite';
import { useCountdown } from '../features/sessions/useSessionClock';
import { formatClock } from '../lib/format';
import { ROUTES } from '@studyverse/shared';
import styles from './SessionChip.module.css';

interface Props {
  session: NonNullable<SummaryDto['activeSession']>;
  /** The server's time when `session.remainingSec` was computed; the countdown runs from it, never from the browser clock. */
  serverNow: string;
  /** Phone row: smaller icon and padding so everything fits in one 56px line. */
  compact?: boolean;
  /** Panel row: full width, with a visible "Session" label before the time. */
  wide?: boolean;
}

/** "A session is running": the time left (or "Paused"), linking to the Study screen. Only exists while a session is active. */
export function SessionChip({ session, serverNow, compact = false, wide = false }: Props) {
  const left = useCountdown({ status: session.status, remainingSec: session.remainingSec, serverNow });
  const paused = session.status === 'paused';
  const minutes = Math.ceil(left / 60);
  return (
    <Link to={ROUTES.sessions} className={`${styles.chip} ${wide ? styles.wide : ''}`} data-paused={paused ? 'true' : 'false'} title="Back to your study session">
      <Sprite id="ui.nav.sessions" scale={compact ? 1 : 2} decorative />
      {wide && (
        <span aria-hidden="true" className={styles.wideLabel}>
          Session
        </span>
      )}
      <span aria-hidden="true" className={styles.time}>
        {paused ? 'Paused' : formatClock(left)}
      </span>
      <span className={styles.srOnly}>
        Study session {paused ? 'paused' : 'running'}, about {minutes} {minutes === 1 ? 'minute' : 'minutes'} left. Open study.
      </span>
    </Link>
  );
}
