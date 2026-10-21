import styles from './ComingSoon.module.css';

interface Props {
  title: string;
  phase: string;
  description: string;
}

/** Honest placeholder for routes that are not built yet (hard rule 6: no fake content). */
export function ComingSoon({ title, phase, description }: Props) {
  return (
    <section className={styles.panel} aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      <p className={styles.badge}>Coming in a later phase ({phase})</p>
      <p>{description}</p>
    </section>
  );
}
