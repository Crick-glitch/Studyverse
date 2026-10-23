import type { ImportReportDto } from '@studyverse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { saveBlob } from '../../lib/download';
import common from '../../ui/common.module.css';
import { Dialog } from '../../ui/Dialog';
import {
  isImportDone,
  isSkipped,
  markImportDone,
  markSkipped,
  parseLegacy,
  readLegacyRaw,
  removeBackup,
  removeLegacyData,
  writeBackup,
} from './legacy';

function Report({ report }: { report: ImportReportDto }) {
  const i = report.imported;
  return (
    <div className={common.stack}>
      <p role="status" className={common.notice}>
        {report.alreadyImported
          ? 'This exact save was already imported into your account earlier; nothing was added again.'
          : 'Import finished.'}
      </p>
      {!report.alreadyImported && (
        <ul>
          <li>XP carried over: {i.xp}</li>
          <li>Tasks: {i.tasks}</li>
          <li>Study sessions (history only): {i.sessions}</li>
          <li>Flashcards: {i.flashcards}</li>
          <li>Skills: {i.skills}</li>
          <li>Equipment: {i.items}</li>
          {i.profileFields.length > 0 && <li>Profile: {i.profileFields.join(', ')}</li>}
        </ul>
      )}
      {report.skipped.length > 0 && (
        <>
          <h3>Skipped</h3>
          <ul>
            {report.skipped.map((s) => (
              <li key={s.what}>
                {s.count} {s.what}: {s.reason}
              </li>
            ))}
          </ul>
        </>
      )}
      {report.notImported.length > 0 && (
        <>
          <h3>Not imported</h3>
          <ul>
            {report.notImported.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
      {report.notes.length > 0 && (
        <ul>
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Offers to import the old app's browser save. It never imports on its own and never decides for the
 * player: Import / Not now / Download backup. A backup copy is always written first and kept until the
 * player confirms the result looks right.
 */
export function LocalImportPrompt({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [raw] = useState(readLegacyRaw);
  const [hidden, setHidden] = useState(() => isSkipped(userId) || isImportDone(userId));
  const [merge, setMerge] = useState(false);
  const [backupKey, setBackupKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReportDto | null>(null);

  const show = raw !== null && !hidden;
  const parsed = raw === null ? null : parseLegacy(raw);
  const preflight = useQuery({
    queryKey: ['import', 'preflight'],
    queryFn: api.import.preflight,
    enabled: show,
    retry: false,
  });
  const run = useMutation({
    mutationFn: (payload: Parameters<typeof api.import.run>[0]) => api.import.run(payload),
    onSuccess: async (r) => {
      setReport(r);
      markImportDone(userId);
      await qc.invalidateQueries();
    },
  });

  if (!show || raw === null) return null;

  const hasProgress = preflight.data?.hasProgress ?? false;
  const notNow = () => {
    markSkipped(userId);
    setHidden(true);
  };
  const downloadBackup = () =>
    saveBlob(new Blob([raw], { type: 'application/json' }), 'studyverse-data-backup.json');

  const start = () => {
    setLocalError(null);
    if (!parsed?.ok) return;
    // Backup first. If the browser cannot store it, do not import.
    const key = writeBackup(raw);
    if (!key) {
      setLocalError(
        'Could not save a backup copy in this browser, so nothing was imported. Use "Download backup", then try again.',
      );
      return;
    }
    setBackupKey(key);
    run.mutate({ payload: parsed.payload, ...(hasProgress ? { onExistingProgress: 'merge' as const } : {}) });
  };

  if (report) {
    const finish = (removeOld: boolean) => {
      if (removeOld) removeLegacyData();
      else if (backupKey) removeBackup(backupKey);
      setHidden(true);
    };
    return (
      <Dialog
        title="Old progress imported"
        onClose={() => finish(false)}
        actions={
          <>
            <button type="button" className={common.btn} onClick={() => finish(false)}>
              Looks right, keep the old save
            </button>
            <button type="button" className={`${common.btn} ${common.danger}`} onClick={() => finish(true)}>
              Looks right, remove old data from this browser
            </button>
          </>
        }
      >
        <Report report={report} />
        <p className={common.muted}>
          A backup copy stays in this browser until you pick one of the buttons below.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Import your old StudyVerse progress?"
      onClose={notNow}
      actions={
        <>
          <button type="button" className={common.btn} onClick={downloadBackup}>
            Download backup
          </button>
          <button type="button" className={common.btn} onClick={notNow} disabled={run.isPending}>
            Not now
          </button>
          <button
            type="button"
            className={`${common.btn} ${common.primary}`}
            onClick={start}
            disabled={
              run.isPending ||
              !parsed?.ok ||
              preflight.isPending ||
              preflight.isError ||
              (hasProgress && !merge)
            }
          >
            {run.isPending ? 'Importing…' : 'Import'}
          </button>
        </>
      }
    >
      <div className={common.stack}>
        <p>
          This browser holds a save from the earlier version of StudyVerse. You can bring your tasks,
          sessions, flashcards and skills into this account.
        </p>
        <p className={common.notice}>
          Your XP and level are kept as personal progress, but because an old save can be edited by
          hand, they do <strong>not</strong> count toward the leaderboard. Only XP earned from now on
          does.
        </p>
        {parsed && !parsed.ok && (
          <p role="alert" className={common.error}>
            {parsed.error} You can still download a backup.
          </p>
        )}
        {preflight.isError && (
          <p role="alert" className={common.error}>
            Could not check your account: {errorMessage(preflight.error)}
          </p>
        )}
        {hasProgress && (
          <div className={common.stack}>
            <p role="alert" className={common.error}>
              This account already has progress ({preflight.data?.existing.totalXp} XP,{' '}
              {preflight.data?.existing.tasks} tasks, {preflight.data?.existing.flashcards} flashcards).
              Nothing is overwritten; imported items are added next to what you have.
            </p>
            <label className={common.row}>
              <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} />
              <span>Yes, merge the old save into this account</span>
            </label>
          </div>
        )}
        {(localError || run.error) && (
          <p role="alert" className={common.error}>
            {localError ?? errorMessage(run.error)}
          </p>
        )}
        <p className={common.muted}>
          Before importing, a backup copy is saved in this browser. Nothing is deleted until you
          confirm.
        </p>
      </div>
    </Dialog>
  );
}
