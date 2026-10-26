import { SUBJECTS } from '@studyverse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { saveBlob } from '../../lib/download';
import common from '../../ui/common.module.css';
import { PageHeader } from '../../ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews';
import { DeckPanel } from './DeckPanel';
import { ReviewMode } from './ReviewMode';

function NewDeck({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('Other');
  const create = useMutation({
    mutationFn: () => api.decks.create({ name: name.trim(), subject: subject.trim() || 'Other' }),
    onSuccess: async (deck) => {
      setName('');
      await qc.invalidateQueries({ queryKey: ['decks'] });
      onCreated(deck.id);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };
  return (
    <form onSubmit={submit} className={common.stack} aria-label="Create a deck">
      <div className={common.grid2}>
        <label className={common.field}>
          <span className={common.label}>New deck name</span>
          <input className={common.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={common.field}>
          <span className={common.label}>Subject</span>
          <input
            className={common.input}
            list="lab-subjects"
            value={subject}
            maxLength={40}
            onChange={(e) => setSubject(e.target.value)}
          />
          <datalist id="lab-subjects">
            {SUBJECTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      </div>
      {create.error && <p role="alert" className={common.error}>{errorMessage(create.error)}</p>}
      <div>
        <button type="submit" className={`${common.btn} ${common.primary}`} disabled={!name.trim() || create.isPending}>
          {create.isPending ? 'Creating…' : 'Create deck'}
        </button>
      </div>
    </form>
  );
}

export function LabPage() {
  const [params, setParams] = useSearchParams();
  const deckId = params.get('deck');
  const review = params.get('review'); // 'all' = every due card, '1' = the open deck
  const [includeReview, setIncludeReview] = useState(false);
  const decks = useQuery({ queryKey: ['decks'], queryFn: api.decks.list });
  const exportAll = useMutation({
    mutationFn: () => api.decks.csvExport(null, includeReview),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
  });

  const open = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };

  if (review)
    return (
      <section className={common.page} aria-labelledby="lab-title">
        <PageHeader id="lab-title" icon="lab">
          Lab: review
        </PageHeader>
        <ReviewMode
          deckId={review === 'all' ? undefined : (deckId ?? undefined)}
          onExit={() => open({ review: null })}
        />
      </section>
    );

  const selected = decks.data?.find((d) => d.id === deckId) ?? null;
  const totalDue = (decks.data ?? []).reduce((n, d) => n + d.dueCount, 0);
  return (
    <section className={common.page} aria-labelledby="lab-title">
      <PageHeader id="lab-title" icon="lab">
        Lab
      </PageHeader>
      <div className={`${common.panel} ${common.stack}`}>
        <div className={common.spread}>
          <h2 className={common.flush}>Your decks</h2>
          <button
            type="button"
            className={`${common.btn} ${common.primary}`}
            disabled={totalDue === 0}
            onClick={() => open({ review: 'all', deck: null })}
          >
            Review all due cards ({totalDue})
          </button>
        </div>
        {decks.isPending && <Skeleton label="Loading decks" />}
        {decks.isError && <ErrorState message={errorMessage(decks.error)} onRetry={() => void decks.refetch()} />}
        {decks.data && decks.data.length === 0 && (
          <EmptyState title="No decks yet">Create your first deck below, then add cards to it.</EmptyState>
        )}
        {decks.data && decks.data.length > 0 && (
          <ul className={common.list} aria-label="Decks">
            {decks.data.map((d) => (
              <li key={d.id} className={common.item}>
                <div className={common.itemMain}>
                  <strong>{d.name}</strong>
                  <span className={common.muted}>
                    {d.subject} · {d.cardCount} {d.cardCount === 1 ? 'card' : 'cards'} · {d.dueCount} due
                  </span>
                </div>
                <button
                  type="button"
                  className={`${common.btn} ${common.small}`}
                  aria-pressed={d.id === deckId}
                  onClick={() => open({ deck: d.id })}
                >
                  {d.id === deckId ? 'Open' : 'Open deck'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <NewDeck onCreated={(id) => open({ deck: id })} />
        {decks.data && decks.data.length > 0 && (
          <div className={common.row}>
            <label className={common.row}>
              <input type="checkbox" checked={includeReview} onChange={(e) => setIncludeReview(e.target.checked)} />
              <span>Include review data</span>
            </label>
            <button type="button" className={common.btn} disabled={exportAll.isPending} onClick={() => exportAll.mutate()}>
              {exportAll.isPending ? 'Preparing…' : 'Export all cards (CSV)'}
            </button>
          </div>
        )}
        {exportAll.error && <p role="alert" className={common.error}>{errorMessage(exportAll.error)}</p>}
      </div>

      {deckId && decks.data && !selected && (
        <EmptyState title="That deck no longer exists">Pick another deck from the list above.</EmptyState>
      )}
      {selected && (
        <DeckPanel
          key={selected.id}
          deck={selected}
          onReview={() => open({ review: '1' })}
          onDeleted={() => open({ deck: null })}
        />
      )}
    </section>
  );
}
