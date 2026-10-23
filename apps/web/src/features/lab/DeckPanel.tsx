import { SUBJECTS, type CardDto, type DeckDto } from '@studyverse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Dialog } from '../../ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews';
import { CardEdit } from './CardEdit';
import { CardsForm } from './CardsForm';
import { CsvPanel } from './CsvPanel';

function RenameDeck({ deck, onClose }: { deck: DeckDto; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(deck.name);
  const [subject, setSubject] = useState(deck.subject);
  const save = useMutation({
    mutationFn: () => api.decks.update(deck.id, { name: name.trim(), subject: subject.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['decks'] });
      onClose();
    },
  });
  return (
    <Dialog
      title="Rename deck"
      onClose={onClose}
      actions={
        <>
          <button type="button" className={common.btn} onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={`${common.btn} ${common.primary}`}
            disabled={!name.trim() || !subject.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className={common.stack}>
        <label className={common.field}>
          <span className={common.label}>Deck name</span>
          <input className={common.input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={common.field}>
          <span className={common.label}>Subject</span>
          <input
            className={common.input}
            list="deck-subjects"
            value={subject}
            maxLength={40}
            onChange={(e) => setSubject(e.target.value)}
          />
          <datalist id="deck-subjects">
            {SUBJECTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        {save.error && <p role="alert" className={common.error}>{errorMessage(save.error)}</p>}
      </div>
    </Dialog>
  );
}

export function DeckPanel({
  deck,
  onReview,
  onDeleted,
}: {
  deck: DeckDto;
  onReview: () => void;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const cards = useQuery({ queryKey: ['cards', deck.id], queryFn: () => api.decks.cards(deck.id) });
  const [renaming, setRenaming] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [editing, setEditing] = useState<CardDto | null>(null);
  const [deletingCard, setDeletingCard] = useState<CardDto | null>(null);

  const refreshCards = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['cards', deck.id] }),
      qc.invalidateQueries({ queryKey: ['decks'] }),
    ]);
  const removeDeck = useMutation({
    mutationFn: () => api.decks.remove(deck.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['decks'] });
      onDeleted();
    },
  });
  const removeCard = useMutation({
    mutationFn: (id: string) => api.cards.remove(id),
    onSuccess: async () => {
      setDeletingCard(null);
      await refreshCards();
    },
  });

  return (
    <div className={common.stack}>
      <div className={`${common.panel} ${common.stack}`}>
        <div className={common.spread}>
          <h2 style={{ margin: 0 }}>{deck.name}</h2>
          <div className={common.row}>
            <button type="button" className={`${common.btn} ${common.primary}`} disabled={deck.dueCount === 0} onClick={onReview}>
              Review this deck ({deck.dueCount} due)
            </button>
            <button type="button" className={common.btn} onClick={() => setRenaming(true)}>
              Rename
            </button>
            <button
              type="button"
              className={`${common.btn} ${common.danger}`}
              onClick={() => {
                removeDeck.reset();
                setDeletingDeck(true);
              }}
            >
              Delete deck
            </button>
          </div>
        </div>
        <p className={common.muted}>
          {deck.subject} · {deck.cardCount} {deck.cardCount === 1 ? 'card' : 'cards'}
        </p>

        {cards.isPending && <Skeleton label="Loading cards" />}
        {cards.isError && <ErrorState message={errorMessage(cards.error)} onRetry={() => void cards.refetch()} />}
        {cards.data && cards.data.length === 0 && (
          <EmptyState title="This deck has no cards yet">Add some below, or import a CSV file.</EmptyState>
        )}
        {removeCard.error && <p role="alert" className={common.error}>{errorMessage(removeCard.error)}</p>}
        {cards.data && cards.data.length > 0 && (
          <ul className={common.list} aria-label={`Cards in ${deck.name}`}>
            {cards.data.map((c) => (
              <li key={c.id} className={common.item}>
                <div className={common.itemMain}>
                  <strong style={{ whiteSpace: 'pre-wrap' }}>{c.question}</strong>
                  <span>Answer: {c.answer}</span>
                  {c.distractors.length > 0 && (
                    <span className={common.muted}>Wrong answers: {c.distractors.join(' · ')}</span>
                  )}
                  <span className={common.muted}>
                    {c.subject} · {c.difficulty} · next review {new Date(c.dueAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={common.row}>
                  <button type="button" className={`${common.btn} ${common.small}`} onClick={() => setEditing(c)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`${common.btn} ${common.danger} ${common.small}`}
                    onClick={() => {
                      removeCard.reset();
                      setDeletingCard(c);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CardsForm deck={deck} />
      <CsvPanel deck={deck} />

      {renaming && <RenameDeck deck={deck} onClose={() => setRenaming(false)} />}
      {editing && (
        <CardEdit
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refreshCards();
          }}
        />
      )}
      {deletingCard && (
        <ConfirmDialog
          title="Delete this card?"
          confirmLabel="Delete card"
          busy={removeCard.isPending}
          error={removeCard.error ? errorMessage(removeCard.error) : null}
          onCancel={() => setDeletingCard(null)}
          onConfirm={() => removeCard.mutate(deletingCard.id)}
        >
          <p>“{deletingCard.question}” and its review history will be removed.</p>
        </ConfirmDialog>
      )}
      {deletingDeck && (
        <ConfirmDialog
          title={`Delete “${deck.name}”?`}
          confirmLabel="Delete deck and cards"
          busy={removeDeck.isPending}
          error={removeDeck.error ? errorMessage(removeDeck.error) : null}
          onCancel={() => setDeletingDeck(false)}
          onConfirm={() => removeDeck.mutate()}
        >
          <p>
            This permanently deletes the deck and its {deck.cardCount}{' '}
            {deck.cardCount === 1 ? 'card' : 'cards'}.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
