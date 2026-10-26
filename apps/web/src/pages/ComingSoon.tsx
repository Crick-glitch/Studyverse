import { PixelPanel } from '../features/art/kit';
import type { NavIconId } from '../features/art/sprites/icons';
import { PageHeader } from '../ui/PageHeader';
import styles from './ComingSoon.module.css';

interface Props {
  title: string;
  phase: string;
  description: string;
  icon?: NavIconId;
}

/** Honest placeholder for routes that are not built yet (hard rule 6: no fake content). */
export function ComingSoon({ title, phase, description, icon }: Props) {
  return (
    <PixelPanel className={styles.panel} aria-labelledby="page-title">
      <PageHeader id="page-title" {...(icon ? { icon } : {})}>
        {title}
      </PageHeader>
      <p className={styles.badge}>Coming in a later phase ({phase})</p>
      <p>{description}</p>
    </PixelPanel>
  );
}
