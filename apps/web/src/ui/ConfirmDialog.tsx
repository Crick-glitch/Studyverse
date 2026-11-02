import type { ReactNode } from 'react';
import common from './common.module.css';
import { Dialog } from './Dialog';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
}

/** Destructive actions always go through this (Escape or Cancel keeps everything). */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  error,
}: Props) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      actions={
        <>
          <button type="button" className={common.btn} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`${common.btn} ${common.danger}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className={common.stack}>
        {children}
        {error && (
          <p role="alert" className={common.error}>
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
