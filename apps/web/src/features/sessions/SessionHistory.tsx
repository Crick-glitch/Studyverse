import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import common from '../../ui/common.module.css';
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews';
import { INELIGIBLE_TEXT } from './types';

const STATUS_TEXT: Record<string, string> = {
  claimed: 'Claimed',
  finished: 'Waiting for claim quiz',
  abandoned: 'No reward',
  created: 'Planned',
  running: 'Running',
  paused: 'Paused',
};

export function SessionHistory() {
  const history = useQuery({ queryKey: ['sessions', 'history'], queryFn: () => api.sessions.list(20) });
  return (
    <section className={`${common.panel} ${common.stack}`} aria-labelledby="history-title">
      <h2 id="history-title">Recent sessions</h2>
      {history.isPending && <Skeleton label="Loading session history" />}
      {history.isError && (
        <ErrorState message={errorMessage(history.error)} onRetry={() => void history.refetch()} />
      )}
      {history.data && history.data.length === 0 && (
        <EmptyState title="No sessions yet">Plan your first session above.</EmptyState>
      )}
      {history.data && history.data.length > 0 && (
        <ul className={common.list}>
          {history.data.map((s) => (
            <li key={s.id} className={common.item}>
              <div className={common.itemMain}>
                <strong>{s.title}</strong>
                <span className={common.muted}>
                  {formatDateTime(s.createdAt)} · {s.subject} · {s.plannedMinutes} min
                  {s.kind === 'review' ? ' · review' : ''}
                </span>
                {s.outcomeReason && (s.outcomeReason === 'not_enough_time' || s.outcomeReason === 'not_enough_focus') && (
                  <span className={common.muted}>{INELIGIBLE_TEXT[s.outcomeReason]}</span>
                )}
              </div>
              <span className={common.row}>
                <span className={common.badge}>{STATUS_TEXT[s.status] ?? s.status}</span>
                {s.status === 'claimed' && (
                  <span className={common.reward}>
                    +{s.xpAwarded} XP, +{s.energyAwarded} energy
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
