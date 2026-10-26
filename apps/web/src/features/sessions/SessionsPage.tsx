import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { PageHeader } from '../../ui/PageHeader';
import { ErrorState, Skeleton } from '../../ui/StateViews';
import { ActiveSession } from './ActiveSession';
import { ClaimQuiz } from './ClaimQuiz';
import { OutcomeView } from './OutcomeView';
import { SessionHistory } from './SessionHistory';
import { SessionPlanner } from './SessionPlanner';
import type { Outcome } from './types';

export function SessionsPage() {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // On load (including after a refresh) the active session comes from the server, with its clock.
  const active = useQuery({ queryKey: ['sessions', 'active'], queryFn: api.sessions.active });

  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['sessions'] }),
      qc.invalidateQueries({ queryKey: ['me'] }),
      qc.invalidateQueries({ queryKey: ['quests'] }),
      qc.invalidateQueries({ queryKey: ['decks'] }),
    ]);
  }, [qc]);

  const session = active.data?.session ?? null;
  let body;
  if (outcome) {
    body = <OutcomeView outcome={outcome} onDismiss={() => setOutcome(null)} />;
  } else if (active.isPending) {
    body = <Skeleton label="Loading your session" />;
  } else if (active.isError) {
    body = <ErrorState message={errorMessage(active.error)} onRetry={() => void active.refetch()} />;
  } else if (session?.status === 'finished') {
    body = <ClaimQuiz session={session} onOutcome={setOutcome} onChanged={refresh} />;
  } else if (session) {
    body = <ActiveSession key={session.id} session={session} onChanged={refresh} onOutcome={setOutcome} />;
  } else {
    body = <SessionPlanner onChanged={refresh} />;
  }

  return (
    <section className={common.page} aria-labelledby="sessions-title">
      <PageHeader id="sessions-title" icon="sessions">
        Study Sessions
      </PageHeader>
      {body}
      <SessionHistory />
    </section>
  );
}
