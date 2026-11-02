import styles from './art.module.css';

/** Shown for a missing or unusable asset key: obviously unfinished, names the key, never an emoji. */
export function MissingArt({ id, reason = 'missing asset' }: { id: string; reason?: string }) {
  return (
    <span className={styles.placeholder} role="img" aria-label={`Missing art: ${id}`} data-missing={id}>
      <span className={styles.placeholderTitle}>{reason}</span>
      <span>{id}</span>
    </span>
  );
}
