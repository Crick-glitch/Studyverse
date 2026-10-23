import type { SessionDto } from '@studyverse/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { formatClock } from '../../lib/format';
import common from '../../ui/common.module.css';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import type { Outcome } from './types';
import { useCountdown, useFocusTracker } from './useSessionClock';

interface Props {
  session: SessionDto;
  onChanged: () => Promise<void>;
  onOutcome: (o: Outcome) => void;
}

/** A created, running or paused session. The countdown is the server's, see useCountdown. */
export function ActiveSession({ session, onChanged, onOutcome }: Props) {
  const remaining = useCountdown(session);
  const getFocus = useFocusTracker(session.status === 'running');
  const [confirming, setConfirming] = useState<'abandon' | 'delete' | null>(null);

  const act = useMutation({
    mutationFn: (a: 'start' | 'pause' | 'resume') => api.sessions.action(session.id, a),
    onSettled: onChanged,
  });
  const finish = useMutation({
    mutationFn: () => api.sessions.finish(session.id, getFocus()),
    onSuccess: async (r) => {
      if (!r.claimable)
        onOutcome({ kind: 'ineligible', session: r.session, reason: r.ineligibleReason });
      await onChanged();
    },
  });
  const drop = useMutation({
    mutationFn: () =>
      confirming === 'delete' ? api.sessions.remove(session.id) : api.sessions.action(session.id, 'abandon'),
    onSuccess: async () => {
      setConfirming(null);
      await onChanged();
    },
  });

  const busy = act.isPending || finish.isPending || drop.isPending;
  const error = act.error ?? finish.error;
  const total = session.plannedMinutes * 60;
  const isCreated = session.status === 'created';
  const label = session.kind === 'review' ? 'Review session' : 'Study session';

  return (
    <section className={`${common.panel} ${common.stack}`} aria-labelledby="active-title">
      <h2 id="active-title">
        {label}: {session.title}
      </h2>
      <p className={common.row}>
        <span className={common.badge}>{session.subject}</span>
        <span className={common.badge}>{session.difficulty}</span>
        <span className={common.badge}>{session.plannedMinutes} min</span>
        <span className={common.reward}>
          Perfect claim: about {session.estimate.xp} XP and {session.estimate.energy} energy
        </span>
      </p>

      {isCreated ? (
        <p>This session is planned but the timer has not started.</p>
      ) : (
        <>
          <p
            role="timer"
            aria-label="Time remaining"
            style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', margin: 0 }}
          >
            {formatClock(remaining)}
          </p>
          <progress
            className={common.bar}
            max={total}
            value={Math.min(total, total - remaining)}
            aria-label="Session progress"
          />
          <p className={common.muted}>
            {session.status === 'paused'
              ? 'Paused. The server is not counting time right now.'
              : remaining === 0
                ? 'Time is up. Finish the session to take your claim quiz.'
                : 'Keep this tab open and in front: leaving it lowers your focus score.'}
          </p>
        </>
      )}

      {error && <p role="alert" className={common.error}>{errorMessage(error)}</p>}
      <div className={common.row}>
        {isCreated && (
          <>
            <button
              type="button"
              className={`${common.btn} ${common.primary}`}
              disabled={busy}
              onClick={() => act.mutate('start')}
            >
              Start timer
            </button>
            <button
              type="button"
              className={`${common.btn} ${common.danger}`}
              disabled={busy}
              onClick={() => setConfirming('delete')}
            >
              Delete
            </button>
          </>
        )}
        {session.status === 'running' && (
          <button type="button" className={common.btn} disabled={busy} onClick={() => act.mutate('pause')}>
            Pause
          </button>
        )}
        {session.status === 'paused' && (
          <button
            type="button"
            className={`${common.btn} ${common.primary}`}
            disabled={busy}
            onClick={() => act.mutate('resume')}
          >
            Resume
          </button>
        )}
        {!isCreated && (
          <>
            <button
              type="button"
              className={`${common.btn} ${remaining === 0 ? common.primary : ''}`}
              disabled={busy}
              onClick={() => finish.mutate()}
            >
              {finish.isPending ? 'Finishing…' : 'Finish session'}
            </button>
            <button
              type="button"
              className={`${common.btn} ${common.danger}`}
              disabled={busy}
              onClick={() => setConfirming('abandon')}
            >
              Abandon
            </button>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={confirming === 'delete' ? 'Delete this planned session?' : 'Abandon this session?'}
          confirmLabel={confirming === 'delete' ? 'Delete' : 'Abandon session'}
          busy={drop.isPending}
          error={drop.error ? errorMessage(drop.error) : null}
          onCancel={() => setConfirming(null)}
          onConfirm={() => drop.mutate()}
        >
          <p>
            {confirming === 'delete'
              ? 'It was never started, so nothing is lost.'
              : 'An abandoned session pays no XP or energy.'}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
