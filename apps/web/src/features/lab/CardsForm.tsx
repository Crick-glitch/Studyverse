import {
  BALANCE,
  DIFFICULTIES,
  cleanDistractors,
  type CardInput,
  type Difficulty,
  type DeckDto,
} from '@studyverse/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';

export interface Row {
  key: number;
  question: string;
  answer: string;
  wrong1: string;
  wrong2: string;
}
const emptyRow = (key: number): Row => ({ key, question: '', answer: '', wrong1: '', wrong2: '' });
const isBlank = (r: Row) => !r.question.trim() && !r.answer.trim() && !r.wrong1.trim() && !r.wrong2.trim();

/** Turns the filled rows into cards. Returns an error message for a half-filled row instead. */
export function rowsToCards(
  rows: Row[],
  difficulty: Difficulty,
  subject: string,
): { cards: CardInput[]; error: string | null } {
  const cards: CardInput[] = [];
  for (const [i, r] of rows.entries()) {
    if (isBlank(r)) continue;
    if (!r.question.trim() || !r.answer.trim())
      return { cards: [], error: `Row ${i + 1} needs both a question and an answer.` };
    cards.push({
      question: r.question.trim(),
      answer: r.answer.trim(),
      subject: subject.trim() || 'Other',
      difficulty,
      // Blank and placeholder wrong answers ("N/A") are dropped; they never reach a quiz.
      distractors: cleanDistractors(r.answer.trim(), [r.wrong1, r.wrong2]),
    });
  }
  return { cards, error: cards.length === 0 ? 'Fill in at least one card.' : null };
}

/** Batch add: every filled row becomes its own new card (an INSERT; existing cards are never replaced). */
export function CardsForm({ deck }: { deck: DeckDto }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([emptyRow(1), emptyRow(2), emptyRow(3)]);
  const [nextKey, setNextKey] = useState(4);
  const [subject, setSubject] = useState(deck.subject);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (cards: CardInput[]) => api.decks.addCards(deck.id, cards),
    onSuccess: async (created) => {
      setSaved(`Added ${created.length} ${created.length === 1 ? 'card' : 'cards'}.`);
      setRows([emptyRow(nextKey), emptyRow(nextKey + 1), emptyRow(nextKey + 2)]);
      setNextKey(nextKey + 3);
      // Never hand-patch the list: refetch the deck from the API.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cards', deck.id] }),
        qc.invalidateQueries({ queryKey: ['decks'] }),
      ]);
    },
  });

  const update = (key: number, field: keyof Omit<Row, 'key'>, value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(null);
    const { cards, error } = rowsToCards(rows, difficulty, subject);
    setLocalError(error);
    if (!error) add.mutate(cards);
  };

  return (
    <form onSubmit={submit} className={`${common.panel} ${common.stack}`} aria-label="Add flashcards">
      <h3>Add cards</h3>
      <div className={common.grid2}>
        <label className={common.field}>
          <span className={common.label}>Subject for these cards</span>
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
      {rows.map((r, i) => (
        <fieldset key={r.key} className={common.panel} style={{ margin: 0 }}>
          <legend>Card {i + 1}</legend>
          <div className={common.grid2}>
            <label className={common.field}>
              <span className={common.label}>Question</span>
              <textarea
                className={common.textarea}
                value={r.question}
                maxLength={BALANCE.flashcards.questionMaxLength}
                onChange={(e) => update(r.key, 'question', e.target.value)}
              />
            </label>
            <div className={common.stack}>
              <label className={common.field}>
                <span className={common.label}>Correct answer</span>
                <input
                  className={common.input}
                  value={r.answer}
                  maxLength={BALANCE.flashcards.answerMaxLength}
                  onChange={(e) => update(r.key, 'answer', e.target.value)}
                />
              </label>
              <label className={common.field}>
                <span className={common.label}>Wrong answer 1 (optional)</span>
                <input className={common.input} value={r.wrong1} onChange={(e) => update(r.key, 'wrong1', e.target.value)} />
              </label>
              <label className={common.field}>
                <span className={common.label}>Wrong answer 2 (optional)</span>
                <input className={common.input} value={r.wrong2} onChange={(e) => update(r.key, 'wrong2', e.target.value)} />
              </label>
            </div>
          </div>
        </fieldset>
      ))}
      {(localError || add.error) && (
        <p role="alert" className={common.error}>
          {localError ?? errorMessage(add.error)}
        </p>
      )}
      <p role="status" className={saved ? common.notice : common.srOnly}>
        {saved}
      </p>
      <div className={common.row}>
        <button
          type="button"
          className={common.btn}
          disabled={rows.length >= BALANCE.flashcards.batchMax}
          onClick={() => {
            setRows((rs) => [...rs, emptyRow(nextKey)]);
            setNextKey(nextKey + 1);
          }}
        >
          Add another row
        </button>
        <button type="submit" className={`${common.btn} ${common.primary}`} disabled={add.isPending}>
          {add.isPending ? 'Saving…' : 'Save cards'}
        </button>
      </div>
      <p className={common.muted}>
        Without wrong answers a card is reviewed by revealing the answer; quizzes borrow wrong answers
        from your other cards when they can.
      </p>
    </form>
  );
}
