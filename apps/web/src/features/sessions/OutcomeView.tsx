import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { Dialog } from '../../ui/Dialog';
import { INELIGIBLE_TEXT, type Outcome } from './types';

function ReportQuestion({ questionId, text }: { questionId: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const report = useMutation({ mutationFn: () => api.reportQuestion(questionId, reason.trim() || undefined) });
  const close = () => {
    setOpen(false);
    report.reset();
  };
  return (
    <>
      <button
        type="button"
        className={`${common.btn} ${common.small}`}
        onClick={() => setOpen(true)}
        disabled={report.isSuccess}
      >
        {report.isSuccess ? 'Reported, thank you' : 'Report this question'}
      </button>
      {open && !report.isSuccess && (
        <Dialog
          title="Report this question"
          onClose={close}
          actions={
            <>
              <button type="button" className={common.btn} onClick={close} disabled={report.isPending}>
                Cancel
              </button>
              <button
                type="button"
                className={`${common.btn} ${common.primary}`}
                onClick={() => report.mutate()}
                disabled={report.isPending}
              >
                {report.isPending ? 'Sending…' : 'Send report'}
              </button>
            </>
          }
        >
          <div className={common.stack}>
            <p>“{text}”</p>
            <label className={common.field}>
              <span className={common.label}>What is wrong with it? (optional)</span>
              <input
                className={common.input}
                value={reason}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {report.error && <p role="alert" className={common.error}>{errorMessage(report.error)}</p>}
          </div>
        </Dialog>
      )}
    </>
  );
}

/** Shown after finishing without a claim, or after grading the claim quiz. */
export function OutcomeView({ outcome, onDismiss }: { outcome: Outcome; onDismiss: () => void }) {
  if (outcome.kind === 'ineligible') {
    return (
      <section className={`${common.panel} ${common.stack}`} aria-labelledby="outcome-title">
        <h2 id="outcome-title">Session ended with no reward</h2>
        <p role="status">
          {outcome.reason ? INELIGIBLE_TEXT[outcome.reason] : 'This session did not qualify for a reward.'}
        </p>
        <div>
          <button type="button" className={`${common.btn} ${common.primary}`} onClick={onDismiss}>
            Back to sessions
          </button>
        </div>
      </section>
    );
  }
  const { result, quiz } = outcome;
  return (
    <section className={`${common.panel} ${common.stack}`} aria-labelledby="outcome-title">
      <h2 id="outcome-title">{result.passed ? 'Quiz passed' : 'Quiz not passed'}</h2>
      <p role="status" className={common.notice}>
        {result.alreadyClaimed
          ? 'This session was already claimed earlier; nothing more was paid.'
          : `You got ${result.correct} of ${result.total}. Reward: +${result.xpAwarded} XP and +${result.energyAwarded} energy${
              result.passed ? '' : ' (half, because the quiz was not passed)'
            }.${result.levelsGained > 0 ? ` Level up! (+${result.levelsGained})` : ''}`}
      </p>
      {result.questions.length > 0 && (
        <ol className={common.list}>
          {result.questions.map((q) => {
            const choices = quiz.find((x) => x.position === q.position)?.choices ?? [];
            return (
              <li key={q.position} className={common.stack}>
                <div className={common.item}>
                  <div className={common.itemMain}>
                    <strong>{q.text}</strong>
                    <span>
                      {q.correct ? 'Correct.' : 'Not correct.'}{' '}
                      {q.selectedIndex !== null && !q.correct && (
                        <>Your answer: {choices[q.selectedIndex] ?? 'unknown'}. </>
                      )}
                      Right answer: {choices[q.correctIndex] ?? 'unknown'}.
                    </span>
                  </div>
                  {q.questionId && <ReportQuestion questionId={q.questionId} text={q.text} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div>
        <button type="button" className={`${common.btn} ${common.primary}`} onClick={onDismiss}>
          Back to sessions
        </button>
      </div>
    </section>
  );
}
