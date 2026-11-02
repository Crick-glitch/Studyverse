import { BALANCE, DIFFICULTIES, SUBJECTS, type TaskDto } from '@studyverse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage, type TaskFilters } from '../../lib/api';
import common from '../../ui/common.module.css';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState, ErrorState, Skeleton } from '../../ui/StateViews';
import { EditTask, SUBJECT_LIST_ID, TaskForm } from './TaskForms';

function SubjectOptions() {
  return (
    <datalist id={SUBJECT_LIST_ID}>
      {SUBJECTS.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  );
}

function rewardNote(r: { xp: number; note: string; levelsGained: number }): string {
  if (r.note === 'daily_cap_reached')
    return `Completed. No XP: you already collected task rewards ${BALANCE.tasks.dailyRewardedCompletions} times today.`;
  if (r.note === 'already_paid') return 'Completed. This task already paid its XP earlier, so nothing more.';
  const up = r.levelsGained > 0 ? ` Level up! (+${r.levelsGained})` : '';
  return `Task complete: +${r.xp} XP.${up}`;
}

export function TasksPanel() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<{ status: string; difficulty: string; subject: string }>({
    status: '',
    difficulty: '',
    subject: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [deleting, setDeleting] = useState<TaskDto | null>(null);

  const apiFilters: TaskFilters = {
    status: filters.status === 'open' || filters.status === 'completed' ? filters.status : undefined,
    difficulty: filters.difficulty || undefined,
    subject: filters.subject.trim() || undefined,
  };
  const tasks = useQuery({ queryKey: ['tasks', apiFilters], queryFn: () => api.tasks.list(apiFilters) });

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['tasks'] }),
      qc.invalidateQueries({ queryKey: ['me'] }),
    ]);

  const create = useMutation({
    mutationFn: api.tasks.create,
    onSuccess: async () => {
      setMessage('Task added.');
      await refresh();
    },
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.tasks.complete(id),
    onSuccess: async (r) => {
      setMessage(rewardNote(r.reward));
      await refresh();
    },
  });
  const reopen = useMutation({
    mutationFn: (id: string) => api.tasks.reopen(id),
    onSuccess: async () => {
      setMessage('Task reopened. Reopening never refunds XP, and completing it again never pays twice.');
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.tasks.remove(id),
    onSuccess: async () => {
      setDeleting(null);
      setMessage('Task deleted.');
      await refresh();
    },
  });
  const busy = complete.isPending || reopen.isPending || remove.isPending;
  const actionError = complete.error ?? reopen.error;

  return (
    <div className={common.stack}>
      <SubjectOptions />
      <TaskForm
        busy={create.isPending}
        error={create.error ? errorMessage(create.error) : null}
        onSubmit={(v) => create.mutate(v)}
      />

      <div className={common.row} role="group" aria-label="Filter tasks">
        <label className={common.field}>
          <span className={common.label}>Status</span>
          <select
            className={common.select}
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className={common.field}>
          <span className={common.label}>Difficulty</span>
          <select
            className={common.select}
            value={filters.difficulty}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
          >
            <option value="">All</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className={common.field}>
          <span className={common.label}>Subject</span>
          <input
            className={common.input}
            list={SUBJECT_LIST_ID}
            value={filters.subject}
            onChange={(e) => setFilters({ ...filters, subject: e.target.value })}
            placeholder="Any"
          />
        </label>
      </div>

      <p role="status" className={message ? common.notice : common.srOnly}>
        {message}
      </p>
      {actionError && <p role="alert" className={common.error}>{errorMessage(actionError)}</p>}

      {tasks.isPending && <Skeleton label="Loading tasks" />}
      {tasks.isError && <ErrorState message={errorMessage(tasks.error)} onRetry={() => void tasks.refetch()} />}
      {tasks.data && tasks.data.length === 0 && (
        <EmptyState title="No tasks here yet">
          {filters.status || filters.difficulty || filters.subject
            ? 'No task matches these filters. Clear a filter to see more.'
            : 'Add your first task above. Easy tasks pay 10 XP, medium 25 and hard 50.'}
        </EmptyState>
      )}
      {tasks.data && tasks.data.length > 0 && (
        <ul className={common.list} aria-label="Tasks">
          {tasks.data.map((t) => (
            <li key={t.id} className={common.item}>
              <div className={common.itemMain}>
                <strong>{t.title}</strong>
                <span className={common.row}>
                  <span className={common.badge}>{t.subject}</span>
                  <span className={common.badge}>{t.difficulty}</span>
                  <span className={common.reward}>
                    {t.status === 'completed' || t.rewarded
                      ? t.rewarded
                        ? `Paid ${t.rewardXp} XP`
                        : 'Completed'
                      : `Reward: +${t.rewardXp} XP`}
                  </span>
                  {t.status === 'completed' && <span className={common.muted}>Completed</span>}
                </span>
              </div>
              <div className={common.row}>
                {t.status === 'open' ? (
                  <button
                    type="button"
                    className={`${common.btn} ${common.primary} ${common.small}`}
                    disabled={busy}
                    onClick={() => complete.mutate(t.id)}
                  >
                    Complete
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${common.btn} ${common.small}`}
                    disabled={busy}
                    onClick={() => reopen.mutate(t.id)}
                  >
                    Reopen
                  </button>
                )}
                <button type="button" className={`${common.btn} ${common.small}`} onClick={() => setEditing(t)}>
                  Edit
                </button>
                <button
                  type="button"
                  className={`${common.btn} ${common.danger} ${common.small}`}
                  onClick={() => {
                    remove.reset();
                    setDeleting(t);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditTask
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setMessage('Task updated.');
            await refresh();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this task?"
          confirmLabel="Delete task"
          busy={remove.isPending}
          error={remove.error ? errorMessage(remove.error) : null}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.id)}
        >
          <p>
            “{deleting.title}” will be removed. XP it already paid stays with you.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
