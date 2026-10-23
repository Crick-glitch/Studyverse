import type { ReactNode } from 'react';
import common from './common.module.css';

/** Loading placeholder (announced politely, not a spinner that never ends). */
export function Skeleton({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className={common.skeleton}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={common.skeletonLine} />
      ))}
      <span className={common.srOnly}>{label}…</span>
    </div>
  );
}

/** A failed request always offers a retry, never a silent blank screen. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className={common.error}>
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          className={`${common.btn} ${common.small}`}
          style={{ marginTop: 'var(--space-2)' }}
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Empty states say what to do next. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={common.notice}>
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}
