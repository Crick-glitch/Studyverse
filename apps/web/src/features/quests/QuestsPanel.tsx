import type { QuestDto } from '@studyverse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/format';
import common from '../../ui/common.module.css';
import { PixelBar } from '../art/kit';
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews';

function QuestRow({
  quest,
  busy,
  onClaim,
}: {
  quest: QuestDto;
  busy: boolean;
  onClaim: (id: string) => void;
}) {
  const shown = Math.min(quest.progress, quest.target);
  const reward = `${quest.rewardXp} XP${quest.rewardEnergy > 0 ? ` and ${quest.rewardEnergy} energy` : ''}`;
  return (
    <li className={`${common.item} ${common.scroll}`}>
      <div className={common.itemMain}>
        <strong>{quest.title}</strong>
        <span className={common.muted}>{quest.description}</span>
        <PixelBar
          tone="xp"
          value={shown}
          max={quest.target}
          showNumbers={false}
          label={`${quest.title}: ${shown} of ${quest.target}`}
        />
        <span className={common.row}>
          <span>
            {shown} / {quest.target}
          </span>
          <span className={common.reward}>Reward: {reward}</span>
          <span className={common.muted}>Resets {formatDateTime(quest.resetsAt)}</span>
        </span>
      </div>
      {quest.claimed ? (
        <span className={common.badge}>Claimed</span>
      ) : (
        <button
          type="button"
          className={`${common.btn} ${common.primary}`}
          disabled={!quest.claimable || busy}
          onClick={() => onClaim(quest.id)}
        >
          {quest.claimable ? 'Claim reward' : 'In progress'}
        </button>
      )}
    </li>
  );
}

export function QuestsPanel() {
  const qc = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const quests = useQuery({ queryKey: ['quests'], queryFn: api.quests.list });
  const claim = useMutation({
    mutationFn: (id: string) => api.quests.claim(id),
    onSuccess: async (r) => {
      const up = r.levelsGained > 0 ? ` Level up! (+${r.levelsGained})` : '';
      setMessage(
        r.alreadyClaimed
          ? 'That reward was already claimed.'
          : `Claimed: +${r.xp} XP${r.energy > 0 ? `, +${r.energy} energy` : ''}.${up}`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['quests'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
    },
  });

  const group = (period: 'daily' | 'weekly') => (quests.data ?? []).filter((q) => q.period === period);
  return (
    <div className={common.stack}>
      <p className={common.muted}>
        Adventure quests are made by the server and counted from real activity: finished study
        sessions, reviewed flashcards and (soon) battles. Each can be claimed once.
      </p>
      <p role="status" className={message ? common.notice : common.srOnly}>
        {message}
      </p>
      {claim.error && <p role="alert" className={common.error}>{errorMessage(claim.error)}</p>}
      {quests.isPending && <Skeleton label="Loading quests" />}
      {quests.isError && <ErrorState message={errorMessage(quests.error)} onRetry={() => void quests.refetch()} />}
      {quests.data && quests.data.length === 0 && (
        <EmptyState title="No quests right now">
          Quests appear here once the server has created today’s set. Try refreshing in a moment.
        </EmptyState>
      )}
      {(['daily', 'weekly'] as const).map((period) =>
        group(period).length > 0 ? (
          <section key={period} aria-labelledby={`quests-${period}`}>
            <h2 id={`quests-${period}`}>{period === 'daily' ? 'Daily quests' : 'Weekly quests'}</h2>
            <ul className={common.list}>
              {group(period).map((q) => (
                <QuestRow key={q.id} quest={q} busy={claim.isPending} onClaim={(id) => claim.mutate(id)} />
              ))}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
