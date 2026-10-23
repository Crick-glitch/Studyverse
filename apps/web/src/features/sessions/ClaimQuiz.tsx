import type { SessionDto } from '@studyverse/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { ErrorState, Skeleton } from '../../ui/StateViews';
import type { Outcome } from './types';

/**
 * The 5-question claim quiz. Answers are never in the page until the server grades them: the quiz
 * response holds only text and choices.
 */
export function ClaimQuiz({
  session,
  onOutcome,
  onChanged,
}: {
  session: SessionDto;
  onOutcome: (o: Outcome) => void;
  onChanged: () => Promise<void>;
}) {
  const quiz = useQuery({
    queryKey: ['sessions', 'claim', session.id],
    queryFn: () => api.sessions.claimQuiz(session.id),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const submit = useMutation({
    mutationFn: () =>
      api.sessions.claim(
        session.id,
        Object.entries(answers).map(([position, selectedIndex]) => ({
          position: Number(position),
          selectedIndex,
        })),
      ),
    onSuccess: async (result) => {
      onOutcome({ kind: 'claimed', result, quiz: quiz.data?.questions ?? [] });
      await onChanged();
    },
  });

  if (quiz.isPending) return <Skeleton label="Loading your claim quiz" lines={5} />;
  if (quiz.isError)
    return <ErrorState message={errorMessage(quiz.error)} onRetry={() => void quiz.refetch()} />;

  const questions = quiz.data.questions;
  const complete = questions.every((q) => answers[q.position] !== undefined);
  return (
    <section className={`${common.panel} ${common.stack}`} aria-labelledby="claim-title">
      <h2 id="claim-title">Claim quiz: {session.title}</h2>
      {questions.length === 0 ? (
        <p>
          There were no questions available for this session, so there is nothing to answer. You can
          claim your reward.
        </p>
      ) : (
        <p className={common.muted}>
          Answer all {questions.length}. Getting at least 80% right pays the full reward; fewer pays
          half.
        </p>
      )}
      {questions.map((q, i) => (
        <fieldset key={q.position} className={common.panel} style={{ margin: 0 }}>
          <legend>
            Question {i + 1} of {questions.length}
          </legend>
          <p style={{ marginTop: 0 }}>{q.text}</p>
          <div className={common.stack}>
            {q.choices.map((c, ci) => (
              <label key={ci} className={common.row}>
                <input
                  type="radio"
                  name={`claim-q-${q.position}`}
                  checked={answers[q.position] === ci}
                  onChange={() => setAnswers({ ...answers, [q.position]: ci })}
                />
                <span>{c}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {submit.error && <p role="alert" className={common.error}>{errorMessage(submit.error)}</p>}
      <div>
        <button
          type="button"
          className={`${common.btn} ${common.primary}`}
          disabled={!complete || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? 'Grading…' : questions.length === 0 ? 'Claim reward' : 'Submit answers'}
        </button>
      </div>
    </section>
  );
}
