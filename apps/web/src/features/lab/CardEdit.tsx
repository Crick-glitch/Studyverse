import {
  BALANCE,
  DIFFICULTIES,
  cleanDistractors,
  type CardDto,
  type Difficulty,
} from '@studyverse/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { Dialog } from '../../ui/Dialog';

export function CardEdit({
  card,
  onClose,
  onSaved,
}: {
  card: CardDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [question, setQuestion] = useState(card.question);
  const [answer, setAnswer] = useState(card.answer);
  const [wrong, setWrong] = useState(card.distractors.join('\n'));
  const [subject, setSubject] = useState(card.subject);
  const [difficulty, setDifficulty] = useState<Difficulty>(card.difficulty);

  const save = useMutation({
    mutationFn: () =>
      api.cards.update(card.id, {
        question: question.trim(),
        answer: answer.trim(),
        subject: subject.trim(),
        difficulty,
        distractors: cleanDistractors(answer.trim(), wrong.split('\n')),
      }),
    onSuccess: onSaved,
  });
  const valid = question.trim() !== '' && answer.trim() !== '' && subject.trim() !== '';
  return (
    <Dialog
      title="Edit card"
      onClose={onClose}
      actions={
        <>
          <button type="button" className={common.btn} onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={`${common.btn} ${common.primary}`}
            disabled={!valid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className={common.stack}>
        <label className={common.field}>
          <span className={common.label}>Question</span>
          <textarea
            className={common.textarea}
            value={question}
            maxLength={BALANCE.flashcards.questionMaxLength}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className={common.field}>
          <span className={common.label}>Correct answer</span>
          <input className={common.input} value={answer} onChange={(e) => setAnswer(e.target.value)} />
        </label>
        <label className={common.field}>
          <span className={common.label}>Wrong answers, one per line (optional)</span>
          <textarea className={common.textarea} value={wrong} onChange={(e) => setWrong(e.target.value)} />
        </label>
        <div className={common.grid2}>
          <label className={common.field}>
            <span className={common.label}>Subject</span>
            <input className={common.input} value={subject} maxLength={40} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className={common.field}>
            <span className={common.label}>Difficulty</span>
            <select
              className={common.select}
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>
        {save.error && <p role="alert" className={common.error}>{errorMessage(save.error)}</p>}
      </div>
    </Dialog>
  );
}
