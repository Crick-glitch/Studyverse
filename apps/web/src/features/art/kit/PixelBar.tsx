import styles from './kit.module.css';

export interface PixelBarProps {
  value: number;
  max: number;
  tone?: 'hp' | 'xp' | 'focus' | 'enemy';
  /** Accessible name, e.g. "Hero HP". */
  label: string;
  /** Number of blocks; fixed block size keeps every edge on a whole pixel. */
  segments?: number;
  showNumbers?: boolean;
  className?: string;
}

export const filledSegments = (value: number, max: number, segments: number): number => {
  if (!(max > 0) || !(value > 0)) return 0;
  const pct = Math.min(1, value / max);
  return Math.min(segments, Math.max(1, Math.round(pct * segments)));
};

/** A segmented HP / XP / Focus bar. */
export function PixelBar({ value, max, tone = 'xp', label, segments = 20, showNumbers = true, className }: PixelBarProps) {
  const now = Math.max(0, Math.min(max, value));
  const on = filledSegments(now, max, segments);
  return (
    <div
      className={`${styles.bar} ${className ?? ''}`}
      data-tone={tone}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={now}
      aria-valuetext={`${now} of ${max}`}
    >
      <span className={styles.track} aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={styles.seg} data-on={i < on ? 'true' : 'false'} />
        ))}
      </span>
      {showNumbers ? <span className={styles.numbers} aria-hidden="true">{now}/{max}</span> : null}
    </div>
  );
}
