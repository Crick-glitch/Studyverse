import {
  BALANCE,
  DIFFICULTIES,
  SUBJECTS,
  type Difficulty,
  type SessionDto,
  type Subject,
} from '@studyverse/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';

/** Plan a timed session, or start a review session from due flashcards. */
export function SessionPlanner({ onChanged }: { onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState('Study session');
  const [subject, setSubject] = useState<Subject>('Math');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [minutes, setMinutes] = useState<number>(BALANCE.sessions.allowedMinutes[1]);

  // Create, then start. If the start fails the session simply stays "created" and is shown as such.
  const startNew = useMutation({
    mutationFn: async (): Promise<SessionDto> => {
      const created = await api.sessions.create({
        title: title.trim() || 'Study session',
        subject,
        difficulty,
        plannedMinutes: minutes,
      });
      return api.sessions.action(created.id, 'start');
    },
    onSettled: onChanged,
  });
  const startReview = useMutation({
    mutationFn: () => api.sessions.createReview(),
    onSettled: onChanged,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startNew.mutate();
  };
  const busy = startNew.isPending || startReview.isPending;
  return (
    <div className={common.grid2}>
      <form onSubmit={submit} className={`${common.panel} ${common.stack}`} aria-label="Plan a study session">
        <h2>Plan a session</h2>
        <label className={common.field}>
          <span className={common.label}>What are you studying?</span>
          <input
            className={common.input}
            value={title}
            maxLength={BALANCE.sessions.titleMaxLength}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className={common.grid2}>
          <label className={common.field}>
            <span className={common.label}>Subject</span>
            <select
              className={common.select}
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
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
          <label className={common.field}>
            <span className={common.label}>Length</span>
            <select
              className={common.select}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            >
              {BALANCE.sessions.allowedMinutes.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
        {startNew.error && <p role="alert" className={common.error}>{errorMessage(startNew.error)}</p>}
        <div>
          <button type="submit" className={`${common.btn} ${common.primary}`} disabled={busy}>
            {startNew.isPending ? 'Starting…' : 'Start session'}
          </button>
        </div>
        <p className={common.muted}>
          The timer runs on the server. You will take a 5-question quiz at the end; 4 of 5 pays the
          full reward, fewer pays half. Finishing before 80% of the time pays nothing.
        </p>
      </form>

      <div className={`${common.panel} ${common.stack}`}>
        <h2>Review session</h2>
        <p>
          Turn the flashcards that are due today into a timed review session with its own claim quiz.
        </p>
        {startReview.error && (
          <p role="alert" className={common.error}>
            {errorMessage(startReview.error)}
          </p>
        )}
        <div>
          <button type="button" className={common.btn} disabled={busy} onClick={() => startReview.mutate()}>
            {startReview.isPending ? 'Starting…' : 'Start review session'}
          </button>
        </div>
      </div>
    </div>
  );
}
