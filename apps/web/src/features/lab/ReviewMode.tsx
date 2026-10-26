import { RATINGS, type Rating, type ReviewResultDto } from '@studyverse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews';

const RATING_LABEL: Record<Rating, string> = {
  again: 'Again (I forgot)',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

/**
 * Reviews the cards that are due. The queue is fetched once and kept for the whole run (so a refetch
 * can never reshuffle it mid-review); each answer is sent with the dueAt the player was shown, which
 * makes a double-click or retry harmless on the server.
 */
export function ReviewMode({ deckId, onExit }: { deckId: string | undefined; onExit: () => void }) {
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ['review-queue', deckId ?? 'all'],
    queryFn: () => api.cards.due(deckId),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<ReviewResultDto | null>(null);
  const [tally, setTally] = useState({ done: 0, right: 0 });

  const submit = useMutation({
    mutationFn: (body: Parameters<typeof api.cards.review>[1]) => {
      const item = queue.data?.items[index];
      if (!item) throw new Error('No card to review.');
      return api.cards.review(item.id, body);
    },
    onSuccess: async (r) => {
      setResult(r);
      setTally((t) => ({ done: t.done + 1, right: t.right + (r.correct === false ? 0 : 1) }));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['decks'] }),
        qc.invalidateQueries({ queryKey: ['quests'] }),
        qc.invalidateQueries({ queryKey: ['cards'] }),
      ]);
    },
  });

  const next = () => {
    setIndex((i) => i + 1);
    setChosen(null);
    setRevealed(false);
    setResult(null);
    submit.reset();
  };

  if (queue.isPending) return <Skeleton label="Loading your due cards" />;
  if (queue.isError)
    return <ErrorState message={errorMessage(queue.error)} onRetry={() => void queue.refetch()} />;

  const items = queue.data.items;
  const item = items[index];
  const back = (
    <button type="button" className={common.btn} onClick={onExit}>
      Back to the Lab
    </button>
  );

  if (items.length === 0)
    return (
      <div className={common.stack}>
        <EmptyState title="Nothing is due right now">
          Add more cards, or come back when your next review date arrives.
        </EmptyState>
        <div>{back}</div>
      </div>
    );

  if (!item)
    return (
      <section className={`${common.panel} ${common.stack}`} aria-labelledby="review-done">
        <h2 id="review-done">Review complete</h2>
        <p role="status" className={common.notice}>
          You reviewed {tally.done} {tally.done === 1 ? 'card' : 'cards'} and knew {tally.right}.
          {queue.data.dueTotal > items.length &&
            ` ${queue.data.dueTotal - items.length} more are still due.`}
        </p>
        <div>{back}</div>
      </section>
    );

  const choiceDisabled = submit.isPending || result !== null;
  return (
    <section className={`${common.panel} ${common.stack}`} aria-labelledby="review-title">
      <div className={common.spread}>
        <h2 id="review-title">
          Card {index + 1} of {items.length}
        </h2>
        {back}
      </div>
      <span className={common.badge}>{item.subject}</span>
      <p className={common.question}>{item.question}</p>

      {item.mode === 'choice' && item.choices && (
        <fieldset className={`${common.stack} ${common.plain}`}>
          <legend className={common.srOnly}>Choose an answer</legend>
          {item.choices.map((c, i) => (
            <label key={i} className={common.row}>
              <input
                type="radio"
                name="review-choice"
                disabled={choiceDisabled}
                checked={chosen === i}
                onChange={() => setChosen(i)}
              />
              <span>{c}</span>
            </label>
          ))}
          {!result && (
            <div>
              <button
                type="button"
                className={`${common.btn} ${common.primary}`}
                disabled={chosen === null || submit.isPending}
                onClick={() => {
                  const answer = item.choices?.[chosen ?? -1];
                  if (answer !== undefined)
                    submit.mutate({ mode: 'choice', chosenAnswer: answer, dueAtSeen: item.dueAt });
                }}
              >
                {submit.isPending ? 'Checking…' : 'Check answer'}
              </button>
            </div>
          )}
        </fieldset>
      )}

      {item.mode === 'reveal' && (
        <div className={common.stack}>
          {!revealed ? (
            <div>
              <button type="button" className={`${common.btn} ${common.primary}`} onClick={() => setRevealed(true)}>
                Show answer
              </button>
            </div>
          ) : (
            <>
              <p className={common.notice}>
                <strong>Answer:</strong> {item.answer}
              </p>
              {!result && (
                <div className={common.row} role="group" aria-label="How well did you know it?">
                  {RATINGS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={common.btn}
                      disabled={submit.isPending}
                      onClick={() => submit.mutate({ mode: 'rate', rating: r, dueAtSeen: item.dueAt })}
                    >
                      {RATING_LABEL[r]}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {submit.error && (
        <div className={common.stack}>
          <p role="alert" className={common.error}>
            {errorMessage(submit.error)}
          </p>
          <div>
            <button type="button" className={common.btn} onClick={next}>
              Skip this card
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={common.stack} role="status">
          {result.correct !== null && (
            <p className={result.correct ? common.notice : common.error}>
              {result.correct ? 'Correct.' : 'Not quite.'}{' '}
              {result.correctAnswer !== null && !result.correct && <>The answer is: {result.correctAnswer}</>}
            </p>
          )}
          <p className={common.muted}>
            {result.applied
              ? `Next review in ${result.intervalDays} ${result.intervalDays === 1 ? 'day' : 'days'}.`
              : 'This review was already recorded; nothing changed.'}
          </p>
          <div>
            <button type="button" className={`${common.btn} ${common.primary}`} onClick={next}>
              {index + 1 < items.length ? 'Next card' : 'Finish review'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
