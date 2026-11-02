import { BALANCE, DIFFICULTIES, type Difficulty, type TaskDto } from '@studyverse/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '../../lib/api';
import common from '../../ui/common.module.css';
import { Dialog } from '../../ui/Dialog';

export const SUBJECT_LIST_ID = 'task-subjects';

export interface FormValues {
  title: string;
  subject: string;
  difficulty: Difficulty;
}

export function TaskForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (v: FormValues) => void;
}) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Other');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), subject: subject.trim() || 'Other', difficulty });
    setTitle('');
  };
  return (
    <form onSubmit={submit} className={common.stack} aria-label="Add a task">
      <div className={common.grid2}>
        <label className={common.field}>
          <span className={common.label}>New task</span>
          <input
            className={common.input}
            value={title}
            maxLength={BALANCE.tasks.titleMaxLength}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Read chapter 4"
            required
          />
        </label>
        <label className={common.field}>
          <span className={common.label}>Subject</span>
          <input
            className={common.input}
            list={SUBJECT_LIST_ID}
            value={subject}
            maxLength={40}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className={common.field}>
          <span className={common.label}>Difficulty</span>
          <select
            className={common.select}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d} (+{BALANCE.taskXp[d]} XP)
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p role="alert" className={common.error}>{error}</p>}
      <div>
        <button type="submit" className={`${common.btn} ${common.primary}`} disabled={busy || !title.trim()}>
          {busy ? 'Adding…' : 'Add task'}
        </button>
      </div>
    </form>
  );
}

export function EditTask({
  task,
  onClose,
  onSaved,
}: {
  task: TaskDto;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(task.title);
  const [subject, setSubject] = useState(task.subject);
  const [difficulty, setDifficulty] = useState<Difficulty>(task.difficulty);
  const save = useMutation({
    mutationFn: () => api.tasks.update(task.id, { title: title.trim(), subject: subject.trim(), difficulty }),
    onSuccess: onSaved,
  });
  return (
    <Dialog
      title="Edit task"
      onClose={onClose}
      actions={
        <>
          <button type="button" className={common.btn} onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className={`${common.btn} ${common.primary}`}
            disabled={save.isPending || !title.trim() || !subject.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className={common.stack}>
        <label className={common.field}>
          <span className={common.label}>Title</span>
          <input className={common.input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={common.field}>
          <span className={common.label}>Subject</span>
          <input
            className={common.input}
            list={SUBJECT_LIST_ID}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className={common.field}>
          <span className={common.label}>Difficulty</span>
          <select
            className={common.select}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {task.rewarded && <p className={common.muted}>This task already paid its XP; editing it will not change that.</p>}
        {save.error && <p role="alert" className={common.error}>{errorMessage(save.error)}</p>}
      </div>
    </Dialog>
  );
}
