import { BALANCE, type CsvImportResultDto, type CsvPreviewDto, type DeckDto } from '@studyverse/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { saveBlob } from '../../lib/download';
import common from '../../ui/common.module.css';

function PreviewSummary({ p }: { p: CsvPreviewDto }) {
  return (
    <div className={common.stack} aria-label="CSV preview">
      {p.fatal ? (
        <p role="alert" className={common.error}>
          {p.fatal}
        </p>
      ) : (
        <p role="status" className={common.notice}>
          {p.totalRows} rows read: {p.valid} ready to import, {p.duplicates} already in this deck,{' '}
          {p.errors.length} with problems.
        </p>
      )}
      {p.errors.length > 0 && (
        <ul className={common.list} aria-label="Rows with problems">
          {p.errors.slice(0, 50).map((e) => (
            <li key={`${e.row}-${e.message}`} className={common.error}>
              row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      )}
      {p.sample.length > 0 && (
        <details>
          <summary>First rows that will be imported</summary>
          <ul>
            {p.sample.map((s) => (
              <li key={s.row}>
                row {s.row}: {s.question} → {s.answer}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** CSV import (preview first, nothing is written until you confirm) and export. */
export function CsvPanel({ deck }: { deck: DeckDto }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [includeReview, setIncludeReview] = useState(false);
  const [done, setDone] = useState<CsvImportResultDto | null>(null);

  const preview = useMutation({ mutationFn: () => api.decks.csvPreview(deck.id, text) });
  const run = useMutation({
    mutationFn: () => api.decks.csvImport(deck.id, text),
    onSuccess: async (r) => {
      setDone(r);
      setText('');
      preview.reset();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cards', deck.id] }),
        qc.invalidateQueries({ queryKey: ['decks'] }),
      ]);
    },
  });
  const download = useMutation({
    mutationFn: () => api.decks.csvExport(deck.id, includeReview),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
  });

  const onFile = async (file: File | undefined) => {
    setFileError(null);
    setDone(null);
    preview.reset();
    if (!file) return;
    if (file.size > BALANCE.csv.maxBytes) {
      setFileError(`That file is too large (limit ${Math.round(BALANCE.csv.maxBytes / 1000)} KB).`);
      return;
    }
    setText(await file.text());
  };

  const p = preview.data;
  const canImport = Boolean(p && !p.fatal && p.valid > 0);
  return (
    <div className={`${common.panel} ${common.stack}`}>
      <h3>CSV import and export</h3>
      <p className={common.muted}>
        Header: <code>question,correct,wrong1,wrong2,subject,difficulty</code> (the old app’s header
        also works). Up to {BALANCE.csv.maxRows} rows.
      </p>
      <label className={common.field}>
        <span className={common.label}>Choose a CSV file</span>
        <input
          className={common.input}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      <label className={common.field}>
        <span className={common.label}>…or paste CSV text</span>
        <textarea
          className={common.textarea}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(null);
            preview.reset();
          }}
        />
      </label>
      {fileError && <p role="alert" className={common.error}>{fileError}</p>}
      {preview.error && <p role="alert" className={common.error}>{errorMessage(preview.error)}</p>}
      {run.error && <p role="alert" className={common.error}>{errorMessage(run.error)}</p>}
      {p && <PreviewSummary p={p} />}
      {done && (
        <p role="status" className={common.notice}>
          Imported {done.imported} cards into “{deck.name}”. {done.duplicates} duplicates and{' '}
          {done.errors.length} problem rows were skipped.
        </p>
      )}
      <div className={common.row}>
        <button
          type="button"
          className={common.btn}
          disabled={!text.trim() || preview.isPending}
          onClick={() => {
            setDone(null);
            preview.mutate();
          }}
        >
          {preview.isPending ? 'Checking…' : 'Preview'}
        </button>
        <button
          type="button"
          className={`${common.btn} ${common.primary}`}
          disabled={!canImport || run.isPending}
          onClick={() => run.mutate()}
        >
          {run.isPending ? 'Importing…' : `Import ${p?.valid ?? 0} cards`}
        </button>
      </div>

      <h4>Export</h4>
      <label className={common.row}>
        <input type="checkbox" checked={includeReview} onChange={(e) => setIncludeReview(e.target.checked)} />
        <span>Include review data (ease, interval, due date)</span>
      </label>
      {download.error && <p role="alert" className={common.error}>{errorMessage(download.error)}</p>}
      <div>
        <button type="button" className={common.btn} disabled={download.isPending} onClick={() => download.mutate()}>
          {download.isPending ? 'Preparing…' : 'Download this deck as CSV'}
        </button>
      </div>
    </div>
  );
}
